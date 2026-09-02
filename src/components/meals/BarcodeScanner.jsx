import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Barcode, Camera, Check, Keyboard, RotateCcw, X } from 'lucide-react';
import { BarcodeFormat, BrowserMultiFormatReader } from '@zxing/browser';
import {
  canonicalizeBarcode,
  isValidProductBarcode,
  lookupProductByBarcode,
  normalizeBarcode
} from '../../lib/barcodes';
import styles from './BarcodeScanner.module.css';

const CAMERA_CONSTRAINTS = {
  audio: false,
  video: {
    facingMode: { exact: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30 }
  }
};

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

const cameraErrorMessage = (error) => {
  if (error?.name === 'NotAllowedError') {
    return 'Permiso de cámara bloqueado. Habilitalo o ingresá el código manualmente.';
  }
  if (error?.name === 'NotReadableError') {
    return 'La cámara está siendo usada por otra aplicación.';
  }
  if (['NotFoundError', 'OverconstrainedError'].includes(error?.name)) {
    return 'No encontré una cámara trasera disponible.';
  }
  return 'No pude abrir la cámara. Ingresá el código manualmente.';
};

const findExistingIngredient = (ingredients, barcode) => ingredients.find(
  (ingredient) => ingredient.barcode
    && canonicalizeBarcode(ingredient.barcode) === canonicalizeBarcode(barcode)
);

const BarcodeScanner = ({ ingredients, onAddIngredient, onSelect, onCancel }) => {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const abortRef = useRef(null);
  const detectionTimerRef = useRef(null);
  const detectedCodesRef = useRef(new Map());
  const scanFinalizedRef = useRef(false);
  const selectionLockRef = useRef(false);
  const latestPropsRef = useRef({ ingredients, onAddIngredient, onSelect });

  const [manualCode, setManualCode] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [isConfirmingDetection, setIsConfirmingDetection] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [error, setError] = useState('');
  const [scanSession, setScanSession] = useState(0);
  const [productCandidates, setProductCandidates] = useState([]);

  useEffect(() => {
    latestPropsRef.current = { ingredients, onAddIngredient, onSelect };
  }, [ingredients, onAddIngredient, onSelect]);

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
      const ingredient = candidate.existing
        ? candidate.ingredient
        : await currentProps.onAddIngredient(candidate.ingredient);
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
        const existing = findExistingIngredient(latestPropsRef.current.ingredients, barcode);
        if (existing) return { barcode, count, ingredient: existing, existing: true };

        try {
          const product = await lookupProductByBarcode(barcode, { signal: controller.signal });
          return { barcode, count, ingredient: product, existing: false };
        } catch (lookupError) {
          if (!firstLookupError && lookupError?.name !== 'AbortError') firstLookupError = lookupError;
          return null;
        }
      }));

      const uniqueCandidates = [...new Map(
        resolved
          .filter(Boolean)
          .map((candidate) => [canonicalizeBarcode(candidate.barcode), candidate])
      ).values()];

      if (uniqueCandidates.length === 0) {
        throw firstLookupError || new Error('No encontré productos para los códigos detectados.');
      }

      if (uniqueCandidates.length === 1) {
        await saveAndSelectProduct(uniqueCandidates[0]);
        return;
      }

      setProductCandidates(uniqueCandidates);
    } catch (lookupError) {
      if (lookupError?.name !== 'AbortError') {
        setError(lookupError?.message || 'No pude cargar los productos detectados.');
      }
      scanFinalizedRef.current = false;
    } finally {
      setIsLookingUp(false);
    }
  }, [saveAndSelectProduct, stopCamera]);

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

    reader.decodeFromConstraints(CAMERA_CONSTRAINTS, videoRef.current, (result, scanError) => {
      void scanError;
      if (result) recordDetectedBarcode(result.getText());
    }).then(async (controls) => {
      if (cancelled) {
        controls.stop();
        return;
      }

      controlsRef.current = controls;
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
      if (!cancelled) setError(cameraErrorMessage(cameraError));
    });

    return () => {
      cancelled = true;
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
      return;
    }

    resetScanner();
    detectedCodesRef.current.set(canonicalizeBarcode(barcode), { barcode, count: 1 });
    void resolveDetectedProducts();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h3>{productCandidates.length > 1 ? 'Elegí el producto' : 'Escanear producto'}</h3>
          <p>Datos nutricionales por 100 g</p>
        </div>
        <button type="button" onClick={onCancel} aria-label="Cerrar escáner">
          <X size={20} />
        </button>
      </div>

      {productCandidates.length > 1 ? (
        <div className={styles.candidateView}>
          <p>Detectamos varios productos. Elegí el correcto:</p>
          <div className={styles.candidateList}>
            {productCandidates.map((candidate) => (
              <button
                type="button"
                key={canonicalizeBarcode(candidate.barcode)}
                className={styles.candidateCard}
                onClick={() => saveAndSelectProduct(candidate)}
                disabled={isLookingUp}
              >
                <span>
                  <strong>{candidate.ingredient.name}</strong>
                  <small>Código {normalizeBarcode(candidate.barcode)}</small>
                </span>
                <span className={styles.candidateCalories}>
                  {Math.round(Number(candidate.ingredient.kcal) || 0)} kcal
                  <small>por 100 g</small>
                </span>
                <Check size={19} />
              </button>
            ))}
          </div>
          <button type="button" className={styles.retryBtn} onClick={retryCamera} disabled={isLookingUp}>
            <RotateCcw size={16} /> Escanear de nuevo
          </button>
          {error && <div className={styles.error} role="status">{error}</div>}
        </div>
      ) : (
        <>
          <div className={styles.cameraFrame}>
            <video ref={videoRef} className={styles.video} muted playsInline />
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
              <button type="button" onClick={retryCamera} disabled={isLookingUp}>
                <RotateCcw size={15} /> Reintentar cámara
              </button>
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
