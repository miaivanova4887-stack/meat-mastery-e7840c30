import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported as isMessagingSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyBlxYJbha-JonWl_EMqyU89v2vHSe4wcZE",
  authDomain: "carnivore-84bd2.firebaseapp.com",
  projectId: "carnivore-84bd2",
  storageBucket: "carnivore-84bd2.firebasestorage.app",
  messagingSenderId: "963699055181",
  appId: "1:963699055181:web:84a5598f81440a32d7da04",
  measurementId: "G-0ELMVJD8E5",
};

// Initialize Firebase
export const firebaseApp = initializeApp(firebaseConfig);

// Analytics — only works in browser environments
export const firebaseAnalytics = isAnalyticsSupported().then((yes) =>
  yes ? getAnalytics(firebaseApp) : null
);

// Auth
export const firebaseAuth = getAuth(firebaseApp);

// Firestore
export const firebaseDb = getFirestore(firebaseApp);

// Cloud Messaging — only works in browser environments with service worker support
export const firebaseMessaging = isMessagingSupported().then((yes) =>
  yes ? getMessaging(firebaseApp) : null
);
