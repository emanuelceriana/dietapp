import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';
import { formatDate } from '../utils/dates';

export function useDayEntries(selectedDate) {
  const dateStr = useMemo(() => formatDate(selectedDate), [selectedDate]);
  const cacheRef = useRef(new Map());
  const requestRef = useRef(0);
  const [entry, setEntry] = useState(() => ({ date: dateStr, meals: [] }));
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchEntry = useCallback(async () => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    const cachedEntry = cacheRef.current.get(dateStr);
    if (cachedEntry) {
      setEntry(cachedEntry);
      setHasLoaded(true);
    } else {
      setEntry({ date: dateStr, meals: [] });
      setHasLoaded(false);
    }

    setIsLoading(true);
    try {
      const data = await apiFetch(`/entries/${dateStr}`);
      if (requestRef.current !== requestId) return;

      const nextEntry = { date: dateStr, meals: [], ...data };
      cacheRef.current.set(dateStr, nextEntry);
      setEntry(nextEntry);
      setHasLoaded(true);
    } catch (err) {
      if (requestRef.current !== requestId) return;
      console.error('Error fetching entry:', err);
    } finally {
      if (requestRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [dateStr]);

  useEffect(() => {
    fetchEntry();
  }, [fetchEntry]);

  const updateMeals = async (meals) => {
    const updated = await apiFetch('/entries', {
      method: 'POST',
      body: JSON.stringify({ date: dateStr, meals })
    });
    const nextEntry = { date: dateStr, meals: [], ...updated };
    cacheRef.current.set(dateStr, nextEntry);
    setEntry(nextEntry);
    setHasLoaded(true);
    return nextEntry;
  };

  const addMeal = async (meal) => {
    const currentMeals = entry?.meals || [];
    return await updateMeals([...currentMeals, { ...meal, id: crypto.randomUUID() }]);
  };

  const deleteMeal = async (mealId) => {
    const currentMeals = entry?.meals || [];
    return await updateMeals(currentMeals.filter(m => m.id !== mealId));
  };

  const updateMeal = async (mealId, updatedData) => {
    const currentMeals = entry?.meals || [];
    const newMeals = currentMeals.map(m => 
      m.id === mealId ? { ...m, ...updatedData } : m
    );
    return await updateMeals(newMeals);
  };

  return {
    entry,
    isLoading,
    hasLoaded,
    addMeal,
    updateMeals,
    deleteMeal,
    updateMeal,
    refresh: fetchEntry
  };
}

export function useAllEntryDates() {
  // This would need a specific endpoint to be efficient, 
  // but for now we can fetch all or a range if needed.
  // Implementation depends on how much data we expect.
  return new Set(); // Placeholder
}
