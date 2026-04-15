import { ChevronRight, Scale, Package, Trash2 } from 'lucide-react';
import styles from './IngredientCard.module.css';

const IngredientCard = ({ ingredient, onClick, onDelete }) => {
  const isPerServing = ingredient.measureType === 'per_serving';

  return (
    <div className={`${styles.card} card`} onClick={() => onClick(ingredient)}>
      <div className={styles.info}>
        <h3 className={styles.name}>{ingredient.name}</h3>
        <div className={styles.meta}>
          {isPerServing ? (
            <>
              <Package size={14} />
              <span>{ingredient.servingLabel || 'Por porción'}</span>
            </>
          ) : (
            <>
              <Scale size={14} />
              <span>Por 100g/ml</span>
            </>
          )}
        </div>
      </div>
      
      <div className={styles.macros}>
        <div className={styles.macro}>
          <span className={styles.macroValue}>{Math.round(ingredient.kcal)}</span>
          <span className={styles.macroLabel}>kcal</span>
        </div>
        <div className={styles.macroDivider} />
        <div className={styles.macro}>
          <span className={styles.macroValue}>{ingredient.protein}g</span>
          <span className={styles.macroLabel}>Prot</span>
        </div>
        <div className={styles.macroDivider} />
        <div className={styles.macro}>
          <span className={styles.macroValue}>{ingredient.carbs}g</span>
          <span className={styles.macroLabel}>Carbs</span>
        </div>
        <div className={styles.macroDivider} />
        <div className={styles.macro}>
          <span className={styles.macroValue}>{ingredient.fat}g</span>
          <span className={styles.macroLabel}>Grasa</span>
        </div>
      </div>

      <div className={styles.actions}>
        <button 
          className={styles.deleteBtn}
          onClick={(e) => { e.stopPropagation(); onDelete(ingredient.id); }}
          aria-label="Borrar ingrediente"
        >
          <Trash2 size={18} />
        </button>
        <ChevronRight size={20} className={styles.arrow} />
      </div>
    </div>
  );
};

export default IngredientCard;
