import { useState, useEffect, useCallback } from 'react';
import { 
  startOfWeek, endOfWeek, 
  startOfMonth, endOfMonth, 
  startOfYear, endOfYear,
  isWithinInterval, parseISO 
} from 'date-fns';
import { apiFetch } from '../lib/api';

export function useWeights() {
  const [weights, setWeights] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWeights = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch('/weights');
      setWeights(data);
    } catch (err) {
      console.error('Error fetching weights:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeights();
  }, [fetchWeights]);

  const addWeight = async (date, weightKg) => {
    try {
      const newWeight = await apiFetch('/weights', {
        method: 'POST',
        body: JSON.stringify({ date, weightKg: parseFloat(weightKg) })
      });
      
      setWeights(prev => {
        const index = prev.findIndex(w => w.date === newWeight.date);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = newWeight;
          return updated;
        }
        return [newWeight, ...prev].sort((a, b) => new Date(b.date) - new Date(a.date));
      });
      return newWeight;
    } catch (err) {
      console.error('Error adding weight:', err);
      throw err;
    }
  };

  const deleteWeight = async (id) => {
    try {
      await apiFetch(`/weights/${id}`, { method: 'DELETE' });
      setWeights(prev => prev.filter(w => w.id !== id));
    } catch (err) {
      console.error('Error deleting weight:', err);
      throw err;
    }
  };

  const getAverageForPeriod = (startDate, endDate) => {
    const periodWeights = weights.filter(w => {
      const d = parseISO(w.date);
      return d >= startDate && d <= endDate;
    });

    if (periodWeights.length === 0) return null;

    const sum = periodWeights.reduce((acc, curr) => acc + curr.weightKg, 0);
    return sum / periodWeights.length;
  };

  const getWeeklyAverages = (baseDate = new Date()) => {
    const start = startOfWeek(baseDate, { weekStartsOn: 1 });
    const end = endOfWeek(baseDate, { weekStartsOn: 1 });
    return getAverageForPeriod(start, end);
  };

  const getMonthlyAverages = (baseDate = new Date()) => {
    const start = startOfMonth(baseDate);
    const end = endOfMonth(baseDate);
    return getAverageForPeriod(start, end);
  };

  const getYearlyAverages = (baseDate = new Date()) => {
    const start = startOfYear(baseDate);
    const end = endOfYear(baseDate);
    return getAverageForPeriod(start, end);
  };

  return {
    weights,
    isLoading,
    addWeight,
    deleteWeight,
    getAverageForPeriod,
    getWeeklyAverages,
    getMonthlyAverages,
    getYearlyAverages,
    refresh: fetchWeights
  };
}
