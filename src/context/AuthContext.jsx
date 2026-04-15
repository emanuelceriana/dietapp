import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured, missingSupabaseEnvVars, supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const initializedSessionRef = useRef(null);

  const initializeSession = useCallback(async (session) => {
    if (!session || initializedSessionRef.current === session.access_token) return;

    initializedSessionRef.current = session.access_token;
    try {
      await apiFetch('/init', {
        method: 'POST',
        authToken: session.access_token,
        timeoutMs: 8000
      });
    } catch (err) {
      initializedSessionRef.current = null;
      console.error('Initialization error:', err);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    // Check current session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        if (session) {
          queueMicrotask(() => initializeSession(session));
        }
      })
      .catch((err) => {
        console.error('Session recovery error:', err);
        setSession(null);
      })
      .finally(() => {
        setLoading(false);
      });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setLoading(false);
      
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        queueMicrotask(() => initializeSession(session));
      }
    });

    return () => subscription.unsubscribe();
  }, [initializeSession]);

  const signInWithGoogle = async () => {
    if (!supabase) {
      console.error('Supabase credentials are missing:', missingSupabaseEnvVars.join(', '));
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) console.error('Error signing in:', error.message);
  };

  const signOut = async () => {
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();
    if (error) console.error('Error signing out:', error.message);
  };

  const value = {
    session,
    user: session?.user ?? null,
    signInWithGoogle,
    signOut,
    loading,
    isSupabaseConfigured,
    missingSupabaseEnvVars
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
