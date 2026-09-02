import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Barcode, Camera, Flashlight, Keyboard, RotateCcw, X } from 'lucide-react';
import { BarcodeFormat, BrowserMultiFormatReader } from '@zxing/browser';
import {
  canonicalizeBarcode,
  isValidProductBarcode,
  lookupProductByBarcode,
  normalizeBarcode
} from '../../lib/barcodes';
import styles from './BarcodeScanner.module.css';

const CAMERA_QUALITY_CONSTRAINTS = {
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: { ideal: 30 }
};

const CAMERA_CONSTRAINTS = {
  audio: false,
  video: {
    ...CAMERA_QUALITY_CONSTRAINTS,
    facingMode: { ideal: 'environment' }
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
const CAMERA_STORAGE_KEY = 'dietapp:preferred-camera:v1';

const readPreferredCamera = () => {
  try {
    return window.localStorage.getItem(CAMERA_STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

const savePreferredCamera = (deviceId) => {
  try {
    if (deviceId) {
      window.localStorage.setItem(CAMERA_STORAGE_KEY, deviceId);
    } else {
      window.localStorage.removeItem(CAMERA_STORAGE_KEY);
    }
  } catch {
    // Camera selection still works for current session.
  }
};

const constraintsForCamera = (deviceId) => deviceId
  ? {
      ...CAMERA_CONSTRAINTS,
      video: {
        ...CAMERA_QUALITY_CONSTRAINTS,
        deviceId: { exact: deviceId }
      }
    }
  : CAMERA_CONSTRAINTS;

const cameraErrorMessage = (error) => {
  if (error?.name === 'NotAllowedError') {
    return 'Permiso de cámara bloqueado. Habilitalo o ingresá el código manualmente.';
  }
  if (error?.name === 'NotReadableError') {
    return 'La cámara está siendo usada por otra aplicación.';
  }
  return 'No pude abrir la cámara. Ingresá el código manualmente.';
};

const BarcodeScanner = ({ ingredients, onAddIngredient, onSelect, onCancel }) => {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const abortRef = useRef(null);
  const scanHandledRef = useRef(false);
  const latestPropsRef = useRef({ ingredients, onAddIngredient, onSelect });

  const [manualCode, setManualCode] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [error, setError] = useState('');
  const [scanSession, setScanSession] = useState(0);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(readPreferredCamera);
  const [activeCameraId, setActiveCameraId] = useState('');
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    latestPropsRef.current = { ingredients, onAddIngredient, onSelect };
  }, [ingredients, onAddIngredient, onSelect]);

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setCameraReady(false);
    setTorchAvailable(false);
    setTorchOn(false);
  }, []);

  const findOrCreateIngredient = useCallback(async (rawCode) => {
    const barcode = normalizeBarcode(rawCode);
    if (!isValidProductBarcode(barcode)) {
      setError('El código debe tener entre 8 y 14 dígitos.');
      scanHandledRef.current = false;
      return;
    }

    setManualCode(barcode);
    setError('');
    setIsLookingUp(true);
    stopCamera();

    try {
      const currentProps = latestPropsRef.current;
      const existing = currentProps.ingredients.find(
        (ingredient) => ingredient.barcode
          && canonicalizeBarcode(ingredient.barcode) === canonicalizeBarcode(barcode)
      );

      if (existing) {
        currentProps.onSelect(existing, { existing: true });
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const product = await lookupProductByBarcode(barcode, { signal: controller.signal });
      const savedIngredient = await currentProps.onAddIngredient(product);
      latestPropsRef.current.onSelect(savedIngredient, { existing: false });
    } catch (lookupError) {
      if (lookupError?.name !== 'AbortError') {
        setError(lookupError?.message || 'No pude cargar el producto.');
      }
      scanHandledRef.current = false;
    } finally {
      setIsLookingUp(false);
    }
  }, [stopCamera]);

  const handleDetectedBarcode = useCallback((rawCode, controls) => {
    if (scanHandledRef.current) return false;

    const detectedCode = normalizeBarcode(rawCode);
    if (!isValidProductBarcode(detectedCode)) return false;

    scanHandledRef.current = true;
    controls?.stop();
    void findOrCreateIngredient(detectedCode);
    return true;
  }, [findOrCreateIngredient]);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador no permite usar la cámara. Ingresá el código manualmente.');
      return undefined;
    }

    let cancelled = false;
    let nativeScanTimer;
    const reader = new BrowserMultiFormatReader(undefined, {
      delayBetweenScanAttempts: 150,
      delayBetweenScanSuccess: 1000
    });
    reader.possibleFormats = PRODUCT_FORMATS;
    scanHandledRef.current = false;
    setError('');

    reader.decodeFromConstraints(constraintsForCamera(selectedCameraId), videoRef.current, (result, _scanError, controls) => {
      void _scanError;
      if (result) handleDetectedBarcode(result.getText(), controls);
    }).then(async (controls) => {
      if (cancelled) {
        controls.stop();
        return;
      }
      controlsRef.current = controls;
      setCameraReady(true);
      setTorchAvailable(Boolean(controls.switchTorch));

      const track = videoRef.current?.srcObject?.getVideoTracks?.()[0];
      const settings = track?.getSettings?.() || {};
      if (settings.deviceId) setActiveCameraId(settings.deviceId);

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) {
          setCameras(devices.filter((device) => device.kind === 'videoinput'));
        }
      } catch {
        // Device selection is optional.
      }

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
          if (cancelled || scanHandledRef.current || !videoRef.current) return;

          try {
            const barcodes = await detector.detect(videoRef.current);
            const detected = barcodes.find((barcode) => isValidProductBarcode(barcode.rawValue));
            if (detected && handleDetectedBarcode(detected.rawValue)) return;
          } catch {
            // ZXing remains active as fallback.
          }

          if (!cancelled && !scanHandledRef.current) {
            nativeScanTimer = window.setTimeout(scanNativeFrame, 180);
          }
        };

        void scanNativeFrame();
      } catch {
        // ZXing remains active when native BarcodeDetector setup fails.
      }
    }).catch((cameraError) => {
      if (cancelled) return;

      if (selectedCameraId && ['NotFoundError', 'OverconstrainedError'].includes(cameraError?.name)) {
        savePreferredCamera('');
        setSelectedCameraId('');
        return;
      }
      setError(cameraErrorMessage(cameraError));
    });

    return () => {
      cancelled = true;
      window.clearTimeout(nativeScanTimer);
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [handleDetectedBarcode, scanSession, selectedCameraId]);

  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);

  const handleManualSubmit = (event) => {
    event.preventDefault();
    if (isLookingUp) return;
    scanHandledRef.current = true;
    void findOrCreateIngredient(manualCode);
  };

  const retryCamera = () => {
    stopCamera();
    setError('');
    setScanSession((current) => current + 1);
  };

  const changeCamera = (event) => {
    const deviceId = event.target.value;
    stopCamera();
    setActiveCameraId(deviceId);
    setSelectedCameraId(deviceId);
    savePreferredCamera(deviceId);
  };

  const toggleTorch = async () => {
    if (!controlsRef.current?.switchTorch) return;

    try {
      const nextValue = !torchOn;
      await controlsRef.current.switchTorch(nextValue);
      setTorchOn(nextValue);
    } catch {
      setTorchAvailable(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h3>Escanear producto</h3>
          <p>Datos nutricionales por 100 g</p>
        </div>
        <button type="button" onClick={onCancel} aria-label="Cerrar escáner">
          <X size={20} />
        </button>
      </div>

      <div className={styles.cameraFrame}>
        <video ref={videoRef} className={styles.video} muted playsInline />
        <div className={styles.guide} aria-hidden="true">
          <span />
        </div>
        {!cameraReady && !isLookingUp && !error && (
          <div className={styles.cameraStatus}>
            <Camera size={26} />
            <span>Abriendo cámara...</span>
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

      {(cameras.length > 1 || torchAvailable) && (
        <div className={styles.cameraTools}>
          {cameras.length > 1 && (
            <label>
              <Camera size={16} />
              <select value={activeCameraId || selectedCameraId} onChange={changeCamera}>
                {cameras.map((camera, index) => (
                  <option key={camera.deviceId} value={camera.deviceId}>
                    {camera.label || `Cámara ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          {torchAvailable && (
            <button type="button" onClick={toggleTorch} className={torchOn ? styles.toolActive : ''}>
              <Flashlight size={16} /> {torchOn ? 'Apagar luz' : 'Encender luz'}
            </button>
          )}
        </div>
      )}

      {cameras.length > 1 && (
        <p className={styles.cameraTip}>Si no enfoca, probá otra cámara de la lista.</p>
      )}

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

      <p className={styles.source}>Información provista por Open Food Facts.</p>
    </div>
  );
};

export default BarcodeScanner;
