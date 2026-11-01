import { createClient } from '@supabase/supabase-js';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// 1. Supabase Client (used whenever VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured)
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project-id.supabase.co') &&
    !supabaseAnonKey.includes('your-anon-public-key')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

// 2. Provisioned Firebase Client
const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

if (typeof window !== 'undefined') {
  testConnection();
}

// 3. Collaborative Local + Cross-Tab Realtime Engine (used when VITE_SUPABASE_URL is not set)
const DB_KEY = 'ebc_collab_db_v1';
const SESSION_KEY = 'ebc_collab_session_v1';
const CHANNEL_NAME = 'ebc_realtime_channel_v1';

const listeners = new Set();
let broadcastChannel = null;

if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    broadcastChannel.onmessage = (event) => {
      if (event?.data) {
        listeners.forEach((fn) => fn(event.data));
      }
    };
  } catch {
    broadcastChannel = null;
  }

  window.addEventListener('storage', (event) => {
    if (event.key === DB_KEY && event.newValue) {
      listeners.forEach((fn) => fn({ table: '*', type: 'STORAGE_SYNC' }));
    }
  });
}

function emptyDb() {
  return {
    users: [],
    profiles: [],
    workspaces: [],
    workspace_members: [],
    meters: [],
    bills: [],
    bill_items: [],
  };
}

export function readLocalDb() {
  if (typeof window === 'undefined') return emptyDb();
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    if (!raw) return emptyDb();
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces : [],
      workspace_members: Array.isArray(parsed.workspace_members) ? parsed.workspace_members : [],
      meters: Array.isArray(parsed.meters) ? parsed.meters : [],
      bills: Array.isArray(parsed.bills) ? parsed.bills : [],
      bill_items: Array.isArray(parsed.bill_items) ? parsed.bill_items : [],
    };
  } catch {
    return emptyDb();
  }
}

export function writeLocalDb(nextDb, eventPayload = { table: '*', type: 'UPDATE' }) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DB_KEY, JSON.stringify(nextDb));
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(eventPayload);
    } catch {
      // Ignore broadcast errors
    }
  }
  listeners.forEach((fn) => fn(eventPayload));
}

export function subscribeLocalRealtime(callback) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function readLocalSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeLocalSession(session) {
  if (typeof window === 'undefined') return;
  if (!session) {
    window.localStorage.removeItem(SESSION_KEY);
  } else {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

export function generateUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function generateInviteCode() {
  return generateUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
}
