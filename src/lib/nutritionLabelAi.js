import { supabase } from './supabase';

const MAX_IMAGE_DIMENSION = 2048;

const loadImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();

  image.onload = () => {
    URL.revokeObjectURL(url);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error('No pude abrir la foto. Probá sacándola nuevamente.'));
  };
  image.src = url;
});

const canvasToJpeg = (canvas) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error('No pude preparar la foto para analizarla.'));
  }, 'image/jpeg', 0.9);
});

const bytesToBase64 = (bytes) => {
  let binary = '';
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return window.btoa(binary);
};

const prepareImage = async (file) => {
  const image = await loadImage(file);
  const scale = Math.min(
    1,
    MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight)
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const jpeg = await canvasToJpeg(canvas);
  const bytes = new Uint8Array(await jpeg.arrayBuffer());
  return {
    imageBase64: bytesToBase64(bytes),
    mimeType: 'image/jpeg'
  };
};

const functionErrorMessage = async (functionError) => {
  try {
    const payload = await functionError?.context?.json?.();
    if (payload?.error) return payload.error;
  } catch {
    // Fall back to the client error below when the response is not JSON.
  }

  return functionError?.message || 'No pude analizar la tabla nutricional.';
};

export const analyzeNutritionLabel = async (file) => {
  if (!supabase) throw new Error('Supabase no está configurado.');

  const image = await prepareImage(file);
  const { data, error } = await supabase.functions.invoke('analyze-nutrition-label', {
    body: image
  });

  if (error) throw new Error(await functionErrorMessage(error));
  if (!data?.nutrition || typeof data.nutrition !== 'object') {
    throw new Error('Gemini devolvió una respuesta inválida. Probá con otra foto.');
  }

  return data.nutrition;
};
