import React, { useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import IngredientPicker from '../meals/IngredientPicker';
import styles from './IngredientForm.module.css';

const roundMacro = (value) => Math.round((Number(value) || 0) * 10) / 10;

const getIngredientFactor = (ingredient, quantity) => (
  ingredient.measureType === 'per_serving'
    ? Number(quantity) || 0
    : (Number(quantity) || 0) / 100
);

const calculateRecipeTotals = (items) => items.reduce((totals, item) => {
  const factor = getIngredientFactor(item.ingredient, item.quantity);
  return {
    kcal: totals.kcal + (Number(item.ingredient.kcal) || 0) * factor,
    protein: totals.protein + (Number(item.ingredient.protein) || 0) * factor,
    carbs: totals.carbs + (Number(item.ingredient.carbs) || 0) * factor,
    fat: totals.fat + (Number(item.ingredient.fat) || 0) * factor
  };
}, { kcal: 0, protein: 0, carbs: 0, fat: 0 });

const buildInitialItems = (initialData, allIngredients) => (
  (initialData?.recipeItems || []).map((item) => {
    const ingredient = allIngredients.find((ing) => ing.id === item.ingredientId) || item.ingredient;
    if (!ingredient) return null;

    return {
      instanceId: crypto.randomUUID(),
      ingredient,
      ingredientId: ingredient.id,
      quantity: item.quantity
    };
  }).filter(Boolean)
);

const RecipeForm = ({ onSubmit, initialData, allIngredients, isSaving = false }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [measureType, setMeasureType] = useState(initialData?.measureType || 'per_100g');
  const [yieldGrams, setYieldGrams] = useState(initialData?.recipeMeta?.yieldGrams || (initialData?.measureType === 'per_100g' ? 100 : ''));
  const [servings, setServings] = useState(initialData?.recipeMeta?.servings || (initialData?.measureType === 'per_serving' ? 1 : ''));
  const [servingLabel, setServingLabel] = useState(initialData?.servingLabel || '1 porción');
  const [isPublic, setIsPublic] = useState(initialData?.isPublic ?? true);
  const [items, setItems] = useState(() => buildInitialItems(initialData, allIngredients));
  const [isPicking, setIsPicking] = useState(false);
  const [saveError, setSaveError] = useState('');
  const submitLockRef = useRef(false);

  const totals = useMemo(() => calculateRecipeTotals(items), [items]);
  const divisor = measureType === 'per_serving'
    ? Math.max(Number(servings) || 0, 0)
    : Math.max((Number(yieldGrams) || 0) / 100, 0);
  const normalized = divisor > 0 ? {
    kcal: Math.round(totals.kcal / divisor),
    protein: roundMacro(totals.protein / divisor),
    carbs: roundMacro(totals.carbs / divisor),
    fat: roundMacro(totals.fat / divisor)
  } : { kcal: 0, protein: 0, carbs: 0, fat: 0 };

  const addItem = (ingredient) => {
    setItems((current) => [
      ...current,
      {
        instanceId: crypto.randomUUID(),
        ingredient,
        ingredientId: ingredient.id,
        quantity: ingredient.measureType === 'per_serving' ? 1 : 100
      }
    ]);
    setIsPicking(false);
  };

  const updateQuantity = (instanceId, quantity) => {
    setItems((current) => current.map((item) => (
      item.instanceId === instanceId ? { ...item, quantity } : item
    )));
  };

  const removeItem = (instanceId) => {
    setItems((current) => current.filter((item) => item.instanceId !== instanceId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitLockRef.current || isSaving) return;
    if (!name.trim() || items.length === 0 || divisor <= 0) return;

    submitLockRef.current = true;
    setSaveError('');

    try {
      await onSubmit({
        name: name.trim(),
        measureType,
        servingLabel: measureType === 'per_serving' ? servingLabel : '',
        kcal: normalized.kcal,
        protein: normalized.protein,
        carbs: normalized.carbs,
        fat: normalized.fat,
        isPublic,
        sourceType: 'recipe',
        recipeMeta: {
          yieldGrams: measureType === 'per_100g' ? Number(yieldGrams) || 0 : null,
          servings: measureType === 'per_serving' ? Number(servings) || 0 : null
        },
        recipeItems: items.map(({ ingredientId, quantity, ingredient }) => ({
          ingredientId,
          quantity: Number(quantity) || 0,
          ingredient: {
            id: ingredient.id,
            name: ingredient.name,
            measureType: ingredient.measureType,
            kcal: ingredient.kcal,
            protein: ingredient.protein,
            carbs: ingredient.carbs,
            fat: ingredient.fat,
            servingLabel: ingredient.servingLabel
          }
        }))
      });
    } catch {
      setSaveError('No pude guardar la receta. Revisá la conexión e intentá de nuevo.');
      submitLockRef.current = false;
    }
  };

  if (isPicking) {
    return <IngredientPicker onSelect={addItem} onCancel={() => setIsPicking(false)} />;
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.inputGroup}>
        <label className={styles.label}>Nombre de la receta</label>
        <input
          className={styles.input}
          value={name}
          disabled={isSaving}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Batido de banana"
          required
        />
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label}>Tipo de receta</label>
        <div className={styles.toggleGroup}>
          <button
            type="button"
            className={`${styles.toggle} ${measureType === 'per_100g' ? styles.active : ''}`}
            disabled={isSaving}
            onClick={() => setMeasureType('per_100g')}
          >
            Por 100g/ml
          </button>
          <button
            type="button"
            className={`${styles.toggle} ${measureType === 'per_serving' ? styles.active : ''}`}
            disabled={isSaving}
            onClick={() => setMeasureType('per_serving')}
          >
            Por unidad
          </button>
        </div>
      </div>

      {measureType === 'per_100g' ? (
        <div className={styles.inputGroup}>
          <label className={styles.label}>Peso final total (g/ml)</label>
          <input
            className={styles.input}
            type="number"
            min="0"
            step="0.1"
            value={yieldGrams}
            disabled={isSaving}
            onChange={(e) => setYieldGrams(e.target.value)}
            required
          />
        </div>
      ) : (
        <div className={styles.macrosGrid}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Unidades finales</label>
            <input
              className={styles.input}
              type="number"
              min="0"
              step="0.1"
              value={servings}
              disabled={isSaving}
              onChange={(e) => setServings(e.target.value)}
              required
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Etiqueta</label>
            <input
              className={styles.input}
              value={servingLabel}
              disabled={isSaving}
              onChange={(e) => setServingLabel(e.target.value)}
              placeholder="Ej: 1 vaso"
            />
          </div>
        </div>
      )}

      <div className={styles.recipeBox}>
        <div className={styles.recipeHeader}>
          <span>Ingredientes de la receta</span>
          <button type="button" className={styles.smallBtn} disabled={isSaving} onClick={() => setIsPicking(true)}>
            <Plus size={16} />
            Añadir
          </button>
        </div>

        {items.length > 0 ? items.map((item) => (
          <div key={item.instanceId} className={styles.recipeRow}>
            <div className={styles.recipeInfo}>
              <strong>{item.ingredient.name}</strong>
              <span>{Math.round((Number(item.ingredient.kcal) || 0) * getIngredientFactor(item.ingredient, item.quantity))} kcal</span>
            </div>
            <div className={styles.recipeQty}>
              <input
                className={styles.input}
                type="number"
                min="0"
                step="0.1"
                value={item.quantity}
                disabled={isSaving}
                onChange={(e) => updateQuantity(item.instanceId, e.target.value)}
              />
              <span>{item.ingredient.measureType === 'per_serving' ? 'ud' : 'g'}</span>
              <button type="button" className={styles.iconBtn} disabled={isSaving} onClick={() => removeItem(item.instanceId)}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        )) : (
          <div className={styles.emptyRecipe}>Añadí ingredientes para calcular macros.</div>
        )}
      </div>

      <div className={styles.recipeSummary}>
        <span>{measureType === 'per_serving' ? 'Por unidad' : 'Por 100g/ml'}</span>
        <strong>{normalized.kcal} kcal</strong>
        <span>P {normalized.protein}g</span>
        <span>C {normalized.carbs}g</span>
        <span>G {normalized.fat}g</span>
      </div>

      <div className={styles.checkboxGroup}>
        <input
          type="checkbox"
          id="recipeIsPublic"
          checked={isPublic}
          disabled={isSaving}
          onChange={(e) => setIsPublic(e.target.checked)}
          className={styles.checkbox}
        />
        <label htmlFor="recipeIsPublic" className={styles.checkboxLabel}>
          Compartir con la comunidad
        </label>
      </div>

      {saveError && <div className={styles.errorText}>{saveError}</div>}

      <button type="submit" className={styles.submitBtn} disabled={isSaving || !name.trim() || items.length === 0 || divisor <= 0}>
        {isSaving ? 'Guardando...' : 'Guardar Receta'}
      </button>
    </form>
  );
};

export default RecipeForm;
