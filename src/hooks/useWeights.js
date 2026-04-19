import { useState, useEffect, useCallback } from 'react';
import { 
  startOfWeek, endOfWeek, 
  startOfMonth, endOfMonth, 
  startOfYear, endOfYear,
  parseISO
} from 'date-fns';
import { apiFetch, getApiCache, setApiCache } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const WEIGHTS_CACHE_TTL_MS = 15 * 60 * 1000;
const WEIGHTS_ENDPOINT = '/weights';

export function useWeights() {
  const { user } = useAuth();
  const cachedWeights = getApiCache(user?.id, WEIGHTS_ENDPOINT, WEIGHTS_CACHE_TTL_MS);
  const [weights, setWeights] = useState(() => cachedWeights || []);
  const [isLoading, setIsLoading] = useState(() => !cachedWeights);

  const fetchWeights = useCallback(async () => {
    const cached = getApiCache(user?.id, WEIGHTS_ENDPOINT, WEIGHTS_CACHE_TTL_MS);
    if (cached) {
      setWeights(cached);
      setIsLoading(false);
      return cached;
    }

    setIsLoading(true);
    try {
      const data = await apiFetch(WEIGHTS_ENDPOINT, { cacheTtlMs: WEIGHTS_CACHE_TTL_MS });
      setWeights(data);
      return data;
    } catch (err) {
      console.error('Error fetching weights:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

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
          setApiCache(user?.id, WEIGHTS_ENDPOINT, updated);
          return updated;
        }
        const updated = [newWeight, ...prev].sort((a, b) => new Date(b.date) - new Date(a.date));
        setApiCache(user?.id, WEIGHTS_ENDPOINT, updated);
        return updated;
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
      setWeights(prev => {
        const updated = prev.filter(w => w.id !== id);
        setApiCache(user?.id, WEIGHTS_ENDPOINT, updated);
        return updated;
      });
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
