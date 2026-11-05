import {
  supabase,
  isSupabaseConfigured,
  isSupabaseSchemaReady,
  auth,
  googleProvider,
  readLocalDb,
  writeLocalDb,
  readLocalSession,
  writeLocalSession,
  generateUuid,
} from '../lib/supabaseClient.js';
import {
  signInWithPopup,
  signOut as fbSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  updateProfile,
} from 'firebase/auth';

const authListeners = new Set();

const EMAIL_LINK_ADDR_KEY = 'ebc_email_link_address';
const EMAIL_LINK_NAME_KEY = 'ebc_email_link_name';

function notifyAuthChange(user) {
  authListeners.forEach((cb) => cb(user));
}

function syncLocalProfile({ id, email, fullName }) {
  const db = readLocalDb();
  const now = new Date().toISOString();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName =
    String(fullName || '').trim() ||
    cleanEmail.split('@')[0] ||
    'User';

  let profile = db.profiles.find((p) => p.id === id);
  if (!profile) {
    profile = {
      id,
      full_name: cleanName,
      created_at: now,
    };
    db.profiles.push(profile);
    writeLocalDb(db, { table: 'profiles', type: 'INSERT' });
  } else if (fullName && String(fullName).trim() && profile.full_name !== cleanName) {
    profile.full_name = cleanName;
    writeLocalDb(db, { table: 'profiles', type: 'UPDATE' });
  }

  const sessionUser = {
    id,
    email: cleanEmail,
    full_name: profile.full_name || cleanName,
  };
  writeLocalSession(sessionUser);
  notifyAuthChange(sessionUser);
  return sessionUser;
}

export function getPendingEmailLinkData() {
  if (typeof window === 'undefined') {
    return { email: '', fullName: '' };
  }
  try {
    return {
      email: window.localStorage.getItem(EMAIL_LINK_ADDR_KEY) || '',
      fullName: window.localStorage.getItem(EMAIL_LINK_NAME_KEY) || '',
    };
  } catch {
    return { email: '', fullName: '' };
  }
}

export function clearPendingEmailLinkData() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(EMAIL_LINK_ADDR_KEY);
    window.localStorage.removeItem(EMAIL_LINK_NAME_KEY);
  } catch {
    // Ignore storage removal errors
  }
}

export function isIncomingEmailSignInLink(url) {
  const targetUrl =
    url || (typeof window !== 'undefined' ? window.location.href : '');
  if (!targetUrl) return false;
  try {
    return isSignInWithEmailLink(auth, targetUrl);
  } catch {
    return false;
  }
}

export async function getCurrentUser() {
  if (isSupabaseConfigured) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        let profileName = '';
        if (await isSupabaseSchemaReady()) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, created_at')
            .eq('id', session.user.id)
            .maybeSingle();
          profileName = profile?.full_name || '';
        }

        return {
          id: session.user.id,
          email: session.user.email,
          full_name:
            profileName ||
            session.user.user_metadata?.full_name ||
            session.user.email?.split('@')[0] ||
            'User',
        };
      }
    } catch {
      // Fall back to local/Firebase session
    }
  }

  return readLocalSession();
}

export function onAuthStateChange(callback) {
  let sbUnsubscribe = null;

  if (isSupabaseConfigured) {
    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        const localUser = readLocalSession();
        callback(localUser || null);
        return;
      }
      let profileName = '';
      if (await isSupabaseSchemaReady()) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('id', session.user.id)
          .maybeSingle();
        profileName = profile?.full_name || '';
      }

      callback({
        id: session.user.id,
        email: session.user.email,
        full_name:
          profileName ||
          session.user.user_metadata?.full_name ||
          session.user.email?.split('@')[0] ||
          'User',
      });
    });

    sbUnsubscribe = () => {
      data.subscription.unsubscribe();
    };
  }

  authListeners.add(callback);
  return () => {
    authListeners.delete(callback);
    if (sbUnsubscribe) sbUnsubscribe();
  };
}

export async function registerWithEmail({ fullName, email, password }) {
  const cleanName = String(fullName || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPass = String(password || '');

  if (!cleanName) throw new Error('Enter your full name.');
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Enter a valid email address.');
  }
  if (cleanPass.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const db = readLocalDb();
  const existingLocal = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (existingLocal) {
    throw new Error('An account with this email already exists. Please log in instead.');
  }

  let resolvedUserId = null;

  // 1. Try Firebase Auth registration
  try {
    const credential = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
    resolvedUserId = credential.user.uid;
    try {
      await updateProfile(credential.user, { displayName: cleanName });
    } catch {
      // Ignore displayName update error
    }
  } catch (fbErr) {
    if (fbErr?.code === 'auth/email-already-in-use') {
      throw new Error('An account with this email already exists. Please log in instead.');
    }
  }

  // 2. If Supabase is configured, also register in Supabase Auth when possible
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPass,
        options: {
          data: { full_name: cleanName },
        },
      });
      if (error && error.message?.toLowerCase().includes('already registered')) {
        throw new Error('An account with this email already exists. Please log in instead.');
      }
      if (data?.user?.id) {
        resolvedUserId = data.user.id;
        if (data.session && (await isSupabaseSchemaReady())) {
          await supabase.from('profiles').upsert(
            {
              id: data.user.id,
              full_name: cleanName,
            },
            { onConflict: 'id' }
          );
        }
      }
    } catch (sbErr) {
      if (sbErr.message?.includes('already exists')) {
        throw sbErr;
      }
    }
  }

  const newId = resolvedUserId || generateUuid();
  const now = new Date().toISOString();
  const userRecord = {
    id: newId,
    email: cleanEmail,
    password: cleanPass,
    full_name: cleanName,
    created_at: now,
  };
  const profileRecord = {
    id: newId,
    full_name: cleanName,
    created_at: now,
  };

  db.users.push(userRecord);
  if (!db.profiles.some((p) => p.id === newId)) {
    db.profiles.push(profileRecord);
  }
  writeLocalDb(db, { table: 'profiles', type: 'INSERT' });

  const sessionUser = {
    id: newId,
    email: cleanEmail,
    full_name: cleanName,
  };
  writeLocalSession(sessionUser);
  notifyAuthChange(sessionUser);
  return sessionUser;
}

export async function loginWithEmail({ email, password }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPass = String(password || '');

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Enter a valid email address.');
  }
  if (!cleanPass) {
    throw new Error('Enter your password.');
  }

  // 1. Check local collaborative store first
  const db = readLocalDb();
  const userByEmail = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (userByEmail) {
    if (userByEmail.password !== cleanPass) {
      throw new Error('Incorrect password. Please try again.');
    }
    const profile = db.profiles.find((p) => p.id === userByEmail.id);
    const sessionUser = {
      id: userByEmail.id,
      email: userByEmail.email,
      full_name:
        profile?.full_name || userByEmail.full_name || userByEmail.email.split('@')[0],
    };
    writeLocalSession(sessionUser);
    notifyAuthChange(sessionUser);
    return sessionUser;
  }

  // 2. Try Firebase Auth Email/Password
  try {
    const credential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
    const fbUser = credential.user;
    return syncLocalProfile({
      id: fbUser.uid,
      email: fbUser.email || cleanEmail,
      fullName: fbUser.displayName || '',
    });
  } catch (fbErr) {
    if (fbErr?.code === 'auth/wrong-password') {
      throw new Error('Incorrect password. Please try again.');
    }
  }

  // 3. Try Supabase Auth Email/Password if configured
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPass,
    });
    if (!error && data?.user) {
      let profileName = '';
      if (await isSupabaseSchemaReady()) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('id', data.user.id)
          .maybeSingle();
        profileName = profile?.full_name || '';
      }

      return syncLocalProfile({
        id: data.user.id,
        email: data.user.email,
        fullName:
          profileName ||
          data.user.user_metadata?.full_name ||
          cleanEmail.split('@')[0],
      });
    }
  }

  throw new Error(
    'No account found with this email address or incorrect password. Please check your credentials or create an account.'
  );
}

export async function sendEmailSignInLink({ email, fullName = '' }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(fullName || '').trim();

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Enter a valid email address.');
  }

  const redirectUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/login`
      : 'http://localhost:3000/login';

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(EMAIL_LINK_ADDR_KEY, cleanEmail);
      if (cleanName) {
        window.localStorage.setItem(EMAIL_LINK_NAME_KEY, cleanName);
      } else {
        window.localStorage.removeItem(EMAIL_LINK_NAME_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }

  if (isSupabaseConfigured) {
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo: redirectUrl,
        data: cleanName ? { full_name: cleanName } : undefined,
      },
    });
    if (error) throw new Error(error.message);
    return { sent: true, email: cleanEmail };
  }

  try {
    await sendSignInLinkToEmail(auth, cleanEmail, {
      url: redirectUrl,
      handleCodeInApp: true,
    });
    return { sent: true, email: cleanEmail };
  } catch (err) {
    if (err?.code === 'auth/operation-not-allowed') {
      throw new Error(
        'Email link sign-in is not enabled in Firebase Console yet. Enable both "Email/Password" and "Email link (passwordless sign-in)" under Authentication → Sign-in method.'
      );
    }
    if (
      err?.code === 'auth/unauthorized-continue-uri' ||
      err?.code === 'auth/invalid-continue-uri' ||
      err?.code === 'auth/unauthorized-domain'
    ) {
      throw new Error(
        `This domain (${typeof window !== 'undefined' ? window.location.hostname : 'current host'}) is not yet in Firebase Authorized domains. Add it in Firebase Console → Authentication → Settings → Authorized domains.`
      );
    }
    throw new Error(err?.message || 'Could not send sign-in link. Please try again.');
  }
}

export async function completeEmailSignInLink({ email, fullName = '', url } = {}) {
  const targetUrl =
    url || (typeof window !== 'undefined' ? window.location.href : '');
  if (!targetUrl || !isIncomingEmailSignInLink(targetUrl)) {
    throw new Error('This sign-in link is invalid or has already been used.');
  }

  const pending = getPendingEmailLinkData();
  const cleanEmail = String(email || pending.email || '').trim().toLowerCase();
  const cleanName = String(fullName || pending.fullName || '').trim();

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    const err = new Error('Please confirm the email address where you received this sign-in link.');
    err.code = 'EMAIL_REQUIRED';
    throw err;
  }

  try {
    const result = await signInWithEmailLink(auth, cleanEmail, targetUrl);
    const fbUser = result.user;

    if (cleanName && (!fbUser.displayName || fbUser.displayName !== cleanName)) {
      try {
        await updateProfile(fbUser, { displayName: cleanName });
      } catch {
        // Ignore profile update error
      }
    }

    clearPendingEmailLinkData();

    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const resolvedName =
      cleanName ||
      fbUser.displayName ||
      cleanEmail.split('@')[0] ||
      'User';

    return syncLocalProfile({
      id: fbUser.uid,
      email: fbUser.email || cleanEmail,
      fullName: resolvedName,
    });
  } catch (err) {
    if (err?.code === 'auth/invalid-action-code' || err?.code === 'auth/expired-action-code') {
      throw new Error(
        'This sign-in link has expired or has already been used. Please request a new sign-in link.'
      );
    }
    if (err?.code === 'auth/invalid-email') {
      throw new Error(
        'The email address does not match the address this sign-in link was sent to.'
      );
    }
    throw new Error(err?.message || 'Could not verify sign-in link. Please try again.');
  }
}

export async function loginWithGooglePopup() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const fbUser = result.user;
    const fullName = fbUser.displayName || fbUser.email?.split('@')[0] || 'User';
    const email = (fbUser.email || '').toLowerCase();

    // If Supabase is configured, bridge the verified Firebase Google user into a Supabase session
    if (isSupabaseConfigured && email) {
      try {
        const derivedPassword = `FbGoogle!${fbUser.uid.slice(0, 16)}#Ebc26`;
        let sbSessionUser = null;

        const { data: signInData, error: signInErr } =
          await supabase.auth.signInWithPassword({
            email,
            password: derivedPassword,
          });

        if (!signInErr && signInData?.session?.user) {
          sbSessionUser = signInData.session.user;
        } else {
          const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
            email,
            password: derivedPassword,
            options: {
              data: { full_name: fullName },
            },
          });
          if (!signUpErr && signUpData?.session?.user) {
            sbSessionUser = signUpData.session.user;
          }
        }

        if (sbSessionUser) {
          await supabase.from('profiles').upsert(
            {
              id: sbSessionUser.id,
              full_name: fullName,
            },
            { onConflict: 'id' }
          );

          return syncLocalProfile({
            id: sbSessionUser.id,
            email,
            fullName,
          });
        }
      } catch {
        // Fall through to local/Firebase profile session if Supabase bridge is unavailable
      }
    }

    return syncLocalProfile({
      id: fbUser.uid,
      email,
      fullName,
    });
  } catch (err) {
    if (err?.code === 'auth/unauthorized-domain') {
      const host =
        typeof window !== 'undefined' ? window.location.hostname : 'this domain';
      throw new Error(
        `Domain "${host}" is not yet authorized for Google sign-in. Add "${host}" in Firebase Console → Authentication → Settings → Authorized domains.`
      );
    }
    if (err?.code === 'auth/operation-not-allowed') {
      throw new Error(
        'Google sign-in is not enabled in Firebase Console yet. Enable "Google" in Firebase Console → Authentication → Sign-in method.'
      );
    }
    if (err?.code === 'auth/popup-closed-by-user') {
      throw new Error('Google sign-in popup was closed before completing.');
    }
    throw new Error(err?.message || 'Could not sign in with Google. Please try again.');
  }
}

export async function sendPasswordReset({ email }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Enter a valid email address.');
  }

  if (isSupabaseConfigured) {
    const redirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo,
    });
    if (error) throw new Error(error.message);
    return { sent: true, email: cleanEmail };
  }

  try {
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch {
    // Allow fallback confirmation even if user is local-only
  }

  return { sent: true, email: cleanEmail };
}

export async function logoutUser() {
  if (isSupabaseConfigured) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore Supabase sign-out errors
    }
  }

  try {
    if (auth.currentUser) {
      await fbSignOut(auth);
    }
  } catch {
    // Ignore Firebase sign-out errors if not signed into Firebase
  }

  writeLocalSession(null);
  notifyAuthChange(null);
}
