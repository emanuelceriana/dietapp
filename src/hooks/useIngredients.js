import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, invalidateApiCache } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_PREFIX = 'dietapp:ingredients:v1';
const memoryCache = new Map();
const listenersByUser = new Map();
const requestsByUser = new Map();

const getCacheKey = (userId) => `${CACHE_PREFIX}:${userId}`;

const normalizeIngredients = (value) => Array.isArray(value) ? value : [];

const readCache = (userId) => {
  if (!userId) return null;

  const cached = memoryCache.get(userId);
  if (cached) return cached;

  try {
    const raw = window.localStorage.getItem(getCacheKey(userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.data) || typeof parsed?.savedAt !== 'number') return null;

    memoryCache.set(userId, parsed);
    return parsed;
  } catch {
    return null;
  }
};

const writeCache = (userId, ingredients) => {
  if (!userId) return;

  const nextCache = {
    data: normalizeIngredients(ingredients),
    savedAt: Date.now()
  };

  memoryCache.set(userId, nextCache);

  try {
    window.localStorage.setItem(getCacheKey(userId), JSON.stringify(nextCache));
  } catch (err) {
    void err;
  }
};

const isFresh = (cached) => cached && Date.now() - cached.savedAt < CACHE_TTL_MS;

const getListeners = (userId) => {
  if (!listenersByUser.has(userId)) {
    listenersByUser.set(userId, new Set());
  }
  return listenersByUser.get(userId);
};

const publishIngredients = (userId, ingredients) => {
  const normalized = normalizeIngredients(ingredients);
  writeCache(userId, normalized);
  getListeners(userId).forEach((listener) => listener(normalized));
};

const loadIngredients = async (userId, { force = false } = {}) => {
  const cached = readCache(userId);
  if (!force && isFresh(cached)) {
    return cached.data;
  }

  const currentRequest = requestsByUser.get(userId);
  if (currentRequest) return currentRequest;

  const request = apiFetch('/ingredients')
    .then((data) => {
      const ingredients = normalizeIngredients(data);
      publishIngredients(userId, ingredients);
      return ingredients;
    })
    .finally(() => {
      requestsByUser.delete(userId);
    });

  requestsByUser.set(userId, request);
  return request;
};

export function useIngredients() {
  const { user } = useAuth();
  const userId = user?.id;
  const initialCache = useMemo(() => readCache(userId), [userId]);
  const [ingredients, setIngredients] = useState(() => initialCache?.data || []);
  const [isLoading, setIsLoading] = useState(() => !initialCache);

  useEffect(() => {
    if (!userId) {
      setIngredients([]);
      setIsLoading(false);
      return undefined;
    }

    const cached = readCache(userId);
    if (cached) {
      setIngredients(cached.data);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    const listeners = getListeners(userId);
    const handleUpdate = (nextIngredients) => {
      setIngredients(nextIngredients);
      setIsLoading(false);
    };
    listeners.add(handleUpdate);

    let isMounted = true;
    if (!isFresh(cached)) {
      loadIngredients(userId)
        .then((data) => {
          if (isMounted) {
            setIngredients(data);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          console.error('Error fetching ingredients:', err);
          if (isMounted) setIsLoading(false);
        });
    }

    return () => {
      isMounted = false;
      listeners.delete(handleUpdate);
    };
  }, [userId]);

  const refresh = useCallback(async ({ force = true } = {}) => {
    if (!userId) return [];

    setIsLoading(true);
    try {
      const data = await loadIngredients(userId, { force });
      setIngredients(data);
      return data;
    } catch (err) {
      console.error('Error fetching ingredients:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const addIngredient = useCallback(async (ingredient) => {
    const newIngredient = await apiFetch('/ingredients', {
      method: 'POST',
      body: JSON.stringify(ingredient)
    });
    const currentIngredients = readCache(userId)?.data || ingredients;
    const nextIngredients = [...currentIngredients, newIngredient]
      .sort((a, b) => a.name.localeCompare(b.name));
    publishIngredients(userId, nextIngredients);
    return newIngredient;
  }, [ingredients, userId]);

  const updateIngredient = useCallback(async (id, changes) => {
    const updated = await apiFetch(`/ingredients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(changes)
    });
    const currentIngredients = readCache(userId)?.data || ingredients;
    const nextIngredients = currentIngredients
      .map((ingredient) => ingredient.id === id ? updated : ingredient)
      .sort((a, b) => a.name.localeCompare(b.name));
    publishIngredients(userId, nextIngredients);
    invalidateApiCache(userId, ['/entries']);
    return updated;
  }, [ingredients, userId]);

  const deleteIngredient = useCallback(async (id) => {
    await apiFetch(`/ingredients/${id}`, { method: 'DELETE' });
    const currentIngredients = readCache(userId)?.data || ingredients;
    publishIngredients(userId, currentIngredients.filter((ingredient) => ingredient.id !== id));
    invalidateApiCache(userId, ['/entries']);
  }, [ingredients, userId]);

  return {
    ingredients,
    isLoading,
    addIngredient,
    updateIngredient,
    deleteIngredient,
    refresh
  };
}
