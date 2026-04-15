import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2, Edit2 } from 'lucide-react';
import styles from './MealCard.module.css';

const MealCard = ({ meal, ingredients, onDelete, onEdit }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const getIngredient = (item) => (
    ingredients.find(ing => ing.id === item.ingredientId) || item.ingredient
  );

  // Calculate meal totals
  const calculateMacros = () => {
    let totals = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
    
    meal.items.forEach(item => {
      const ingredient = getIngredient(item);
      if (ingredient) {
        const factor = ingredient.measureType === 'per_serving' 
          ? item.quantity 
          : item.quantity / 100;
        
        totals.kcal += (ingredient.kcal || 0) * factor;
        totals.protein += (ingredient.protein || 0) * factor;
        totals.carbs += (ingredient.carbs || 0) * factor;
        totals.fat += (ingredient.fat || 0) * factor;
      }
    });
    
    return totals;
  };

  const macros = calculateMacros();

  return (
    <div className={`${styles.card} card`}>
      <div className={styles.header} onClick={() => setIsExpanded(!isExpanded)}>
        <div className={styles.titleInfo}>
          <h3 className={styles.name}>{meal.name}</h3>
          <span className={styles.kcal}>{Math.round(macros.kcal)} kcal</span>
        </div>
        <div className={styles.actions}>
          <button 
            className={styles.actionBtn} 
            onClick={(e) => { e.stopPropagation(); onEdit(meal); }}
            aria-label="Editar"
          >
            <Edit2 size={18} />
          </button>
          <button 
            className={styles.actionBtn} 
            onClick={(e) => { e.stopPropagation(); onDelete(meal.id); }}
            aria-label="Borrar"
          >
            <Trash2 size={18} />
          </button>
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      {isExpanded && (
        <div className={styles.details}>
          <div className={styles.itemList}>
            {meal.items.map((item, idx) => {
              const ing = getIngredient(item);
              return (
                <div key={idx} className={styles.item}>
                  <span className={styles.itemName}>{ing?.name || 'Ingrediente desconocido'}</span>
                  <span className={styles.itemQty}>
                    {item.quantity}{ing?.measureType === 'per_serving' ? ' ud' : 'g'}
                  </span>
                </div>
              );
            })}
          </div>
          <div className={styles.macroSummary}>
            <div className={styles.macro}>
              <span className={styles.mValue}>{Math.round(macros.protein)}g</span>
              <span className={styles.mLabel}>Prot</span>
            </div>
            <div className={styles.mDivider} />
            <div className={styles.macro}>
              <span className={styles.mValue}>{Math.round(macros.carbs)}g</span>
              <span className={styles.mLabel}>Carbs</span>
            </div>
            <div className={styles.mDivider} />
            <div className={styles.macro}>
              <span className={styles.mValue}>{Math.round(macros.fat)}g</span>
              <span className={styles.mLabel}>Grasas</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MealCard;
