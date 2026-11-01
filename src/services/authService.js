import {
  supabase,
  isSupabaseConfigured,
  auth,
  googleProvider,
  readLocalDb,
  writeLocalDb,
  readLocalSession,
  writeLocalSession,
  generateUuid,
} from '../lib/supabaseClient.js';
import { signInWithPopup, signOut as fbSignOut } from 'firebase/auth';

const authListeners = new Set();

function notifyAuthChange(user) {
  authListeners.forEach((cb) => cb(user));
}

export async function getCurrentUser() {
  if (isSupabaseConfigured) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, created_at')
      .eq('id', session.user.id)
      .maybeSingle();

    return {
      id: session.user.id,
      email: session.user.email,
      full_name:
        profile?.full_name ||
        session.user.user_metadata?.full_name ||
        session.user.email?.split('@')[0] ||
        'User',
    };
  }

  return readLocalSession();
}

export function onAuthStateChange(callback) {
  if (isSupabaseConfigured) {
    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        callback(null);
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('id', session.user.id)
        .maybeSingle();

      callback({
        id: session.user.id,
        email: session.user.email,
        full_name:
          profile?.full_name ||
          session.user.user_metadata?.full_name ||
          session.user.email?.split('@')[0] ||
          'User',
      });
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }

  authListeners.add(callback);
  return () => {
    authListeners.delete(callback);
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

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: cleanPass,
      options: {
        data: { full_name: cleanName },
      },
    });
    if (error) throw new Error(error.message);

    if (data.user) {
      await supabase.from('profiles').upsert(
        {
          id: data.user.id,
          full_name: cleanName,
        },
        { onConflict: 'id' }
      );
    }

    return {
      id: data.user?.id,
      email: cleanEmail,
      full_name: cleanName,
      needsEmailConfirmation: Boolean(data.user && !data.session),
    };
  }

  const db = readLocalDb();
  const existing = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (existing) {
    throw new Error('An account with this email already exists. Please log in instead.');
  }

  const newId = generateUuid();
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
  db.profiles.push(profileRecord);
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

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPass,
    });
    if (error) throw new Error(error.message);

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', data.user.id)
      .maybeSingle();

    return {
      id: data.user.id,
      email: data.user.email,
      full_name:
        profile?.full_name ||
        data.user.user_metadata?.full_name ||
        cleanEmail.split('@')[0],
    };
  }

  const db = readLocalDb();
  const match = db.users.find(
    (u) => u.email.toLowerCase() === cleanEmail && u.password === cleanPass
  );

  if (!match) {
    throw new Error('Invalid email or password. Please check your credentials.');
  }

  const profile = db.profiles.find((p) => p.id === match.id);
  const sessionUser = {
    id: match.id,
    email: match.email,
    full_name: profile?.full_name || match.full_name || match.email.split('@')[0],
  };

  writeLocalSession(sessionUser);
  notifyAuthChange(sessionUser);
  return sessionUser;
}

export async function loginWithGooglePopup() {
  const result = await signInWithPopup(auth, googleProvider);
  const fbUser = result.user;
  const fullName = fbUser.displayName || fbUser.email?.split('@')[0] || 'User';
  const email = (fbUser.email || '').toLowerCase();

  const db = readLocalDb();
  const now = new Date().toISOString();
  let profile = db.profiles.find((p) => p.id === fbUser.uid);
  if (!profile) {
    profile = {
      id: fbUser.uid,
      full_name: fullName,
      created_at: now,
    };
    db.profiles.push(profile);
    writeLocalDb(db, { table: 'profiles', type: 'INSERT' });
  }

  const sessionUser = {
    id: fbUser.uid,
    email,
    full_name: profile.full_name,
  };
  writeLocalSession(sessionUser);
  notifyAuthChange(sessionUser);
  return sessionUser;
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

  // In local collaborative mode, verify format and return confirmation
  return { sent: true, email: cleanEmail };
}

export async function logoutUser() {
  if (isSupabaseConfigured) {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
    return;
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
