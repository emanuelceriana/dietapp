import { supabase } from './supabase';

const API_BASE_URL = '/api';
const DEFAULT_TIMEOUT_MS = 15000;
const API_CACHE_PREFIX = 'dietapp:api-cache:v1';
const memoryCache = new Map();
const pendingRequests = new Map();

const getCacheKey = (userId, endpoint) => `${API_CACHE_PREFIX}:${userId}:${endpoint}`;

export const getApiCache = (userId, endpoint, maxAgeMs) => {
  if (!userId || !endpoint || !maxAgeMs) return null;

  const key = getCacheKey(userId, endpoint);
  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.savedAt < maxAgeMs) return cached.data;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.savedAt >= maxAgeMs) return null;

    memoryCache.set(key, parsed);
    return parsed.data;
  } catch {
    return null;
  }
};

export const setApiCache = (userId, endpoint, data) => {
  if (!userId || !endpoint) return;

  const key = getCacheKey(userId, endpoint);
  const payload = { savedAt: Date.now(), data };
  memoryCache.set(key, payload);

  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch (err) {
    void err;
  }
};

export const invalidateApiCache = (userId, endpointPrefixes = []) => {
  if (!userId) return;

  const prefixes = endpointPrefixes.map((prefix) => `${API_CACHE_PREFIX}:${userId}:${prefix}`);

  for (const key of memoryCache.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      memoryCache.delete(key);
    }
  }

  try {
    Object.keys(window.localStorage).forEach((key) => {
      if (prefixes.some((prefix) => key.startsWith(prefix))) {
        window.localStorage.removeItem(key);
      }
    });
  } catch (err) {
    void err;
  }
};

export const apiFetch = async (endpoint, options = {}) => {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const {
    authToken,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    cacheTtlMs = 0,
    cacheKey = endpoint,
    ...fetchOptions
  } = options;

  const { data: { session } } = authToken
    ? { data: { session: null } }
    : await supabase.auth.getSession();
  const token = authToken || session?.access_token;
  const userId = session?.user?.id;
  const method = (fetchOptions.method || 'GET').toUpperCase();
  const canUseCache = method === 'GET' && cacheTtlMs > 0 && userId;

  if (canUseCache) {
    const cached = getApiCache(userId, cacheKey, cacheTtlMs);
    if (cached) return cached;

    const pendingKey = getCacheKey(userId, cacheKey);
    const pending = pendingRequests.get(pendingKey);
    if (pending) return pending;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...fetchOptions.headers
  };

  const request = fetch(`${API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
    signal: controller.signal
  })
    .catch((err) => {
      if (err.name === 'AbortError') {
        throw new Error('API request timed out');
      }
      throw err;
    })
    .then(async (response) => {
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'API request failed');
      }

      const data = await response.json();
      if (canUseCache) {
        setApiCache(userId, cacheKey, data);
      }
      return data;
    })
    .finally(() => {
      window.clearTimeout(timeoutId);
      if (canUseCache) {
        pendingRequests.delete(getCacheKey(userId, cacheKey));
      }
    });

  if (canUseCache) {
    pendingRequests.set(getCacheKey(userId, cacheKey), request);
  }

  return request;
};
