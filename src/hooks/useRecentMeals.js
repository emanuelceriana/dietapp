import { useCallback, useEffect, useMemo, useState } from 'react';
import { startOfDay, subDays } from 'date-fns';
import { apiFetch, getApiCache } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/dates';

const RECENT_MEALS_CACHE_TTL_MS = 15 * 60 * 1000;
const RECENT_LOOKBACK_DAYS = 28;

const getMealSignature = (meal) => {
  const items = (meal?.items || [])
    .map((item) => `${item.ingredientId}:${Number(item.quantity) || 0}`)
    .sort()
    .join('|');

  return `${meal?.name?.trim()?.toLowerCase() || 'meal'}::${items}`;
};

const buildRecentMeals = (entries, excludedDate, limit) => {
  const uniqueMeals = [];
  const seen = new Set();

  [...entries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((entry) => {
      if (entry.date === excludedDate) return;

      (entry.meals || []).forEach((meal) => {
        const signature = getMealSignature(meal);
        if (seen.has(signature)) return;

        seen.add(signature);
        uniqueMeals.push({
          ...meal,
          signature,
          lastUsedAt: entry.date
        });
      });
    });

  return uniqueMeals.slice(0, limit);
};

export function useRecentMeals(selectedDate, limit = 6) {
  const { user } = useAuth();
  const selectedDateStr = useMemo(() => formatDate(selectedDate), [selectedDate]);
  const rangeEnd = useMemo(() => formatDate(new Date()), []);
  const rangeStart = useMemo(
    () => formatDate(subDays(startOfDay(new Date()), RECENT_LOOKBACK_DAYS)),
    []
  );
  const endpoint = `/entries?start=${rangeStart}&end=${rangeEnd}`;

  const cachedRecentMeals = useMemo(() => {
    const cachedEntries = getApiCache(user?.id, endpoint, RECENT_MEALS_CACHE_TTL_MS);
    return cachedEntries ? buildRecentMeals(cachedEntries, selectedDateStr, limit) : null;
  }, [endpoint, limit, selectedDateStr, user?.id]);

  const [recentMeals, setRecentMeals] = useState(() => cachedRecentMeals || []);
  const [isLoading, setIsLoading] = useState(() => !cachedRecentMeals);

  const fetchRecentMeals = useCallback(async () => {
    const cachedEntries = getApiCache(user?.id, endpoint, RECENT_MEALS_CACHE_TTL_MS);
    if (cachedEntries) {
      setRecentMeals(buildRecentMeals(cachedEntries, selectedDateStr, limit));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const entries = await apiFetch(endpoint, { cacheTtlMs: RECENT_MEALS_CACHE_TTL_MS });
      setRecentMeals(buildRecentMeals(entries, selectedDateStr, limit));
    } catch (err) {
      console.error('Error fetching recent meals:', err);
      setRecentMeals([]);
    } finally {
      setIsLoading(false);
    }
  }, [endpoint, limit, selectedDateStr, user?.id]);

  useEffect(() => {
    fetchRecentMeals();
  }, [fetchRecentMeals]);

  return {
    recentMeals,
    isLoading,
    refresh: fetchRecentMeals
  };
}
