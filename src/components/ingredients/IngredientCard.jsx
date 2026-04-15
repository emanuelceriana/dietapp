import { ChevronRight, Scale, Package, Trash2, Users, Lock } from 'lucide-react';
import styles from './IngredientCard.module.css';

const IngredientCard = ({ ingredient, onClick, onDelete, currentUserId }) => {
  const isPerServing = ingredient.measureType === 'per_serving';
  const isOwner = ingredient.userId === currentUserId || !ingredient.userId; // !userId handles legacy or system items
  const isPublic = ingredient.isPublic;

  return (
    <div className={`${styles.card} card`} onClick={() => onClick(ingredient)}>
      <div className={styles.info}>
        <div className={styles.nameRow}>
          <h3 className={styles.name}>{ingredient.name}</h3>
          {!isOwner && <Users size={16} className={styles.communityIcon} title="Alimento de la comunidad" />}
          {isOwner && isPublic && <Users size={14} className={styles.myPublicIcon} title="Compartido con la comunidad" />}
        </div>
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
        {isOwner ? (
          <button 
            className={styles.deleteBtn}
            onClick={(e) => { e.stopPropagation(); onDelete(ingredient.id); }}
            aria-label="Borrar ingrediente"
          >
            <Trash2 size={18} />
          </button>
        ) : (
          <div className={styles.readOnlyIcon} title="Solo lectura">
            <Lock size={16} />
          </div>
        )}
        <ChevronRight size={20} className={styles.arrow} />
      </div>
    </div>
  );
};

export default IngredientCard;
