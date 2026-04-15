import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

export function useProfile() {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfile = async () => {
    setError(null);
    try {
      const data = await apiFetch('/profile');
      setProfile(data);
      if (data?.theme) {
        document.documentElement.setAttribute('data-theme', data.theme);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const updateProfile = async (updates) => {
    const updated = await apiFetch('/profile', {
      method: 'PUT',
      body: JSON.stringify({ ...profile, ...updates })
    });
    setProfile(updated);
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
