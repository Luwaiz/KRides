// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
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

// Fail fast if required Firebase env vars are missing — never fall back to
// hardcoded credentials, as they would end up in the app bundle.
const requiredVars = {
	apiKey: FIREBASE_API_KEY,
	authDomain: FIREBASE_AUTH_DOMAIN,
	projectId: FIREBASE_PROJECT_ID,
	storageBucket: FIREBASE_STORAGE_BUCKET,
	messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
	appId: FIREBASE_APP_ID,
};

const missingVars = Object.entries(requiredVars)
	.filter(([, v]) => !v)
	.map(([k]) => k);

if (missingVars.length > 0) {
	throw new Error(
		`Missing Firebase environment variables: ${missingVars.join(", ")}. ` +
		"Check your .env file and EAS build secrets."
	);
}

const firebaseConfig = {
	...requiredVars,
	measurementId: FIREBASE_MEASUREMENT_ID, // optional — Google Analytics
};

// Initialize Firebase
export const FIREBASE_APP = initializeApp(firebaseConfig);
export const FIREBASE_STORAGE = getStorage(FIREBASE_APP);
export const FIREBASE_AUTH = initializeAuth(FIREBASE_APP, {
	persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

export const FIREBASE_DB = getFirestore(FIREBASE_APP);

if (__DEV__) {
	console.log("🔥 Firestore initialized");
}

export const FIREBASE_FUNCTIONS = getFunctions(FIREBASE_APP);
