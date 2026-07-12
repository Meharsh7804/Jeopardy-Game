import { initializeApp, getApp, getApps } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export function getSavedConfig(): FirebaseConfig | null {
  try {
    const saved = localStorage.getItem('jeopardy_firebase_config');
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

export function saveFirebaseConfig(config: FirebaseConfig) {
  localStorage.setItem('jeopardy_firebase_config', JSON.stringify(config));
}

export function clearFirebaseConfig() {
  localStorage.removeItem('jeopardy_firebase_config');
}

export function getFirebaseConfig(): FirebaseConfig {
  const saved = getSavedConfig();
  const config = saved || {
    apiKey: "AIzaSyA0Af35qyxugsaWukeDU8LVLJWcTBmHDKE",
    authDomain: "buzzingwithquizzing.firebaseapp.com",
    projectId: "buzzingwithquizzing",
    storageBucket: "buzzingwithquizzing.firebasestorage.app",
    messagingSenderId: "804798421646",
    appId: "1:804798421646:web:86a131d76f782dceca87df",
    databaseURL: "https://buzzingwithquizzing-default-rtdb.firebaseio.com",
  };

  // Sanitize databaseURL: strip trailing slashes and any child paths
  if (config.databaseURL) {
    let url = config.databaseURL.trim().replace(/\/+$/, '');
    try {
      const parsed = new URL(url);
      config.databaseURL = `${parsed.protocol}//${parsed.host}`;
    } catch {}
  }

  return config;
}

export function isFirebaseConfigValid(): boolean {
  const c = getFirebaseConfig();
  return !!(
    c.apiKey &&
    c.apiKey !== 'YOUR_API_KEY' &&
    c.databaseURL &&
    c.databaseURL.startsWith('http')
  );
}

let appInstance: any = null;
let dbInstance: Database | null = null;

export function getDb(): Database {
  if (dbInstance) return dbInstance;

  const config = getFirebaseConfig();
  if (!config.apiKey || config.apiKey === 'YOUR_API_KEY' || !config.databaseURL || !config.databaseURL.startsWith('http')) {
    throw new Error('Firebase configuration is missing or invalid. Please configure it in the Setup panel.');
  }

  if (getApps().length > 0) {
    appInstance = getApp();
  } else {
    appInstance = initializeApp(config);
  }
  dbInstance = getDatabase(appInstance);
  return dbInstance;
}

// Export a proxy so database refs can be declared on startup without causing fatal config exceptions
export const db = new Proxy({} as Database, {
  get(_, prop) {
    const database = getDb();
    const value = Reflect.get(database, prop);
    if (typeof value === 'function') {
      return value.bind(database);
    }
    return value;
  }
});
