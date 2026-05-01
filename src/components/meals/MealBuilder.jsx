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

  const calculateTotalKcal = () => {
    return Math.round(selectedItems.reduce((acc, item) => {
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
      items: selectedItems.map(({ ingredientId, quantity }) => ({ ingredientId, quantity }))
    };

    try {
      if (saveAsTemplate) {
        await addTemplate(mealData);
      }

      await onSave(mealData);
    } catch (err) {
      setSaveError('No pude guardar la comida. Revisá la conexión e intentá de nuevo.');
      setIsSaving(false);
      saveLockRef.current = false;
    }
  };

  const loadTemplate = (template) => {
    setMealName(template.name);
    const newItems = template.items.map(item => {
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
          <h3 className={styles.sectionTitle}>Ingredientes</h3>
          <button className={styles.addBtn} onClick={() => setIsPicking(true)} disabled={isSaving}>
            <Plus size={18} />
            <span>Añadir</span>
          </button>
        </div>

        <div className={styles.itemList}>
          {selectedItems.map((item) => (
            <div key={item.instanceId} className={styles.itemRow}>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>{item.name}</span>
                <span className={styles.itemMacros}>
                  {Math.round(item.kcal * (item.measureType === 'per_serving' ? item.quantity : item.quantity / 100))} kcal
                </span>
              </div>
              
              <div className={styles.qtyControl}>
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
