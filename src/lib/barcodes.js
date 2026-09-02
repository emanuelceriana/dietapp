const OPEN_FOOD_FACTS_URL = 'https://world.openfoodfacts.org/api/v2/product';

export const normalizeBarcode = (value) => String(value || '').replace(/\D/g, '');

export const isValidProductBarcode = (value) => /^\d{8,14}$/.test(normalizeBarcode(value));

export const canonicalizeBarcode = (value) => normalizeBarcode(value).padStart(14, '0');

const nutrientValue = (nutriments, key) => {
  const value = Number(nutriments?.[key]);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

const roundNutrient = (value) => Math.round(value * 10) / 10;

const buildProductName = (product, barcode) => {
  const productName = [
    product.product_name_es,
    product.product_name,
    product.generic_name_es,
    product.generic_name
  ].find((value) => typeof value === 'string' && value.trim())?.trim();
  const brand = typeof product.brands === 'string' ? product.brands.split(',')[0].trim() : '';

  if (!productName) return brand || `Producto ${barcode}`;
  if (!brand || productName.toLocaleLowerCase().includes(brand.toLocaleLowerCase())) return productName;
  return `${brand} · ${productName}`;
};

export const lookupProductByBarcode = async (value, { signal } = {}) => {
  const scannedBarcode = normalizeBarcode(value);
  if (!isValidProductBarcode(scannedBarcode)) {
    throw new Error('El código debe tener entre 8 y 14 dígitos.');
  }
  const barcode = canonicalizeBarcode(scannedBarcode);

  const fields = [
    'code',
    'product_name',
    'product_name_es',
    'generic_name',
    'generic_name_es',
    'brands',
    'nutriments'
  ].join(',');
  const url = `${OPEN_FOOD_FACTS_URL}/${encodeURIComponent(barcode)}.json?fields=${encodeURIComponent(fields)}&lc=es`;
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error('No pude consultar el producto. Revisá la conexión.');
  }

  const data = await response.json();
  if (data.status !== 1 || !data.product) {
    throw new Error('Producto no encontrado en Open Food Facts.');
  }

  const nutriments = data.product.nutriments || {};
  const energyKcal = nutrientValue(nutriments, 'energy-kcal_100g');
  const energyKj = nutrientValue(nutriments, 'energy-kj_100g')
    ?? nutrientValue(nutriments, 'energy_100g');
  const kcal = energyKcal ?? (energyKj === null ? null : energyKj / 4.184);
  const protein = nutrientValue(nutriments, 'proteins_100g');
  const carbs = nutrientValue(nutriments, 'carbohydrates_100g');
  const fat = nutrientValue(nutriments, 'fat_100g');

  if ([kcal, protein, carbs, fat].every((nutrient) => nutrient === null)) {
    throw new Error('Producto encontrado, pero no tiene información nutricional por 100 g.');
  }

  return {
    name: buildProductName(data.product, scannedBarcode),
    barcode,
    measureType: 'per_100g',
    servingLabel: '',
    kcal: roundNutrient(kcal ?? 0),
    protein: roundNutrient(protein ?? 0),
    carbs: roundNutrient(carbs ?? 0),
    fat: roundNutrient(fat ?? 0),
    isPublic: false,
    sourceType: 'ingredient'
  };
};
