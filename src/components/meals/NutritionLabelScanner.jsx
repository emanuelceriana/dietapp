import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, ImagePlus, RotateCcw, ScanText, X } from 'lucide-react';
import { canonicalizeBarcode, isValidProductBarcode, normalizeBarcode } from '../../lib/barcodes';
import { parseNutritionText } from '../../lib/nutritionOcr';
import styles from './NutritionLabelScanner.module.css';

const EMPTY_FORM = {
  name: '',
  kcal: '',
  protein: '',
  carbs: '',
  fat: ''
};

const loadImage = (url) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('No pude abrir la foto. Probá sacándola nuevamente.'));
  image.src = url;
});

const prepareImage = async (url) => {
  const image = await loadImage(url);
  const maxDimension = 2400;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, width, height);

  const pixels = context.getImageData(0, 0, width, height);
  const contrast = 35;
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let index = 0; index < pixels.data.length; index += 4) {
    const gray = (pixels.data[index] * 0.299)
      + (pixels.data[index + 1] * 0.587)
      + (pixels.data[index + 2] * 0.114);
    const enhanced = Math.max(0, Math.min(255, factor * (gray - 128) + 128));
    pixels.data[index] = enhanced;
    pixels.data[index + 1] = enhanced;
    pixels.data[index + 2] = enhanced;
  }

  context.putImageData(pixels, 0, 0);
  return canvas;
};

const numericValue = (value) => {
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const NutritionLabelScanner = ({ barcode = '', onAddIngredient, onSelect, onBack, onCancel }) => {
  const fileInputRef = useRef(null);
  const workerRef = useRef(null);
  const previewUrlRef = useRef('');
  const requestRef = useRef(0);
  const mountedRef = useRef(true);

  const [previewUrl, setPreviewUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [formData, setFormData] = useState(null);
  const [hasPer100Reference, setHasPer100Reference] = useState(true);
  const [readWarning, setReadWarning] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
      void workerRef.current?.terminate();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

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
    setProgress(0);
    setIsProcessing(true);
    const imageUrl = replacePreview(file);

    let worker;
    try {
      const canvas = await prepareImage(imageUrl);
      const { createWorker, OEM } = await import('tesseract.js');
      worker = await createWorker(['eng', 'spa', 'pol'], OEM.LSTM_ONLY, {
        logger: (message) => {
          if (mountedRef.current && requestRef.current === requestId && message.status === 'recognizing text') {
            setProgress(Math.round((message.progress || 0) * 100));
          }
        }
      });
      workerRef.current = worker;

      if (!mountedRef.current || requestRef.current !== requestId) {
        await worker.terminate();
        return;
      }

      const result = await worker.recognize(canvas);
      const parsed = parseNutritionText(result.data.text);
      if (!mountedRef.current || requestRef.current !== requestId) return;

      setFormData({
        ...EMPTY_FORM,
        kcal: parsed.kcal ?? '',
        protein: parsed.protein ?? '',
        carbs: parsed.carbs ?? '',
        fat: parsed.fat ?? ''
      });
      setHasPer100Reference(parsed.hasPer100Reference);

      if (parsed.detectedCount === 0) {
        setReadWarning('No pude leer los valores. Podés completarlos manualmente o sacar otra foto.');
      } else if (parsed.detectedCount < 4) {
        setReadWarning('Algunos valores no se pudieron leer. Completalos antes de guardar.');
      }
    } catch (processingError) {
      if (mountedRef.current && requestRef.current === requestId) {
        setError(processingError?.message || 'No pude leer la tabla. Probá con otra foto.');
      }
    } finally {
      if (worker) await worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
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
    void workerRef.current?.terminate();
    workerRef.current = null;
    setFormData(null);
    setReadWarning('');
    setError('');
    setProgress(0);
    fileInputRef.current?.click();
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
        capture="environment"
        onChange={handleFileChange}
      />

      {!previewUrl && (
        <div className={styles.captureView}>
          <div className={styles.captureIcon}><ScanText size={34} /></div>
          <div>
            <h4>Fotografiá solamente la tabla</h4>
            <p>Buscá buena luz, mantené el envase recto y asegurate de incluir la columna por 100 g.</p>
          </div>
          <button type="button" className={styles.primaryButton} onClick={() => fileInputRef.current?.click()}>
            <Camera size={19} /> Tomar foto
          </button>
        </div>
      )}

      {previewUrl && (
        <div className={styles.previewFrame}>
          <img src={previewUrl} alt="Tabla nutricional fotografiada" />
          {isProcessing && (
            <div className={styles.processingOverlay}>
              <ScanText size={30} />
              <strong>Leyendo tabla...</strong>
              <div className={styles.progressTrack}>
                <span style={{ width: `${progress}%` }} />
              </div>
              <small>{progress > 0 ? `${progress}%` : 'Preparando lector'}</small>
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
