/**
 * hooks/Firebase.js
 * Firebase helpers compatible with firebaseConfig.js setup (Web SDK + React Native)
 */

import {
	getAuth,
	createUserWithEmailAndPassword,
	signInWithEmailAndPassword,
	signOut as firebaseSignOut,
	onAuthStateChanged as firebaseOnAuthStateChanged,
} from "firebase/auth";
import {
	getFirestore,
	doc,
	getDoc,
	setDoc,
	updateDoc,
	deleteField,
	serverTimestamp,
	collection,
} from "firebase/firestore";
import { FIREBASE_APP, FIREBASE_DB, FIREBASE_AUTH } from "../firebaseConfig";

/** ---------- AUTH ---------- **/

// Sign in with email/password
export async function signInWithEmail(email, password) {
	const credential = await signInWithEmailAndPassword(
		FIREBASE_AUTH,
		email,
		password
	);
	return credential.user;
}

// Sign up (for both users and drivers)
export async function signUpWithEmail({
	email,
	password,
	name,
	phone,
	role = "customer",
	vehicle_id = null,
}) {
	console.log("🔐 signUpWithEmail called with:", {
		email,
		name,
		phone,
		role,
		vehicle_id,
	});

	const credential = await createUserWithEmailAndPassword(
		FIREBASE_AUTH,
		email,
		password
	);
	const uid = credential.user.uid;

	const collectionName = role === "driver" ? "drivers" : "users";
	const userRef = doc(FIREBASE_DB, collectionName, uid);

	// Use 'fullname' for drivers, 'name' for customers
	const nameField = role === "driver" ? "fullname" : "name";

	const userData = {
		uid,
		[nameField]: name,
		email,
		phone: phone || null,
		role,
		...(vehicle_id && { vehicle_id }),
		fcmTokens: {},
		createdAt: serverTimestamp(),
	};

	console.log(`📝 Creating document in ${collectionName}/${uid}:`, userData);

	await setDoc(userRef, userData);

	console.log(
		`✅ User document created successfully in ${collectionName}/${uid}`
	);

	return credential.user;
}

// Sign up driver specifically
export async function signUpDriver({ phone, password, fullname, vehicle_id }) {
	const email = `${phone}@rideapp.com`;
	return signUpWithEmail({
		email,
		password,
		name: fullname,
		phone,
		role: "driver",
		vehicle_id,
	});
}

/** ---------- USER DOCS ---------- **/

export async function createUserDocIfMissing(uid, profile = {}) {
	if (!uid) throw new Error("uid required");
	const collectionName = profile.role === "driver" ? "drivers" : "users";
	const userRef = doc(FIREBASE_DB, collectionName, uid);
	const snap = await getDoc(userRef);

	if (!snap.exists()) {
		await setDoc(userRef, {
			uid,
			name: profile.name || null,
			email: profile.email || null,
			phone: profile.phone || null,
			role: profile.role || "customer",
			fcmTokens: {},
			createdAt: serverTimestamp(),
		});
		return { created: true };
	}
	return { created: false };
}

/** ---------- FCM TOKEN MANAGEMENT ---------- **/

export async function registerFcmToken(uid) {
	if (!uid) throw new Error("uid required");

	console.log(
		"FCM token registration skipped - Web SDK messaging not supported in React Native"
	);
	// To implement: use @react-native-firebase/messaging or Expo notifications
	return null;
}

export async function unregisterFcmToken(uid) {
	if (!uid) throw new Error("uid required");
	console.log(
		"FCM token unregistration skipped - Web SDK messaging not supported in React Native"
	);
	return null;
}

/** ---------- NOTIFICATION HANDLERS ---------- **/

export function setupNotificationHandlers(onNotification) {
	console.log(
		"Notification handlers skipped - Web SDK messaging not supported in React Native"
	);
	// To implement: use @react-native-firebase/messaging or Expo notifications
	return () => {}; // Return empty cleanup function
}

/** ---------- LOGOUT / AUTH CHANGE ---------- **/

export async function signOut() {
	try {
		await firebaseSignOut(FIREBASE_AUTH);
	} catch (e) {
		console.warn("Sign out failed", e.message || e);
	}
}

export function onAuthStateChanged(cb) {
	return firebaseOnAuthStateChanged(FIREBASE_AUTH, cb);
}

/** ---------- USER DOC FETCH ---------- **/

export async function getUserDoc(uid) {
	if (!uid) {
		console.warn("getUserDoc called without uid");
		return null;
	}

	try {
		const userRef = doc(FIREBASE_DB, "users", uid);
		const userSnap = await getDoc(userRef);
		if (userSnap.exists()) return { ...userSnap.data(), role: "customer" };

		const driverRef = doc(FIREBASE_DB, "drivers", uid);
		const driverSnap = await getDoc(driverRef);
		if (driverSnap.exists()) return { ...driverSnap.data(), role: "driver" };

		console.warn("No user or driver doc found for UID:", uid);
		return null;
	} catch (error) {
		console.error("Error fetching user doc:", error);
		return null;
	}
}

export default {
	signInWithEmail,
	signUpWithEmail,
	signUpDriver,
	createUserDocIfMissing,
	registerFcmToken,
	unregisterFcmToken,
	setupNotificationHandlers,
	signOut,
	onAuthStateChanged,
	getUserDoc,
};
