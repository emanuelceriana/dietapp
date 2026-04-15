import { useCallback, useEffect, useState } from 'react';
import { subDays, startOfDay } from 'date-fns';
import { formatDate } from '../utils/dates';
import { apiFetch } from '../lib/api';
import { useIngredients } from './useIngredients';

export function useStats(daysCount = 7) {
  const { ingredients, isLoading: ingLoading } = useIngredients();
  const [stats, setStats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (ingLoading) return;
    
    setIsLoading(true);
    try {
      const today = startOfDay(new Date());
      const data = [];

      // Fetch all entries in parallel for better performance
      const promises = [];
      for (let i = daysCount - 1; i >= 0; i--) {
        const date = subDays(today, i);
        const dateStr = formatDate(date);
        promises.push(apiFetch(`/entries/${dateStr}`).then(entry => ({ date, dateStr, entry, i })));
      }

      const results = await Promise.all(promises);

      results.forEach(({ date, dateStr, entry, i }) => {
        let kcal = 0;
        let protein = 0;
        let carbs = 0;
        let fat = 0;

        if (entry && entry.meals && ingredients) {
          entry.meals.forEach(meal => {
            meal.items.forEach(item => {
              const ing = ingredients.find(ing => ing.id === item.ingredientId) || item.ingredient;
              if (ing) {
                const factor = ing.measureType === 'per_serving' ? item.quantity : item.quantity / 100;
                kcal += (Number(ing.kcal) || 0) * factor;
                protein += (Number(ing.protein) || 0) * factor;
                carbs += (Number(ing.carbs) || 0) * factor;
                fat += (Number(ing.fat) || 0) * factor;
              }
            });
          });
        }

        data.push({
          date: dateStr,
          displayDate: i === 0 ? 'Hoy' : date.toLocaleDateString('es-ES', { weekday: 'short' }),
          kcal: Math.round(kcal),
          protein: Math.round(protein),
          carbs: Math.round(carbs),
          fat: Math.round(fat)
        });
      });

      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setIsLoading(false);
    }
  }, [daysCount, ingLoading, ingredients]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    data: stats,
    isLoading: isLoading || ingLoading
  };
}
