import { useCallback, useEffect, useMemo, useState } from 'react';
import { eachDayOfInterval, format, parseISO, startOfDay, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatDate } from '../utils/dates';
import { apiFetch, getApiCache } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const STATS_CACHE_TTL_MS = 15 * 60 * 1000;

const getRange = (range) => {
  if (typeof range === 'number') {
    const today = startOfDay(new Date());
    return {
      start: subDays(today, Math.max(range - 1, 0)),
      end: today
    };
  }

  return {
    start: startOfDay(range.start),
    end: startOfDay(range.end)
  };
};

const calculateEntryTotals = (entry) => {
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

  (entry?.meals || []).forEach((meal) => {
    (meal.items || []).forEach((item) => {
      const ingredient = item.ingredient;
      if (!ingredient) return;

      const factor = ingredient.measureType === 'per_serving'
        ? Number(item.quantity) || 0
        : (Number(item.quantity) || 0) / 100;

      totals.kcal += (Number(ingredient.kcal) || 0) * factor;
      totals.protein += (Number(ingredient.protein) || 0) * factor;
      totals.carbs += (Number(ingredient.carbs) || 0) * factor;
      totals.fat += (Number(ingredient.fat) || 0) * factor;
    });
  });

  return {
    kcal: Math.round(totals.kcal),
    protein: Math.round(totals.protein),
    carbs: Math.round(totals.carbs),
    fat: Math.round(totals.fat)
  };
};

const getDisplayDate = (date, daysCount) => {
  const dateStr = formatDate(date);
  if (dateStr === formatDate(new Date())) return 'Hoy';
  if (daysCount <= 7) return format(date, 'EEE', { locale: es });
  return format(date, 'd MMM', { locale: es });
};

export function useStats(range = 7) {
  const { user } = useAuth();
  const { start, end } = useMemo(() => getRange(range), [range]);
  const startStr = formatDate(start);
  const endStr = formatDate(end);
  const endpoint = `/entries?start=${startStr}&end=${endStr}`;

  const buildStats = useCallback((entries = []) => {
    const dates = eachDayOfInterval({
      start: parseISO(startStr),
      end: parseISO(endStr)
    });
    const entriesByDate = new Map(entries.map((entry) => [entry.date, entry]));

    return dates.map((date) => {
      const dateStr = formatDate(date);
      const totals = calculateEntryTotals(entriesByDate.get(dateStr));

      return {
        date: dateStr,
        displayDate: getDisplayDate(date, dates.length),
        ...totals
      };
    });
  }, [startStr, endStr]);

  const cachedStats = useMemo(() => {
    const cachedEntries = getApiCache(user?.id, endpoint, STATS_CACHE_TTL_MS);
    return cachedEntries ? buildStats(cachedEntries) : null;
  }, [user?.id, endpoint, buildStats]);

  const [stats, setStats] = useState(() => cachedStats || []);
  const [isLoading, setIsLoading] = useState(() => !cachedStats);

  const fetchStats = useCallback(async () => {
    const cachedEntries = getApiCache(user?.id, endpoint, STATS_CACHE_TTL_MS);
    if (cachedEntries) {
      setStats(buildStats(cachedEntries));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const entries = await apiFetch(endpoint, { cacheTtlMs: STATS_CACHE_TTL_MS });
      setStats(buildStats(entries));
    } catch (err) {
      console.error('Error fetching stats:', err);
      setStats([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, endpoint, buildStats]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    data: stats,
    isLoading
  };
}
