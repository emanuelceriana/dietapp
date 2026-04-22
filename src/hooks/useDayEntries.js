import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, getApiCache, invalidateApiCache, setApiCache } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/dates';
import { addDays, subDays } from 'date-fns';

const ENTRIES_CACHE_TTL_MS = 15 * 60 * 1000;

export function useDayEntries(selectedDate) {
  const { user } = useAuth();
  const dateStr = useMemo(() => formatDate(selectedDate), [selectedDate]);
  const cacheRef = useRef(new Map());
  const requestRef = useRef(0);
  const mutationQueueRef = useRef(Promise.resolve());
  const [entry, setEntry] = useState(() => ({ date: dateStr, meals: [] }));
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [pendingMutations, setPendingMutations] = useState(0);
  const emptyEntry = useMemo(() => ({ date: dateStr, meals: [] }), [dateStr]);
  const entryRef = useRef(entry);

  useEffect(() => {
    entryRef.current = entry;
  }, [entry]);

  const setVisibleEntry = useCallback((nextEntry) => {
    entryRef.current = nextEntry;
    cacheRef.current.set(dateStr, nextEntry);
    setEntry(nextEntry);
    setHasLoaded(true);
  }, [dateStr]);

  const getCurrentVisibleEntry = useCallback(() => (
    entryRef.current?.date === dateStr
      ? entryRef.current
      : cacheRef.current.get(dateStr) || emptyEntry
  ), [dateStr, emptyEntry]);

  const fetchEntry = useCallback(async () => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    const cachedEntry = cacheRef.current.get(dateStr);
    if (cachedEntry) {
      entryRef.current = cachedEntry;
      setEntry(cachedEntry);
      setHasLoaded(true);
    } else {
      entryRef.current = emptyEntry;
      setEntry(emptyEntry);
      setHasLoaded(false);
    }

    setIsLoading(true);
    try {
      const data = await apiFetch(`/entries/${dateStr}`, { cacheTtlMs: ENTRIES_CACHE_TTL_MS });
      if (requestRef.current !== requestId) return;

      const nextEntry = { date: dateStr, meals: [], ...data };
      setVisibleEntry(nextEntry);
    } catch (err) {
      if (requestRef.current !== requestId) return;
      console.error('Error fetching entry:', err);
    } finally {
      if (requestRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [dateStr, emptyEntry, setVisibleEntry]);

  useEffect(() => {
    fetchEntry();
  }, [fetchEntry]);

  const updateMeals = useCallback((mealsOrUpdater) => {
    requestRef.current += 1;
    setIsLoading(false);

    const previousEntry = getCurrentVisibleEntry();
    const previousMeals = previousEntry?.meals || [];
    const nextMeals = typeof mealsOrUpdater === 'function'
      ? mealsOrUpdater(previousMeals)
      : mealsOrUpdater;
    const optimisticEntry = { date: dateStr, meals: nextMeals };

    setVisibleEntry(optimisticEntry);
    setPendingMutations((count) => count + 1);

    const persistMeals = async () => {
      try {
        const updated = await apiFetch('/entries', {
          method: 'POST',
          body: JSON.stringify({ date: dateStr, meals: nextMeals })
        });
        const nextEntry = { date: dateStr, meals: [], ...updated };
        invalidateApiCache(user?.id, ['/entries']);
        setApiCache(user?.id, `/entries/${dateStr}`, nextEntry);
        setVisibleEntry(nextEntry);
        return nextEntry;
      } catch (err) {
        if (entryRef.current === optimisticEntry) {
          setVisibleEntry(previousEntry);
        }
        throw err;
      } finally {
        setPendingMutations((count) => Math.max(0, count - 1));
      }
    };

    const queuedMutation = mutationQueueRef.current.then(persistMeals, persistMeals);
    mutationQueueRef.current = queuedMutation.catch(() => {});
    return queuedMutation;
  }, [dateStr, getCurrentVisibleEntry, setVisibleEntry, user?.id]);

  const visibleEntry = entry?.date === dateStr
    ? entry
    : cacheRef.current.get(dateStr) || emptyEntry;

  const visibleHasLoaded = entry?.date === dateStr
    ? hasLoaded
    : cacheRef.current.has(dateStr);

  const addMeal = useCallback((meal) => (
    updateMeals((currentMeals) => [...currentMeals, { ...meal, id: crypto.randomUUID() }])
  ), [updateMeals]);

  const deleteMeal = useCallback((mealId) => (
    updateMeals((currentMeals) => currentMeals.filter((meal) => meal.id !== mealId))
  ), [updateMeals]);

  const updateMeal = useCallback((mealId, updatedData) => (
    updateMeals((currentMeals) => currentMeals.map((meal) => (
      meal.id === mealId ? { ...meal, ...updatedData } : meal
    )))
  ), [updateMeals]);

  return {
    entry: visibleEntry,
    isLoading,
    isSaving: pendingMutations > 0,
    hasLoaded: visibleHasLoaded,
    addMeal,
    updateMeals,
    deleteMeal,
    updateMeal,
    refresh: fetchEntry
  };
}

export function useAllEntryDates(centerDate = new Date(), rangeDays = 45) {
  const { user } = useAuth();
  const start = useMemo(() => formatDate(subDays(centerDate, rangeDays)), [centerDate, rangeDays]);
  const end = useMemo(() => formatDate(addDays(centerDate, rangeDays)), [centerDate, rangeDays]);
  const endpoint = useMemo(() => `/entries?start=${start}&end=${end}`, [end, start]);

  const cachedDates = useMemo(() => {
    const cachedEntries = getApiCache(user?.id, endpoint, ENTRIES_CACHE_TTL_MS);
    if (!cachedEntries) return null;

    return new Set(
      cachedEntries
        .filter((entry) => Array.isArray(entry?.meals) && entry.meals.length > 0)
        .map((entry) => entry.date)
    );
  }, [endpoint, user?.id]);

  const [activeDates, setActiveDates] = useState(() => cachedDates || new Set());

  useEffect(() => {
    if (cachedDates) {
      setActiveDates(cachedDates);
    }
  }, [cachedDates]);

  useEffect(() => {
    let cancelled = false;

    const fetchActiveDates = async () => {
      try {
        const entries = await apiFetch(endpoint, { cacheTtlMs: ENTRIES_CACHE_TTL_MS });
        if (cancelled) return;

        setActiveDates(new Set(
          entries
            .filter((entry) => Array.isArray(entry?.meals) && entry.meals.length > 0)
            .map((entry) => entry.date)
        ));
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching active entry dates:', err);
        }
      }
    };

    fetchActiveDates();

    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  return activeDates;
}
