import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import {
  app as defaultApp,
  db as defaultDb,
  auth as defaultAuth,
  analytics as defaultAnalytics,
  isFirestoreQuotaExceeded,
  markFirestoreQuotaExceeded,
  resetFirestoreQuotaAndEnableNetwork,
  testFirestoreServerConnectionOnBoot
} from "../firebaseConfig";

export const firebaseConfig = {
  apiKey: "AIzaSyDelQgljbyAiaYoLKQn5WMzPvU8mSXRHrc",
  authDomain: "dayhocpktruckhang1.firebaseapp.com",
  projectId: "dayhocpktruckhang1",
  storageBucket: "dayhocpktruckhang1.firebasestorage.app",
  messagingSenderId: "737533301345",
  appId: "1:737533301345:web:e2e3ef75febaeb9a919020",
  measurementId: "G-BTNPHE789T"
};

export const app = defaultApp || (getApps().length > 0 ? getApp() : initializeApp(firebaseConfig));
export const analytics: Analytics | null = defaultAnalytics || (() => {
  if (typeof window !== "undefined") {
    try {
      return getAnalytics(app);
    } catch {
      return null;
    }
  }
  return null;
})();
export const db = defaultDb || getFirestore(app);
export const auth = defaultAuth || getAuth(app);

export {
  isFirestoreQuotaExceeded,
  markFirestoreQuotaExceeded,
  resetFirestoreQuotaAndEnableNetwork,
  testFirestoreServerConnectionOnBoot
};

export default app;
