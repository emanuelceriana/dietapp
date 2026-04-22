import React from 'react';
import { Copy, History } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { calculateMealNutrition } from '../../utils/nutrition';
import styles from './RecentMealsStrip.module.css';

const RecentMealsStrip = ({ meals, ingredients, isLoading, onUseMeal }) => {
  if (isLoading) {
    return (
      <div className={styles.loadingCard}>
        Cargando comidas recientes...
      </div>
    );
  }

  if (!meals.length) {
    return null;
  }

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Recientes</h3>
          <p className={styles.subtitle}>Repetí una comida frecuente en un toque.</p>
        </div>
      </div>

      <div className={styles.scroller}>
        {meals.map((meal) => {
          const macros = calculateMealNutrition(meal, ingredients);

          return (
            <article key={meal.signature} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.kcal}>{macros.kcal} kcal</span>
                <span className={styles.dateTag}>
                  <History size={12} />
                  {format(parseISO(meal.lastUsedAt), 'd MMM', { locale: es })}
                </span>
              </div>

              <h4 className={styles.name}>{meal.name}</h4>
              <p className={styles.meta}>
                {meal.items.length} ingredientes
              </p>

              <div className={styles.macroRow}>
                <span>P {Math.round(macros.protein)}g</span>
                <span>C {Math.round(macros.carbs)}g</span>
                <span>G {Math.round(macros.fat)}g</span>
              </div>

              <button className={styles.useBtn} onClick={() => onUseMeal(meal)}>
                <Copy size={16} />
                <span>Usar</span>
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default RecentMealsStrip;
