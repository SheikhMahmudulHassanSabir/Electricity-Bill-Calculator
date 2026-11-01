import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  getCurrentUser,
  onAuthStateChange,
  loginWithEmail,
  registerWithEmail,
  loginWithGooglePopup,
  sendPasswordReset,
  logoutUser,
} from '../services/authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const current = await getCurrentUser();
        if (mounted) {
          setUser(current);
        }
      } catch {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    const unsubscribe = onAuthStateChange((nextUser) => {
      if (mounted) {
        setUser(nextUser);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const loggedIn = await loginWithEmail({ email, password });
    setUser(loggedIn);
    return loggedIn;
  }, []);

  const register = useCallback(async ({ fullName, email, password }) => {
    const registered = await registerWithEmail({ fullName, email, password });
    if (!registered.needsEmailConfirmation) {
      setUser(registered);
    }
    return registered;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const googleUser = await loginWithGooglePopup();
    setUser(googleUser);
    return googleUser;
  }, []);

  const resetPassword = useCallback(async ({ email }) => {
    return sendPasswordReset({ email });
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        loginWithGoogle,
        resetPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
