import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Barcode, Camera, Keyboard, RotateCcw, X } from 'lucide-react';
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
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280 },
    height: { ideal: 720 }
  }
};

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

  useEffect(() => {
    latestPropsRef.current = { ingredients, onAddIngredient, onSelect };
  }, [ingredients, onAddIngredient, onSelect]);

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setCameraReady(false);
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

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador no permite usar la cámara. Ingresá el código manualmente.');
      return undefined;
    }

    let cancelled = false;
    const reader = new BrowserMultiFormatReader(undefined, {
      delayBetweenScanAttempts: 250,
      delayBetweenScanSuccess: 1000
    });
    reader.possibleFormats = [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E
    ];
    scanHandledRef.current = false;
    setError('');

    reader.decodeFromConstraints(CAMERA_CONSTRAINTS, videoRef.current, (result, _scanError, controls) => {
      void _scanError;
      if (!result || scanHandledRef.current) return;

      const detectedCode = normalizeBarcode(result.getText());
      if (!isValidProductBarcode(detectedCode)) return;

      scanHandledRef.current = true;
      controls.stop();
      void findOrCreateIngredient(detectedCode);
    }).then((controls) => {
      if (cancelled) {
        controls.stop();
        return;
      }
      controlsRef.current = controls;
      setCameraReady(true);
    }).catch((cameraError) => {
      if (!cancelled) setError(cameraErrorMessage(cameraError));
    });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [findOrCreateIngredient, scanSession]);

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

      <p className={styles.hint}>Alineá código de barras dentro del recuadro.</p>

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
