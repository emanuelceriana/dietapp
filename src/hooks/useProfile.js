import { useCallback, useState, useEffect } from 'react';
import { apiFetch, getApiCache, setApiCache } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const PROFILE_CACHE_TTL_MS = 15 * 60 * 1000;
const PROFILE_ENDPOINT = '/profile';

export function useProfile() {
  const { user } = useAuth();
  const cachedProfile = getApiCache(user?.id, PROFILE_ENDPOINT, PROFILE_CACHE_TTL_MS);
  const [profile, setProfile] = useState(() => cachedProfile);
  const [isLoading, setIsLoading] = useState(() => !cachedProfile);
  const [error, setError] = useState(null);

  const fetchProfile = useCallback(async () => {
    setError(null);
    const cached = getApiCache(user?.id, PROFILE_ENDPOINT, PROFILE_CACHE_TTL_MS);
    if (cached) {
      setProfile(cached);
      setIsLoading(false);
      if (cached?.theme) {
        document.documentElement.setAttribute('data-theme', cached.theme);
      }
      return cached;
    }

    setIsLoading(true);
    try {
      const data = await apiFetch(PROFILE_ENDPOINT, { cacheTtlMs: PROFILE_CACHE_TTL_MS });
      setProfile(data);
      if (data?.theme) {
        document.documentElement.setAttribute('data-theme', data.theme);
      }
      return data;
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = async (updates) => {
    const updated = await apiFetch(PROFILE_ENDPOINT, {
      method: 'PUT',
      body: JSON.stringify({ ...profile, ...updates })
    });
    setProfile(updated);
    setApiCache(user?.id, PROFILE_ENDPOINT, updated);
    if (updated?.theme) {
      document.documentElement.setAttribute('data-theme', updated.theme);
    }
    return updated;
  }

  const setTheme = (theme) => updateProfile({ theme });

  return {
    profile,
    isLoading,
    error,
    updateProfile,
    setTheme,
    refresh: fetchProfile
  };
}
