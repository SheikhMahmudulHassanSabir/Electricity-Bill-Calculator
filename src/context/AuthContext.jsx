import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  getCurrentUser,
  onAuthStateChange,
  loginWithEmail,
  registerWithEmail,
  sendEmailSignInLink,
  completeEmailSignInLink,
  isIncomingEmailSignInLink,
  getPendingEmailLinkData,
  loginWithGooglePopup,
  sendPasswordReset,
  logoutUser,
} from '../services/authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifyingEmailLink, setVerifyingEmailLink] = useState(false);
  const [emailLinkNeedsConfirmation, setEmailLinkNeedsConfirmation] = useState(false);
  const [emailLinkError, setEmailLinkError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const href = typeof window !== 'undefined' ? window.location.href : '';
        if (href && isIncomingEmailSignInLink(href)) {
          const pending = getPendingEmailLinkData();
          if (pending.email) {
            if (mounted) setVerifyingEmailLink(true);
            try {
              const verifiedUser = await completeEmailSignInLink({
                email: pending.email,
                fullName: pending.fullName,
                url: href,
              });
              if (mounted) {
                setUser(verifiedUser);
                setEmailLinkNeedsConfirmation(false);
              }
              return;
            } catch (err) {
              if (mounted) {
                if (err?.code === 'EMAIL_REQUIRED') {
                  setEmailLinkNeedsConfirmation(true);
                } else {
                  setEmailLinkError(err.message || 'Could not verify sign-in link.');
                }
              }
            } finally {
              if (mounted) setVerifyingEmailLink(false);
            }
          } else {
            if (mounted) {
              setEmailLinkNeedsConfirmation(true);
            }
          }
        }

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

  const sendEmailLink = useCallback(async ({ email, fullName }) => {
    setEmailLinkError('');
    return sendEmailSignInLink({ email, fullName });
  }, []);

  const completeEmailLink = useCallback(async ({ email, fullName }) => {
    setEmailLinkError('');
    setVerifyingEmailLink(true);
    try {
      const verifiedUser = await completeEmailSignInLink({ email, fullName });
      setUser(verifiedUser);
      setEmailLinkNeedsConfirmation(false);
      return verifiedUser;
    } finally {
      setVerifyingEmailLink(false);
    }
  }, []);

  const clearEmailLinkState = useCallback(() => {
    setEmailLinkNeedsConfirmation(false);
    setEmailLinkError('');
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
        verifyingEmailLink,
        emailLinkNeedsConfirmation,
        emailLinkError,
        login,
        register,
        sendEmailLink,
        completeEmailLink,
        clearEmailLinkState,
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
