import { supabase } from './supabase';

const DEFAULT_TIMEOUT_MS = 15000;
const API_CACHE_PREFIX = 'dietapp:api-cache:v3';
const LEGACY_API_CACHE_PREFIXES = ['dietapp:api-cache:v1', 'dietapp:api-cache:v2'];
const memoryCache = new Map();
const pendingRequests = new Map();

const getCacheKey = (userId, endpoint) => `${API_CACHE_PREFIX}:${userId}:${endpoint}`;

const clearLegacyApiCaches = () => {
  try {
    Object.keys(window.localStorage).forEach((key) => {
      if (LEGACY_API_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        window.localStorage.removeItem(key);
      }
    });
  } catch (err) {
    void err;
  }
};

clearLegacyApiCaches();

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

const numberOrNull = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const toProfile = (row) => row && ({
  id: row.id,
  name: row.name,
  sex: row.sex,
  age: row.age,
  heightCm: numberOrNull(row.height_cm),
  weightKg: numberOrNull(row.weight_kg),
  activityLevel: row.activity_level,
  manualGoal: row.manual_kcal,
  weightFrequency: row.weight_frequency,
  theme: row.theme
});

const toIngredient = (row) => row && ({
  id: row.id,
  name: row.name,
  barcode: row.barcode,
  measureType: row.measure_type,
  kcal: numberOrNull(row.kcal),
  protein: numberOrNull(row.protein),
  fat: numberOrNull(row.fat),
  carbs: numberOrNull(row.carbs),
  servingLabel: row.serving_label,
  isPublic: row.is_public,
  sourceType: row.source_type || 'ingredient',
  recipeItems: row.recipe_items || [],
  recipeMeta: row.recipe_meta || {},
  userId: row.user_id,
  createdAt: row.created_at
});

const toWeightLog = (row) => row && ({
  id: row.id,
  date: row.date,
  weightKg: numberOrNull(row.weight_kg)
});

const toTemplate = (row) => row && ({
  id: row.id,
  name: row.name,
  items: row.items || [],
  createdAt: row.created_at
});

const throwIfError = ({ error }) => {
  if (error) throw error;
};

const getSessionUser = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session?.user) throw new Error('Authentication required');
  return session.user;
};

const ensureProfile = async (user) => {
  const existing = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  throwIfError(existing);
  if (existing.data) return toProfile(existing.data);

  const created = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario'
    })
    .select('*')
    .single();

  if (created.error?.code === '23505') {
    const retry = await supabase.from('profiles').select('*').eq('id', user.id).single();
    throwIfError(retry);
    return toProfile(retry.data);
  }

  throwIfError(created);
  return toProfile(created.data);
};

const getVisibleIngredients = async () => {
  const result = await supabase.from('ingredients').select('*').order('name');
  throwIfError(result);
  return (result.data || []).map(toIngredient);
};

const attachIngredientsToMeals = (meals, ingredients) => {
  const ingredientsById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  return (meals || []).map((meal) => ({
    ...meal,
    items: (meal.items || []).map((item) => ({
      ...item,
      ingredient: ingredientsById.get(String(item.ingredientId)) || null
    }))
  }));
};

const handleProfile = async (user, method, body) => {
  if (method === 'GET') return ensureProfile(user);
  if (method !== 'PUT') throw new Error('Unsupported profile operation');

  const result = await supabase
    .from('profiles')
    .update({
      name: body.name,
      sex: body.sex,
      age: body.age,
      height_cm: body.heightCm,
      weight_kg: body.weightKg,
      activity_level: body.activityLevel,
      manual_kcal: body.manualGoal,
      weight_frequency: body.weightFrequency,
      theme: body.theme,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id)
    .select('*')
    .single();
  throwIfError(result);
  return toProfile(result.data);
};

const ingredientPayload = (body, userId) => ({
  user_id: userId,
  name: body.name,
  barcode: body.barcode || null,
  measure_type: body.measureType,
  kcal: body.kcal,
  protein: body.protein,
  fat: body.fat,
  carbs: body.carbs,
  serving_label: body.servingLabel,
  is_public: body.isPublic ?? true,
  source_type: body.sourceType || 'ingredient',
  recipe_items: body.recipeItems || [],
  recipe_meta: body.recipeMeta || {}
});

const handleIngredients = async (user, method, body, id) => {
  if (method === 'GET') return getVisibleIngredients();

  if (method === 'POST') {
    if (body.barcode) {
      const existing = await supabase
        .from('ingredients')
        .select('*')
        .eq('barcode', body.barcode)
        .eq('user_id', user.id)
        .order('created_at')
        .limit(1);
      throwIfError(existing);
      if (existing.data?.[0]) return toIngredient(existing.data[0]);
    }

    const result = await supabase
      .from('ingredients')
      .insert(ingredientPayload(body, user.id))
      .select('*')
      .single();

    if (result.error?.code === '23505' && body.barcode) {
      const duplicate = await supabase
        .from('ingredients')
        .select('*')
        .eq('user_id', user.id)
        .eq('barcode', body.barcode)
        .single();
      throwIfError(duplicate);
      return toIngredient(duplicate.data);
    }

    throwIfError(result);
    return toIngredient(result.data);
  }

  if (method === 'PUT' && id) {
    const { user_id: ignored, ...changes } = ingredientPayload(body, user.id);
    void ignored;
    const result = await supabase
      .from('ingredients')
      .update(changes)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();
    throwIfError(result);
    return toIngredient(result.data);
  }

  if (method === 'DELETE' && id) {
    const result = await supabase
      .from('ingredients')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    throwIfError(result);
    return { success: true };
  }

  throw new Error('Unsupported ingredient operation');
};

const handleEntries = async (user, method, body, url, date) => {
  if (method === 'GET') {
    const [ingredients, entryResult] = await Promise.all([
      getVisibleIngredients(),
      date
        ? supabase
            .from('day_entries')
            .select('id,date,meals')
            .eq('user_id', user.id)
            .eq('date', date)
            .maybeSingle()
        : supabase
            .from('day_entries')
            .select('id,date,meals')
            .eq('user_id', user.id)
            .gte('date', url.searchParams.get('start'))
            .lte('date', url.searchParams.get('end'))
            .order('date')
    ]);
    throwIfError(entryResult);

    if (date) {
      const entry = entryResult.data || { date, meals: [] };
      return { ...entry, meals: attachIngredientsToMeals(entry.meals, ingredients) };
    }

    return (entryResult.data || []).map((entry) => ({
      ...entry,
      meals: attachIngredientsToMeals(entry.meals, ingredients)
    }));
  }

  if (method === 'POST') {
    const result = await supabase
      .from('day_entries')
      .upsert(
        { user_id: user.id, date: body.date, meals: body.meals || [] },
        { onConflict: 'user_id,date' }
      )
      .select('id,date,meals')
      .single();
    throwIfError(result);
    const ingredients = await getVisibleIngredients();
    return {
      ...result.data,
      meals: attachIngredientsToMeals(result.data.meals, ingredients)
    };
  }

  throw new Error('Unsupported entry operation');
};

const handleTemplates = async (user, method, body, id) => {
  if (method === 'GET') {
    const result = await supabase
      .from('meal_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at');
    throwIfError(result);
    return (result.data || []).map(toTemplate);
  }

  if (method === 'POST') {
    const result = await supabase
      .from('meal_templates')
      .insert({ user_id: user.id, name: body.name, items: body.items || [] })
      .select('*')
      .single();
    throwIfError(result);
    return toTemplate(result.data);
  }

  if (method === 'DELETE' && id) {
    const result = await supabase
      .from('meal_templates')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    throwIfError(result);
    return { success: true };
  }

  throw new Error('Unsupported template operation');
};

const handleWeights = async (user, method, body, id) => {
  if (method === 'GET') {
    const result = await supabase
      .from('weight_logs')
      .select('id,date,weight_kg')
      .eq('user_id', user.id)
      .order('date', { ascending: false });
    throwIfError(result);
    return (result.data || []).map(toWeightLog);
  }

  if (method === 'POST') {
    const result = await supabase
      .from('weight_logs')
      .upsert(
        { user_id: user.id, date: body.date, weight_kg: body.weightKg },
        { onConflict: 'user_id,date' }
      )
      .select('id,date,weight_kg')
      .single();
    throwIfError(result);
    return toWeightLog(result.data);
  }

  if (method === 'DELETE' && id) {
    const result = await supabase
      .from('weight_logs')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    throwIfError(result);
    return { success: true };
  }

  throw new Error('Unsupported weight operation');
};

const dispatchRequest = async (endpoint, options) => {
  const user = await getSessionUser();
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(options.body) : {};
  const url = new URL(endpoint, window.location.origin);
  const parts = url.pathname.split('/').filter(Boolean);
  const resource = parts[0];
  const id = parts[1];

  if (resource === 'init' && method === 'POST') {
    return { success: true, profile: await ensureProfile(user) };
  }
  if (resource === 'profile') return handleProfile(user, method, body);
  if (resource === 'ingredients') return handleIngredients(user, method, body, id);
  if (resource === 'entries') return handleEntries(user, method, body, url, id);
  if (resource === 'templates') return handleTemplates(user, method, body, id);
  if (resource === 'weights') return handleWeights(user, method, body, id);

  throw new Error(`Unknown API endpoint: ${endpoint}`);
};

export const apiFetch = async (endpoint, options = {}) => {
  if (!supabase) throw new Error('Supabase is not configured');

  const {
    authToken: ignoredAuthToken,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    cacheTtlMs = 0,
    cacheKey = endpoint,
    ...requestOptions
  } = options;
  void ignoredAuthToken;

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  const method = (requestOptions.method || 'GET').toUpperCase();
  const canUseCache = method === 'GET' && cacheTtlMs > 0 && userId;

  if (canUseCache) {
    const cached = getApiCache(userId, cacheKey, cacheTtlMs);
    if (cached) return cached;

    const pendingKey = getCacheKey(userId, cacheKey);
    const pending = pendingRequests.get(pendingKey);
    if (pending) return pending;
  }

  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error('API request timed out')), timeoutMs);
  });

  const request = Promise.race([dispatchRequest(endpoint, requestOptions), timeout])
    .then((data) => {
      if (canUseCache) setApiCache(userId, cacheKey, data);
      return data;
    })
    .finally(() => {
      window.clearTimeout(timeoutId);
      if (canUseCache) pendingRequests.delete(getCacheKey(userId, cacheKey));
    });

  if (canUseCache) pendingRequests.set(getCacheKey(userId, cacheKey), request);
  return request;
};
