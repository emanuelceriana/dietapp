import React, { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Barcode, Layout, Plus, Save, Trash2, X } from 'lucide-react';
import IngredientPicker from './IngredientPicker';
import { useTemplates } from '../../hooks/useTemplates';
import { clearMealDraft, hasMealDraftContent, readMealDraft, writeMealDraft } from '../../lib/mealDrafts';
import styles from './MealBuilder.module.css';

const BarcodeScanner = lazy(() => import('./BarcodeScanner'));

const EMPTY_MANUAL_ITEM = {
  name: '',
  kcal: '',
  protein: '',
  carbs: '',
  fat: ''
};

const instanceId = () => crypto.randomUUID();

const itemQuantity = (item, ingredient) => {
  const quantity = Number(item.quantity);
  if (Number.isFinite(quantity)) return quantity;
  return ingredient.measureType === 'per_serving' ? 1 : 100;
};

const hydrateItems = (items = [], allIngredients = []) => (
  items.map((item) => {
    if (item.type === 'manual') {
      return { ...item, instanceId: instanceId() };
    }

    const ing = allIngredients.find((ingredient) => ingredient.id === item.ingredientId)
      || item.ingredient
      || item;
    return {
      ...ing,
      ingredientId: item.ingredientId || item.id,
      quantity: itemQuantity(item, ing),
      instanceId: instanceId()
    };
  }).filter((item) => Boolean(item.name))
);

const stateFromMeal = (initialMeal, allIngredients) => ({
  mealName: initialMeal?.name || '',
  selectedItems: hydrateItems(initialMeal?.items, allIngredients),
  manualItem: EMPTY_MANUAL_ITEM,
  saveAsTemplate: false,
  restored: false
});

const getInitialState = (baseState, allIngredients, draftKey) => {
  const draft = readMealDraft(draftKey);
  if (!hasMealDraftContent(draft)) return baseState;

  return {
    mealName: draft.mealName,
    selectedItems: hydrateItems(draft.selectedItems, allIngredients),
    manualItem: { ...EMPTY_MANUAL_ITEM, ...draft.manualItem },
    saveAsTemplate: Boolean(draft.saveAsTemplate),
    restored: true
  };
};

const draftSignature = (state) => JSON.stringify({
  mealName: state.mealName,
  selectedItems: state.selectedItems.map((item) => item.type === 'manual'
    ? {
        type: 'manual',
        name: item.name,
        kcal: item.kcal,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat
      }
    : {
        ingredientId: item.ingredientId,
        quantity: item.quantity
      }),
  manualItem: state.manualItem,
  saveAsTemplate: state.saveAsTemplate
});

const MealBuilder = ({ onSave, onAddIngredient, initialMeal, allIngredients = [], draftKey }) => {
  const [startingState] = useState(() => {
    const baseState = stateFromMeal(initialMeal, allIngredients);
    return {
      baseState,
      initialState: getInitialState(baseState, allIngredients, draftKey)
    };
  });
  const { baseState, initialState } = startingState;
  const baseDraftSignature = draftSignature(baseState);
  const [mealName, setMealName] = useState(initialState.mealName);
  const [selectedItems, setSelectedItems] = useState(initialState.selectedItems);
  const [draftRestored, setDraftRestored] = useState(initialState.restored);
  const [scanNotice, setScanNotice] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [manualItem, setManualItem] = useState(initialState.manualItem);
  const [isShowingTemplates, setIsShowingTemplates] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(initialState.saveAsTemplate);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const saveLockRef = useRef(false);
  const clearDraftOnUnmountRef = useRef(false);
  const latestDraftRef = useRef(null);

  useLayoutEffect(() => {
    const nextDraft = { mealName, selectedItems, manualItem, saveAsTemplate };
    const hasChanges = draftSignature(nextDraft) !== baseDraftSignature;
    latestDraftRef.current = { draft: nextDraft, hasChanges };
    if (clearDraftOnUnmountRef.current) return;

    if (hasChanges) {
      writeMealDraft(draftKey, nextDraft);
    } else {
      clearMealDraft(draftKey);
    }
  }, [baseDraftSignature, draftKey, mealName, selectedItems, manualItem, saveAsTemplate]);

  useEffect(() => () => {
    if (!clearDraftOnUnmountRef.current && latestDraftRef.current?.hasChanges) {
      writeMealDraft(draftKey, latestDraftRef.current.draft);
    }
  }, [draftKey]);

  const { templates, addTemplate, deleteTemplate } = useTemplates();

  const addItem = (ingredient) => {
    const alreadyInMeal = selectedItems.some((item) => item.ingredientId === ingredient.id);
    if (!alreadyInMeal) {
      const defaultQty = ingredient.measureType === 'per_serving' ? 1 : 100;
      setSelectedItems((current) => current.some((item) => item.ingredientId === ingredient.id)
        ? current
        : [...current, {
            ...ingredient,
            ingredientId: ingredient.id,
            quantity: defaultQty,
            instanceId: instanceId()
          }]);
    }
    setIsPicking(false);
    return alreadyInMeal;
  };

  const addScannedItem = (ingredient, { existing = false } = {}) => {
    const alreadyInMeal = addItem(ingredient);
    setIsScanning(false);
    setScanNotice(alreadyInMeal
      ? `${ingredient.name} ya estaba en este plato.`
      : existing
        ? `${ingredient.name} ya estaba guardado y se agregó al plato.`
        : `${ingredient.name} se guardó en ingredientes y se agregó al plato.`);
  };

  const removeItem = (instanceId) => {
    setSelectedItems((current) => current.filter((item) => item.instanceId !== instanceId));
  };

  const updateQuantity = (instanceId, qty) => {
    setSelectedItems((current) => current.map((item) =>
      item.instanceId === instanceId ? { ...item, quantity: parseFloat(qty) || 0 } : item
    ));
  };

  const updateManualField = (field, value) => {
    setManualItem((current) => ({ ...current, [field]: value }));
  };

  const addManualItem = () => {
    const normalized = {
      type: 'manual',
      name: manualItem.name.trim() || 'Estimación manual',
      kcal: Math.max(Number(manualItem.kcal) || 0, 0),
      protein: Math.max(Number(manualItem.protein) || 0, 0),
      carbs: Math.max(Number(manualItem.carbs) || 0, 0),
      fat: Math.max(Number(manualItem.fat) || 0, 0),
      instanceId: instanceId()
    };

    if (normalized.kcal === 0 && normalized.protein === 0 && normalized.carbs === 0 && normalized.fat === 0) {
      return;
    }

    setSelectedItems((current) => [...current, normalized]);
    setManualItem({ ...EMPTY_MANUAL_ITEM });
    setIsAddingManual(false);
  };

  const calculateTotalKcal = () => {
    return Math.round(selectedItems.reduce((acc, item) => {
      if (item.type === 'manual') return acc + (Number(item.kcal) || 0);
      const factor = item.measureType === 'per_serving' ? item.quantity : item.quantity / 100;
      return acc + (item.kcal * factor);
    }, 0));
  };

  const handleSave = async () => {
    if (saveLockRef.current || isSaving || !mealName.trim() || selectedItems.length === 0) return;

    saveLockRef.current = true;
    setSaveError('');
    setIsSaving(true);
    
    const mealData = {
      name: mealName.trim(),
      items: selectedItems.map((item) => item.type === 'manual'
        ? {
            type: 'manual',
            name: item.name,
            kcal: item.kcal,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat
          }
        : {
            ingredientId: item.ingredientId,
            quantity: item.quantity
          })
    };

    try {
      if (saveAsTemplate) {
        await addTemplate(mealData);
      }

      await onSave(mealData);
      clearDraftOnUnmountRef.current = true;
      clearMealDraft(draftKey);
    } catch {
      setSaveError('No pude guardar la comida. Revisá la conexión e intentá de nuevo.');
      setIsSaving(false);
      saveLockRef.current = false;
    }
  };

  const loadTemplate = (template) => {
    setMealName(template.name);
    setSelectedItems(hydrateItems(template.items, allIngredients));
    setIsShowingTemplates(false);
  };

  const discardDraft = () => {
    clearMealDraft(draftKey);
    setMealName(baseState.mealName);
    setSelectedItems(baseState.selectedItems);
    setManualItem({ ...EMPTY_MANUAL_ITEM });
    setSaveAsTemplate(false);
    setIsAddingManual(false);
    setDraftRestored(false);
    setScanNotice('');
  };

  if (isScanning) {
    return (
      <Suspense fallback={<div className={styles.scannerLoading}>Cargando escáner...</div>}>
        <BarcodeScanner
          ingredients={allIngredients}
          onAddIngredient={onAddIngredient}
          onSelect={addScannedItem}
          onCancel={() => setIsScanning(false)}
        />
      </Suspense>
    );
  }

  if (isPicking) {
    return <IngredientPicker onSelect={addItem} onCancel={() => setIsPicking(false)} />;
  }

  if (isShowingTemplates) {
    return (
      <div className={styles.templatesView}>
        <div className={styles.pickerHeader}>
          <h3 className={styles.pickerTitle}>Mis Plantillas</h3>
          <button onClick={() => setIsShowingTemplates(false)}><X /></button>
        </div>
        <div className={styles.templateList}>
          {templates.map(tmp => (
            <div key={tmp.id} className={styles.templateItem} onClick={() => loadTemplate(tmp)}>
              <div className={styles.templateInfo}>
                <span className={styles.templateName}>{tmp.name}</span>
                <span className={styles.templateSubtitle}>{tmp.items.length} ingredientes</span>
              </div>
              <button 
                className={styles.deleteTemplateBtn} 
                onClick={(e) => { e.stopPropagation(); deleteTemplate(tmp.id); }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {templates.length === 0 && <p className={styles.emptyText}>No tienes plantillas guardadas todavía.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerActions}>
        <button
          className={styles.templateToggle}
          onClick={() => setIsShowingTemplates(true)}
          disabled={isSaving}
        >
          <Layout size={18} />
          <span>Usar Plantilla</span>
        </button>
      </div>

      <div className={styles.draftNotice} role="status">
        <Save size={16} />
        <span>
          {draftRestored
            ? 'Borrador recuperado. Los cambios siguen guardándose automáticamente.'
            : 'Borrador automático activo. Podés cerrar sin perder datos.'}
        </span>
        {draftRestored && (
          <button type="button" onClick={discardDraft} disabled={isSaving}>
            Descartar
          </button>
        )}
      </div>

      {scanNotice && (
        <div className={styles.scanNotice} role="status">
          {scanNotice}
        </div>
      )}

      <div className={styles.inputGroup}>
        <label className={styles.label}>Nombre de la comida</label>
        <input 
          className={styles.input}
          placeholder="Ej: Desayuno, Almuerzo..." 
          value={mealName}
          disabled={isSaving}
          onChange={(e) => setMealName(e.target.value)}
        />
      </div>

      <div className={styles.itemsSection}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Contenido</h3>
          <div className={styles.addActions}>
            <button
              className={styles.scanBtn}
              onClick={() => {
                setScanNotice('');
                setIsScanning(true);
              }}
              disabled={isSaving || !onAddIngredient}
            >
              <Barcode size={18} />
              <span>Escanear</span>
            </button>
            <button
              className={styles.manualBtn}
              onClick={() => setIsAddingManual((current) => !current)}
              disabled={isSaving}
            >
              <Plus size={18} />
              <span>Estimación</span>
            </button>
            <button className={styles.addBtn} onClick={() => setIsPicking(true)} disabled={isSaving}>
              <Plus size={18} />
              <span>Ingrediente</span>
            </button>
          </div>
        </div>

        {isAddingManual && (
          <div className={styles.manualForm}>
            <div className={styles.manualHeader}>
              <div>
                <strong>Agregar estimación</strong>
                <span>No se guarda como ingrediente</span>
              </div>
              <button
                className={styles.closeManualBtn}
                onClick={() => setIsAddingManual(false)}
                aria-label="Cerrar estimación"
              >
                <X size={18} />
              </button>
            </div>

            <input
              className={styles.input}
              placeholder="Descripción opcional (ej: pizza)"
              value={manualItem.name}
              disabled={isSaving}
              onChange={(event) => updateManualField('name', event.target.value)}
            />

            <div className={styles.manualGrid}>
              {[
                ['kcal', 'Calorías', 'kcal'],
                ['protein', 'Proteína', 'g'],
                ['carbs', 'Carbos', 'g'],
                ['fat', 'Grasas', 'g']
              ].map(([field, label, unit]) => (
                <label key={field} className={styles.manualField}>
                  <span>{label}</span>
                  <div>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={manualItem[field]}
                      disabled={isSaving}
                      onChange={(event) => updateManualField(field, event.target.value)}
                    />
                    <small>{unit}</small>
                  </div>
                </label>
              ))}
            </div>

            <button
              className={styles.addManualBtn}
              onClick={addManualItem}
              disabled={isSaving}
            >
              Agregar al plato
            </button>
          </div>
        )}

        <div className={styles.itemList}>
          {selectedItems.map((item) => (
            <div key={item.instanceId} className={styles.itemRow}>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>{item.name}</span>
                <span className={styles.itemMacros}>
                  {item.type === 'manual'
                    ? `${Math.round(Number(item.kcal) || 0)} kcal · P ${Number(item.protein) || 0}g · C ${Number(item.carbs) || 0}g · G ${Number(item.fat) || 0}g`
                    : `${Math.round(item.kcal * (item.measureType === 'per_serving' ? item.quantity : item.quantity / 100))} kcal`}
                </span>
              </div>
              
              <div className={styles.qtyControl}>
                {item.type !== 'manual' && (
                  <>
                    <input
                      type="number"
                      className={styles.qtyInput}
                      value={item.quantity}
                      disabled={isSaving}
                      onChange={(e) => updateQuantity(item.instanceId, e.target.value)}
                    />
                    <span className={styles.unit}>
                      {item.measureType === 'per_serving' ? 'ud' : 'g'}
                    </span>
                  </>
                )}
                <button className={styles.removeBtn} onClick={() => removeItem(item.instanceId)} disabled={isSaving}>
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          
          {selectedItems.length === 0 && (
            <div className={styles.emptyItems}>
              No has añadido ingredientes todavía
            </div>
          )}
        </div>
      </div>

      <div className={styles.options}>
        <label className={styles.checkboxLabel}>
          <input 
            type="checkbox" 
            checked={saveAsTemplate}
            disabled={isSaving}
            onChange={(e) => setSaveAsTemplate(e.target.checked)} 
          />
          <span>Guardar como plantilla reutilizable</span>
        </label>
      </div>

      <div className={styles.footer}>
        {saveError && <div className={styles.errorText}>{saveError}</div>}
        <div className={styles.summary}>
          <span className={styles.totalLabel}>Total:</span>
          <span className={styles.totalValue}>{calculateTotalKcal()} kcal</span>
        </div>
        <button 
          className={styles.saveBtn} 
          disabled={isSaving || !mealName.trim() || selectedItems.length === 0}
          onClick={handleSave}
        >
          {isSaving ? 'Guardando...' : 'Guardar Comida'}
        </button>
      </div>
    </div>
  );
};

export default MealBuilder;
