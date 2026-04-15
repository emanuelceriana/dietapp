import { supabase } from './supabase';

const API_BASE_URL = '/api';
const DEFAULT_TIMEOUT_MS = 15000;

export const apiFetch = async (endpoint, options = {}) => {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const {
    authToken,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    ...fetchOptions
  } = options;

  const { data: { session } } = authToken
    ? { data: { session: null } }
    : await supabase.auth.getSession();
  const token = authToken || session?.access_token;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...fetchOptions.headers
  };

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('API request timed out');
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'API request failed');
  }

  return response.json();
};
