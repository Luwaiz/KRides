// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {
	getAuth,
	getReactNativePersistence,
	initializeAuth,
} from "firebase/auth";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import {
	FIREBASE_API_KEY,
	FIREBASE_AUTH_DOMAIN,
	FIREBASE_PROJECT_ID,
	FIREBASE_STORAGE_BUCKET,
	FIREBASE_MESSAGING_SENDER_ID,
	FIREBASE_APP_ID,
	FIREBASE_MEASUREMENT_ID,
} from "@env";

// Firebase configuration using environment variables
// Falls back to hardcoded values if env vars are not available (for backward compatibility)
const firebaseConfig = {
	apiKey: FIREBASE_API_KEY || "AIzaSyA2EsyMXZlABPA1ZJ06Y9S6VOsKR62EQkA",
	authDomain: FIREBASE_AUTH_DOMAIN || "kampusride.firebaseapp.com",
	projectId: FIREBASE_PROJECT_ID || "kampusride",
	storageBucket: FIREBASE_STORAGE_BUCKET || "kampusride.firebasestorage.app",
	messagingSenderId: FIREBASE_MESSAGING_SENDER_ID || "1054058095059",
	appId: FIREBASE_APP_ID || "1:1054058095059:web:ff2a3c61ad63d32d818f26",
	measurementId: FIREBASE_MEASUREMENT_ID || "G-GJK6Q51CPP",
};

// Log configuration source (only in development)
if (__DEV__) {
	console.log("🔥 Firebase Config Source:", FIREBASE_API_KEY ? "Environment Variables" : "Fallback Values");
}

// Initialize Firebase
export const FIREBASE_APP = initializeApp(firebaseConfig);
export const FIREBASE_STORAGE = getStorage(FIREBASE_APP);
export const FIREBASE_AUTH = initializeAuth(FIREBASE_APP, {
	persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});
export const FIREBASE_DB = getFirestore(FIREBASE_APP);
