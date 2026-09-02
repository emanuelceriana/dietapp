import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Barcode, Camera, Check, Keyboard, RotateCcw, ScanText, X } from 'lucide-react';
import { BarcodeFormat, BrowserMultiFormatReader } from '@zxing/browser';
import {
  canonicalizeBarcode,
  isValidProductBarcode,
  lookupProductByBarcode,
  normalizeBarcode
} from '../../lib/barcodes';
import styles from './BarcodeScanner.module.css';

const CAMERA_QUALITY = {
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: { ideal: 30 }
};

const REAR_CAMERA_CONSTRAINTS = {
  audio: false,
  video: {
    facingMode: { exact: 'environment' },
    ...CAMERA_QUALITY
  }
};

const ANY_CAMERA_CONSTRAINTS = { audio: false, video: true };

const PRODUCT_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.ITF
];

const NATIVE_PRODUCT_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'itf'];
const DETECTION_DELAY_MS = 1800;
const MAX_PRODUCT_CANDIDATES = 4;
const canRetryWithAnyCamera = (error) => ['NotFoundError', 'OverconstrainedError'].includes(error?.name);

const cameraErrorMessage = (error) => {
  if (error?.name === 'NotAllowedError') {
    return 'Permiso de cámara bloqueado. Habilitalo o ingresá el código manualmente.';
  }
  if (error?.name === 'NotReadableError') {
    return 'La cámara está siendo usada por otra aplicación.';
  }
  if (['NotFoundError', 'OverconstrainedError'].includes(error?.name)) {
    return 'No encontré una cámara disponible.';
  }
  return 'No pude abrir la cámara. Ingresá el código manualmente.';
};

const findIngredientsByBarcode = (ingredients, barcode) => ingredients.filter(
  (ingredient) => ingredient.barcode
    && canonicalizeBarcode(ingredient.barcode) === canonicalizeBarcode(barcode)
);

const candidateIdentity = (candidate) => [
  canonicalizeBarcode(candidate.barcode),
  candidate.ingredient.name?.trim().toLocaleLowerCase(),
  Number(candidate.ingredient.kcal) || 0,
  Number(candidate.ingredient.protein) || 0,
  Number(candidate.ingredient.carbs) || 0,
  Number(candidate.ingredient.fat) || 0
].join('|');

const BarcodeScanner = ({
  ingredients,
  onAddIngredient,
  onUpdateIngredient,
  currentUserId,
  onSelect,
  onScanNutritionLabel,
  onCancel
}) => {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const abortRef = useRef(null);
  const detectionTimerRef = useRef(null);
  const detectedCodesRef = useRef(new Map());
  const scanFinalizedRef = useRef(false);
  const selectionLockRef = useRef(false);
  const latestPropsRef = useRef({
    ingredients,
    onAddIngredient,
    onUpdateIngredient,
    currentUserId,
    onSelect
  });

  const [manualCode, setManualCode] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [isConfirmingDetection, setIsConfirmingDetection] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [error, setError] = useState('');
  const [scanSession, setScanSession] = useState(0);
  const [productCandidates, setProductCandidates] = useState([]);
  const [nutritionFallbackAvailable, setNutritionFallbackAvailable] = useState(false);

  useEffect(() => {
    latestPropsRef.current = {
      ingredients,
      onAddIngredient,
      onUpdateIngredient,
      currentUserId,
      onSelect
    };
  }, [currentUserId, ingredients, onAddIngredient, onSelect, onUpdateIngredient]);

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setCameraReady(false);
  }, []);

  const saveAndSelectProduct = useCallback(async (candidate) => {
    if (selectionLockRef.current) return;

    selectionLockRef.current = true;
    setError('');
    setIsLookingUp(true);

    try {
      const currentProps = latestPropsRef.current;
      let ingredient;

      if (candidate.existingIngredient && candidate.fromStoredIngredient) {
        ingredient = candidate.existingIngredient;
      } else if (candidate.existingIngredient && currentProps.onUpdateIngredient) {
        ingredient = await currentProps.onUpdateIngredient(candidate.existingIngredient.id, {
          ...candidate.ingredient,
          isPublic: candidate.existingIngredient.isPublic,
          sourceType: candidate.existingIngredient.sourceType || 'ingredient'
        });
      } else {
        ingredient = await currentProps.onAddIngredient(candidate.ingredient);
      }

      latestPropsRef.current.onSelect(ingredient);
    } catch (selectionError) {
      setError(selectionError?.message || 'No pude guardar el producto.');
      selectionLockRef.current = false;
    } finally {
      setIsLookingUp(false);
    }
  }, []);

  const resolveDetectedProducts = useCallback(async () => {
    if (scanFinalizedRef.current) return;

    scanFinalizedRef.current = true;
    setIsConfirmingDetection(false);
    setError('');
    setNutritionFallbackAvailable(false);
    setIsLookingUp(true);
    stopCamera();

    const detectedCodes = [...detectedCodesRef.current.values()]
      .sort((left, right) => right.count - left.count)
      .slice(0, MAX_PRODUCT_CANDIDATES);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    let firstLookupError;

    try {
      const resolved = await Promise.all(detectedCodes.map(async ({ barcode, count }) => {
        const currentProps = latestPropsRef.current;
        const storedIngredients = findIngredientsByBarcode(currentProps.ingredients, barcode);
        const existingIngredient = storedIngredients.find(
          (ingredient) => ingredient.userId === currentProps.currentUserId
        );
        const storedCandidates = storedIngredients.map((ingredient) => ({
          barcode,
          count,
          ingredient: {
            ...ingredient,
            dataSource: ingredient.userId === currentProps.currentUserId
              ? 'Mis ingredientes'
              : 'Comunidad'
          },
          existingIngredient: ingredient,
          fromStoredIngredient: true
        }));

        try {
          const product = await lookupProductByBarcode(barcode, { signal: controller.signal });
          return [
            { barcode, count, ingredient: product, existingIngredient },
            ...storedCandidates
          ];
        } catch (lookupError) {
          if (storedCandidates.length > 0) return storedCandidates;
          if (!firstLookupError && lookupError?.name !== 'AbortError') firstLookupError = lookupError;
          return [];
        }
      }));

      const uniqueCandidates = [...new Map(
        resolved
          .flat()
          .filter(Boolean)
          .map((candidate) => [candidateIdentity(candidate), candidate])
      ).values()].slice(0, MAX_PRODUCT_CANDIDATES);

      if (uniqueCandidates.length === 0) {
        throw firstLookupError || new Error('No encontré productos para los códigos detectados.');
      }

      setProductCandidates(uniqueCandidates);
    } catch (lookupError) {
      if (lookupError?.name !== 'AbortError') {
        setError(lookupError?.message || 'No pude cargar los productos detectados.');
        setNutritionFallbackAvailable(true);
      }
      scanFinalizedRef.current = false;
    } finally {
      setIsLookingUp(false);
    }
  }, [stopCamera]);

  const recordDetectedBarcode = useCallback((rawCode) => {
    if (scanFinalizedRef.current) return false;

    const barcode = normalizeBarcode(rawCode);
    if (!isValidProductBarcode(barcode)) return false;

    const key = canonicalizeBarcode(barcode);
    const previous = detectedCodesRef.current.get(key);
    detectedCodesRef.current.set(key, {
      barcode,
      count: (previous?.count || 0) + 1
    });

    if (!detectionTimerRef.current) {
      setIsConfirmingDetection(true);
      detectionTimerRef.current = window.setTimeout(() => {
        detectionTimerRef.current = null;
        void resolveDetectedProducts();
      }, DETECTION_DELAY_MS);
    }

    return true;
  }, [resolveDetectedProducts]);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador no permite usar la cámara. Ingresá el código manualmente.');
      return undefined;
    }

    let cancelled = false;
    let nativeScanTimer;
    const reader = new BrowserMultiFormatReader(undefined, {
      delayBetweenScanAttempts: 150,
      delayBetweenScanSuccess: 250
    });
    reader.possibleFormats = PRODUCT_FORMATS;
    setError('');

    const handleDecode = (result, scanError) => {
      void scanError;
      if (result) recordDetectedBarcode(result.getText());
    };

    const openCamera = async () => {
      try {
        return await reader.decodeFromConstraints(
          REAR_CAMERA_CONSTRAINTS,
          videoRef.current,
          handleDecode
        );
      } catch (rearCameraError) {
        if (!canRetryWithAnyCamera(rearCameraError)) throw rearCameraError;

        let defaultCameraError;
        try {
          return await reader.decodeFromConstraints(
            ANY_CAMERA_CONSTRAINTS,
            videoRef.current,
            handleDecode
          );
        } catch (cameraError) {
          defaultCameraError = cameraError;
        }

        let videoDevices = [];
        try {
          videoDevices = await BrowserMultiFormatReader.listVideoInputDevices();
        } catch {
          // Some browsers do not expose device IDs before opening a camera.
        }

        const prioritizedDevices = [...videoDevices].sort((left, right) => {
          const score = (device) => {
            const label = device.label.toLocaleLowerCase();
            if (/facetime|built-in|integrated|macbook/.test(label)) return 0;
            if (/obs|virtual|desk view/.test(label)) return 2;
            return 1;
          };
          return score(left) - score(right);
        });

        let lastDeviceError;
        for (const device of prioritizedDevices) {
          if (!device.deviceId) continue;
          try {
            return await reader.decodeFromConstraints(
              { audio: false, video: { deviceId: { exact: device.deviceId } } },
              videoRef.current,
              handleDecode
            );
          } catch (deviceError) {
            lastDeviceError = deviceError;
          }
        }
        throw lastDeviceError || defaultCameraError;
      }
    };

    const startCamera = () => {
      openCamera().then(async (controls) => {
        if (cancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        try {
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.setAttribute('playsinline', '');
            await videoRef.current.play();
          }
        } catch (playError) {
          controls.stop();
          controlsRef.current = null;
          throw playError;
        }
        setCameraReady(true);

        const track = videoRef.current?.srcObject?.getVideoTracks?.()[0];
        try {
          const capabilities = track?.getCapabilities?.();
          if (capabilities?.focusMode?.includes('continuous')) {
            await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
          }
        } catch {
          // Some browsers expose focus capability but reject applying it.
        }

        const NativeBarcodeDetector = window.BarcodeDetector;
        if (!NativeBarcodeDetector) return;

        try {
          const supportedFormats = typeof NativeBarcodeDetector.getSupportedFormats === 'function'
            ? await NativeBarcodeDetector.getSupportedFormats()
            : NATIVE_PRODUCT_FORMATS;
          const formats = NATIVE_PRODUCT_FORMATS.filter((format) => supportedFormats.includes(format));
          const detector = formats.length
            ? new NativeBarcodeDetector({ formats })
            : new NativeBarcodeDetector();

          const scanNativeFrame = async () => {
            if (cancelled || scanFinalizedRef.current || !videoRef.current) return;

            try {
              const barcodes = await detector.detect(videoRef.current);
              barcodes.forEach((barcode) => recordDetectedBarcode(barcode.rawValue));
            } catch {
              // ZXing remains active as fallback.
            }

            if (!cancelled && !scanFinalizedRef.current) {
              nativeScanTimer = window.setTimeout(scanNativeFrame, 180);
            }
          };

          void scanNativeFrame();
        } catch {
          // ZXing remains active when native BarcodeDetector setup fails.
        }
      }).catch((cameraError) => {
        if (!cancelled) {
          setError(cameraErrorMessage(cameraError));
          setNutritionFallbackAvailable(true);
        }
      });
    };

    const cameraStartTimer = window.setTimeout(startCamera, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(cameraStartTimer);
      window.clearTimeout(nativeScanTimer);
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [recordDetectedBarcode, scanSession]);

  useEffect(() => () => {
    abortRef.current?.abort();
    window.clearTimeout(detectionTimerRef.current);
  }, []);

  const resetScanner = () => {
    abortRef.current?.abort();
    window.clearTimeout(detectionTimerRef.current);
    detectionTimerRef.current = null;
    detectedCodesRef.current = new Map();
    scanFinalizedRef.current = false;
    selectionLockRef.current = false;
    setProductCandidates([]);
    setIsConfirmingDetection(false);
    setIsLookingUp(false);
    setError('');
    setNutritionFallbackAvailable(false);
  };

  const retryCamera = () => {
    stopCamera();
    resetScanner();
    setScanSession((current) => current + 1);
  };

  const handleManualSubmit = (event) => {
    event.preventDefault();
    if (isLookingUp) return;

    const barcode = normalizeBarcode(manualCode);
    if (!isValidProductBarcode(barcode)) {
      setError('El código debe tener entre 8 y 14 dígitos.');
      setNutritionFallbackAvailable(false);
      return;
    }

    resetScanner();
    detectedCodesRef.current.set(canonicalizeBarcode(barcode), { barcode, count: 1 });
    void resolveDetectedProducts();
  };

  const openNutritionScanner = () => {
    const detectedCodes = [...detectedCodesRef.current.values()];
    const detectedBarcode = detectedCodes.length === 1 ? detectedCodes[0].barcode : '';
    const barcode = isValidProductBarcode(manualCode) ? manualCode : detectedBarcode;
    stopCamera();
    onScanNutritionLabel(barcode);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h3>{productCandidates.length > 0 ? 'Confirmá el producto' : 'Escanear producto'}</h3>
          <p>Datos nutricionales por 100 g</p>
        </div>
        <button type="button" onClick={onCancel} aria-label="Cerrar escáner">
          <X size={20} />
        </button>
      </div>

      {productCandidates.length > 0 ? (
        <div className={styles.candidateView}>
          <p>
            {productCandidates.length === 1
              ? 'Revisá la foto y los valores. Solo se guarda si confirmás.'
              : 'Detectamos varios productos. Revisalos y elegí el correcto.'}
          </p>
          <div className={styles.candidateList}>
            {productCandidates.map((candidate) => (
              <button
                type="button"
                key={candidateIdentity(candidate)}
                className={styles.candidateCard}
                onClick={() => saveAndSelectProduct(candidate)}
                disabled={isLookingUp}
              >
                <span className={styles.candidateImage}>
                  <Barcode size={23} />
                  {candidate.ingredient.imageUrl && (
                    <img
                      src={candidate.ingredient.imageUrl}
                      alt=""
                      loading="lazy"
                      onError={(event) => { event.currentTarget.hidden = true; }}
                    />
                  )}
                </span>
                <span className={styles.candidateInfo}>
                  <strong>{candidate.ingredient.name}</strong>
                  <small>
                    {candidate.ingredient.dataSource || 'Producto guardado'} · Código {normalizeBarcode(candidate.barcode)}
                  </small>
                </span>
                <span className={styles.candidateCalories}>
                  {Math.round(Number(candidate.ingredient.kcal) || 0)} kcal
                  <small>por 100 g</small>
                </span>
                <span className={styles.candidateUse}>
                  <Check size={16} /> Usar
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.nutritionBtn}
            onClick={openNutritionScanner}
            disabled={isLookingUp}
          >
            <ScanText size={18} /> No es correcto · fotografiar tabla nutricional
          </button>
          <button type="button" className={styles.retryBtn} onClick={retryCamera} disabled={isLookingUp}>
            <RotateCcw size={16} /> Escanear otro código
          </button>
          {error && <div className={styles.error} role="status">{error}</div>}
        </div>
      ) : (
        <>
          <div className={styles.cameraFrame}>
            <video ref={videoRef} className={styles.video} autoPlay muted playsInline />
            <div className={styles.guide} aria-hidden="true">
              <span />
            </div>
            {!cameraReady && !isLookingUp && !error && (
              <div className={styles.cameraStatus}>
                <Camera size={26} />
                <span>Abriendo cámara trasera...</span>
              </div>
            )}
            {isConfirmingDetection && !isLookingUp && (
              <div className={styles.detectingStatus}>
                <Check size={17} /> Código detectado · verificando...
              </div>
            )}
            {isLookingUp && (
              <div className={styles.cameraStatus}>
                <Barcode size={28} />
                <span>Buscando producto...</span>
              </div>
            )}
          </div>

          <p className={styles.hint}>Mantené las barras horizontales y acercalas hasta llenar el recuadro.</p>

          {error && (
            <div className={styles.error} role="status">
              <span>{error}</span>
              <div className={styles.errorActions}>
                <button type="button" onClick={retryCamera} disabled={isLookingUp}>
                  <RotateCcw size={15} /> Reintentar cámara
                </button>
                {nutritionFallbackAvailable && (
                  <button type="button" onClick={openNutritionScanner} disabled={isLookingUp}>
                    <ScanText size={15} /> Escanear tabla nutricional
                  </button>
                )}
              </div>
            </div>
          )}

          <form className={styles.manualForm} onSubmit={handleManualSubmit}>
            <label htmlFor="manual-barcode">
              <Keyboard size={17} /> Código manual
            </label>
            <div>
              <input
                id="manual-barcode"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={manualCode}
                onChange={(event) => setManualCode(normalizeBarcode(event.target.value))}
                placeholder="Ej: 7791234567890"
                maxLength={14}
                disabled={isLookingUp}
              />
              <button type="submit" disabled={isLookingUp || !manualCode}>
                Buscar
              </button>
            </div>
          </form>

        </>
      )}

      <p className={styles.source}>Información provista por Open Food Facts.</p>
    </div>
  );
};

export default BarcodeScanner;
