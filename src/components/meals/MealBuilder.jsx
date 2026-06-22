import React, { useRef, useState } from 'react';
import { Plus, Trash2, Layout, X } from 'lucide-react';
import IngredientPicker from './IngredientPicker';
import { useTemplates } from '../../hooks/useTemplates';
import styles from './MealBuilder.module.css';

const MealBuilder = ({ onSave, initialMeal, allIngredients }) => {
  const [mealName, setMealName] = useState(initialMeal?.name || '');
  const [selectedItems, setSelectedItems] = useState(() => {
    if (!initialMeal || !allIngredients) return [];
    return initialMeal.items.map(item => {
      if (item.type === 'manual') {
        return { ...item, instanceId: crypto.randomUUID() };
      }

      const ing = allIngredients.find(i => i.id === item.ingredientId) || item.ingredient;
      return {
        ...ing,
        ingredientId: item.ingredientId,
        quantity: item.quantity,
        instanceId: crypto.randomUUID()
      };
    }).filter(item => !!item.name);
  });
  const [isPicking, setIsPicking] = useState(false);
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [manualItem, setManualItem] = useState({
    name: '',
    kcal: '',
    protein: '',
    carbs: '',
    fat: ''
  });
  const [isShowingTemplates, setIsShowingTemplates] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const saveLockRef = useRef(false);
  
  const { templates, addTemplate, deleteTemplate } = useTemplates();

  const addItem = (ingredient) => {
    // Add default quantity based on measure type
    const defaultQty = ingredient.measureType === 'per_serving' ? 1 : 100;
    setSelectedItems([...selectedItems, { 
      ...ingredient, 
      ingredientId: ingredient.id, 
      quantity: defaultQty,
      instanceId: crypto.randomUUID() 
    }]);
    setIsPicking(false);
  };

  const removeItem = (instanceId) => {
    setSelectedItems(selectedItems.filter(item => item.instanceId !== instanceId));
  };

  const updateQuantity = (instanceId, qty) => {
    setSelectedItems(selectedItems.map(item => 
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
      instanceId: crypto.randomUUID()
    };

    if (normalized.kcal === 0 && normalized.protein === 0 && normalized.carbs === 0 && normalized.fat === 0) {
      return;
    }

    setSelectedItems((current) => [...current, normalized]);
    setManualItem({ name: '', kcal: '', protein: '', carbs: '', fat: '' });
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
    } catch {
      setSaveError('No pude guardar la comida. Revisá la conexión e intentá de nuevo.');
      setIsSaving(false);
      saveLockRef.current = false;
    }
  };

  const loadTemplate = (template) => {
    setMealName(template.name);
    const newItems = template.items.map(item => {
      if (item.type === 'manual') {
        return { ...item, instanceId: crypto.randomUUID() };
      }

      const ing = allIngredients.find(i => i.id === item.ingredientId) || item.ingredient;
      return {
        ...ing,
        ingredientId: item.ingredientId,
        quantity: item.quantity,
        instanceId: crypto.randomUUID()
      };
    }).filter(item => !!item.name);
    setSelectedItems(newItems);
    setIsShowingTemplates(false);
  };

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
