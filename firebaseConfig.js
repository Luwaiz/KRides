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
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
	apiKey: "AIzaSyA2EsyMXZlABPA1ZJ06Y9S6VOsKR62EQkA",
	authDomain: "kampusride.firebaseapp.com",
	projectId: "kampusride",
	storageBucket: "kampusride.firebasestorage.app",
	messagingSenderId: "1054058095059",
	appId: "1:1054058095059:web:ff2a3c61ad63d32d818f26",
	measurementId: "G-GJK6Q51CPP",
};

// Initialize Firebase
export const FIREBASE_APP = initializeApp(firebaseConfig);
export const FIREBASE_STORAGE = getStorage(FIREBASE_APP);
export const FIREBASE_AUTH = initializeAuth(FIREBASE_APP, {
	persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});
export const FIREBASE_DB = getFirestore(FIREBASE_APP);
