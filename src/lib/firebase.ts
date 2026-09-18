import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, orderBy, limit, addDoc, serverTimestamp, doc, deleteDoc } from 'firebase/firestore';

// Default config structure - will be populated by the platform
let firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  firestoreDatabaseId: ""
};

// Use a self-invoking async function without top-level await or just static import
import configRaw from '../../firebase-applet-config.json';
const config = configRaw as any;

export const isFirebaseConfigured = !!(config && config.apiKey && config.apiKey !== "");

const app = isFirebaseConfigured ? initializeApp(config) : null;
export const db = app ? getFirestore(app, config.firestoreDatabaseId || "(default)") : null;
export const auth = app ? getAuth(app) : null;

export { collection, query, where, getDocs, orderBy, limit, addDoc, serverTimestamp, doc, deleteDoc };
