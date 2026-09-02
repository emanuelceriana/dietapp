import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, ImagePlus, RotateCcw, ScanText, X } from 'lucide-react';
import { canonicalizeBarcode, isValidProductBarcode, normalizeBarcode } from '../../lib/barcodes';
import { analyzeNutritionLabel } from '../../lib/nutritionLabelAi';
import styles from './NutritionLabelScanner.module.css';

const EMPTY_FORM = {
  name: '',
  kcal: '',
  protein: '',
  carbs: '',
  fat: ''
};

const CAMERA_QUALITY = {
  width: { ideal: 1920 },
  height: { ideal: 1080 }
};

const CAMERA_CONSTRAINTS = [
  {
    audio: false,
    video: {
      facingMode: { exact: 'environment' },
      ...CAMERA_QUALITY
    }
  },
  {
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      ...CAMERA_QUALITY
    }
  },
  { audio: false, video: true }
];

const stopMediaStream = (stream) => {
  stream?.getTracks?.().forEach((track) => track.stop());
};

const cameraErrorMessage = (cameraError) => {
  if (cameraError?.name === 'NotAllowedError') {
    return 'El permiso de cámara está bloqueado.';
  }
  if (cameraError?.name === 'NotReadableError') {
    return 'La cámara está siendo usada por otra aplicación.';
  }
  if (['NotFoundError', 'OverconstrainedError'].includes(cameraError?.name)) {
    return 'No encontré una cámara disponible.';
  }
  return 'No pude abrir la cámara.';
};

const numericValue = (value) => {
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const NutritionLabelScanner = ({ barcode = '', onAddIngredient, onSelect, onBack, onCancel }) => {
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const previewUrlRef = useRef('');
  const requestRef = useRef(0);
  const mountedRef = useRef(true);

  const [previewUrl, setPreviewUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState(null);
  const [hasPer100Reference, setHasPer100Reference] = useState(true);
  const [readWarning, setReadWarning] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('starting');
  const [cameraError, setCameraError] = useState('');
  const [cameraAttempt, setCameraAttempt] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (previewUrl) return undefined;

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('error');
      setCameraError('Este navegador no permite usar la cámara.');
      return undefined;
    }

    let cancelled = false;
    let activeStream;
    let activeVideo;

    setCameraStatus('starting');
    setCameraError('');

    const openCamera = async () => {
      let lastError;

      for (const constraints of CAMERA_CONSTRAINTS) {
        try {
          return await navigator.mediaDevices.getUserMedia(constraints);
        } catch (nextError) {
          lastError = nextError;
          if (['NotAllowedError', 'NotReadableError', 'SecurityError'].includes(nextError?.name)) break;
        }
      }

      throw lastError || new Error('No pude abrir la cámara.');
    };

    const startCamera = async () => {
      try {
        const stream = await openCamera();
        if (cancelled) {
          stopMediaStream(stream);
          return;
        }

        const video = videoRef.current;
        if (!video) {
          stopMediaStream(stream);
          return;
        }

        activeStream = stream;
        activeVideo = video;
        streamRef.current = stream;
        video.srcObject = stream;
        video.muted = true;
        video.setAttribute('playsinline', '');
        await video.play();

        if (cancelled) {
          stopMediaStream(stream);
          return;
        }

        const track = stream.getVideoTracks()[0];
        try {
          const capabilities = track?.getCapabilities?.();
          if (capabilities?.focusMode?.includes('continuous')) {
            await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
          }
        } catch {
          // Continuous focus is optional and not available on every browser.
        }

        setCameraStatus('ready');
      } catch (nextError) {
        if (!cancelled) {
          setCameraStatus('error');
          setCameraError(cameraErrorMessage(nextError));
        }
      }
    };

    // Avoid opening two competing streams during React StrictMode's development remount.
    const cameraStartTimer = window.setTimeout(() => { void startCamera(); }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(cameraStartTimer);
      stopMediaStream(activeStream);
      if (streamRef.current === activeStream) streamRef.current = null;
      if (activeVideo?.srcObject === activeStream) activeVideo.srcObject = null;
    };
  }, [cameraAttempt, previewUrl]);

  const replacePreview = (file) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextUrl = URL.createObjectURL(file);
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
    return nextUrl;
  };

  const processPhoto = async (file) => {
    if (!file) return;

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setFormData(null);
    setReadWarning('');
    setError('');
    setIsProcessing(true);
    replacePreview(file);

    try {
      const parsed = await analyzeNutritionLabel(file);
      if (!mountedRef.current || requestRef.current !== requestId) return;

      setFormData({
        ...EMPTY_FORM,
        name: parsed.name || '',
        kcal: parsed.kcal ?? '',
        protein: parsed.protein ?? '',
        carbs: parsed.carbs ?? '',
        fat: parsed.fat ?? ''
      });
      setHasPer100Reference(['per_100g', 'per_100ml'].includes(parsed.reference));

      const detectedCount = [parsed.kcal, parsed.protein, parsed.carbs, parsed.fat]
        .filter((value) => value !== null && value !== undefined).length;
      if (detectedCount === 0) {
        setReadWarning('La IA no pudo leer los valores. Podés completarlos manualmente o sacar otra foto.');
      } else if (detectedCount < 4) {
        setReadWarning('La IA no pudo leer algunos valores. Completalos antes de guardar.');
      }
    } catch (processingError) {
      if (mountedRef.current && requestRef.current === requestId) {
        setError(processingError?.message || 'No pude leer la tabla. Probá con otra foto.');
      }
    } finally {
      if (mountedRef.current && requestRef.current === requestId) {
        setIsProcessing(false);
      }
    }
  };

  const handleFileChange = (event) => {
    const [file] = event.target.files || [];
    event.target.value = '';
    if (!file) return;
    if (file.type && !file.type.startsWith('image/')) {
      setError('Elegí una imagen de la tabla nutricional.');
      return;
    }
    void processPhoto(file);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || cameraStatus !== 'ready' || !video.videoWidth || !video.videoHeight) {
      setCameraError('La cámara todavía no está lista. Esperá un momento.');
      return;
    }

    setCameraError('');
    setCameraStatus('capturing');

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraStatus('ready');
        setCameraError('No pude capturar la foto. Probá nuevamente.');
        return;
      }

      const photo = new File([blob], `tabla-nutricional-${Date.now()}.jpg`, { type: 'image/jpeg' });
      void processPhoto(photo);
    }, 'image/jpeg', 0.92);
  };

  const updateField = (event) => {
    const { name, value } = event.target;
    setError('');
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData || isSaving) return;

    const nutrients = ['kcal', 'protein', 'carbs', 'fat']
      .map((field) => [field, numericValue(formData[field])]);
    if (!formData.name.trim() || nutrients.some(([, value]) => value === null)) {
      setError('Completá el nombre y los cuatro valores antes de guardar.');
      return;
    }

    setError('');
    setIsSaving(true);
    try {
      const normalizedBarcode = normalizeBarcode(barcode);
      const ingredient = await onAddIngredient({
        name: formData.name.trim(),
        barcode: isValidProductBarcode(normalizedBarcode) ? canonicalizeBarcode(normalizedBarcode) : '',
        measureType: 'per_100g',
        servingLabel: '',
        kcal: nutrients.find(([field]) => field === 'kcal')[1],
        protein: nutrients.find(([field]) => field === 'protein')[1],
        carbs: nutrients.find(([field]) => field === 'carbs')[1],
        fat: nutrients.find(([field]) => field === 'fat')[1],
        isPublic: false,
        sourceType: 'ingredient'
      });
      onSelect(ingredient);
    } catch (saveError) {
      setError(saveError?.message || 'No pude guardar el ingrediente.');
      setIsSaving(false);
    }
  };

  const takeAnotherPhoto = () => {
    requestRef.current += 1;
    setFormData(null);
    setReadWarning('');
    setError('');
    setCameraError('');
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = '';
    setPreviewUrl('');
    setCameraAttempt((current) => current + 1);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button type="button" onClick={onBack} aria-label="Volver al código de barras">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h3>Escanear tabla nutricional</h3>
          <p>Valores por 100 g</p>
        </div>
        <button type="button" onClick={onCancel} aria-label="Cerrar escáner">
          <X size={20} />
        </button>
      </div>

      <input
        ref={fileInputRef}
        className={styles.fileInput}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
      />

      {!previewUrl && (
        <div className={styles.captureView}>
          <div className={styles.cameraFrame}>
            <video ref={videoRef} autoPlay muted playsInline />
            <div className={styles.cameraGuide} aria-hidden="true" />
            {cameraStatus === 'starting' && (
              <div className={styles.cameraOverlay}>
                <Camera size={27} />
                <span>Abriendo cámara...</span>
              </div>
            )}
          </div>
          <div>
            <h4>Fotografiá solamente la tabla</h4>
            <p>Buscá buena luz, mantené el envase recto y asegurate de incluir la columna por 100 g.</p>
          </div>
          {cameraStatus !== 'error' ? (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={capturePhoto}
              disabled={cameraStatus !== 'ready'}
            >
              <Camera size={19} /> {cameraStatus === 'capturing' ? 'Capturando...' : 'Tomar foto'}
            </button>
          ) : (
            <div className={styles.cameraFallback}>
              <div className={styles.error} role="alert">{cameraError}</div>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setCameraAttempt((current) => current + 1)}
              >
                <RotateCcw size={17} /> Reintentar cámara
              </button>
              <button type="button" className={styles.secondaryButton} onClick={() => fileInputRef.current?.click()}>
                <ImagePlus size={17} /> Elegir una imagen
              </button>
            </div>
          )}
          {cameraError && cameraStatus !== 'error' && (
            <div className={styles.error} role="alert">{cameraError}</div>
          )}
        </div>
      )}

      {previewUrl && (
        <div className={styles.previewFrame}>
          <img src={previewUrl} alt="Tabla nutricional fotografiada" />
          {isProcessing && (
            <div className={styles.processingOverlay}>
              <ScanText size={30} />
              <strong>Analizando tabla con IA...</strong>
              <small>Puede tardar unos segundos</small>
            </div>
          )}
        </div>
      )}

      {formData && !isProcessing && (
        <form className={styles.reviewForm} onSubmit={handleSubmit}>
          <div className={styles.reviewHeading}>
            <div>
              <h4>Revisá los datos</h4>
              <p>Corregí cualquier lectura incorrecta antes de guardar.</p>
            </div>
            <button type="button" onClick={takeAnotherPhoto} disabled={isSaving}>
              <RotateCcw size={15} /> Otra foto
            </button>
          </div>

          {(!hasPer100Reference || readWarning) && (
            <div className={styles.warning} role="status">
              {!hasPer100Reference
                ? 'No pude confirmar que la tabla sea por 100 g. Verificala antes de guardar.'
                : readWarning}
            </div>
          )}

          <label className={styles.nameField}>
            <span>Nombre del producto</span>
            <input
              name="name"
              value={formData.name}
              onChange={updateField}
              placeholder="Ej: Salsa de tomate"
              autoComplete="off"
              disabled={isSaving}
              required
            />
          </label>

          <div className={styles.nutrientsGrid}>
            {[
              ['kcal', 'Calorías', 'kcal'],
              ['protein', 'Proteínas', 'g'],
              ['carbs', 'Carbohidratos', 'g'],
              ['fat', 'Grasas', 'g']
            ].map(([field, label, unit]) => (
              <label key={field}>
                <span>{label}</span>
                <div>
                  <input
                    name={field}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    value={formData[field]}
                    onChange={updateField}
                    disabled={isSaving}
                    required
                  />
                  <small>{unit}</small>
                </div>
              </label>
            ))}
          </div>

          <button type="submit" className={styles.primaryButton} disabled={isSaving}>
            <ImagePlus size={19} /> {isSaving ? 'Guardando...' : 'Guardar y agregar al plato'}
          </button>
        </form>
      )}

      {error && <div className={styles.error} role="alert">{error}</div>}

      {previewUrl && !formData && !isProcessing && (
        <button type="button" className={styles.secondaryButton} onClick={takeAnotherPhoto}>
          <RotateCcw size={17} /> Sacar otra foto
        </button>
      )}
    </div>
  );
};

export default NutritionLabelScanner;
