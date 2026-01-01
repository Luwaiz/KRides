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
	sendPasswordResetEmail,
} from "firebase/auth";
import {
	getFirestore,
	doc,
	getDoc,
	getDocs,
	setDoc,
	updateDoc,
	deleteField,
	serverTimestamp,
	collection,
	query,
	where,
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

	try {
		await setDoc(userRef, userData);
		console.log(
			`✅ User document created successfully in ${collectionName}/${uid}`
		);
	} catch (firestoreError) {
		console.error(`❌ Failed to create user document in ${collectionName}/${uid}:`, firestoreError);
		console.error("Error code:", firestoreError.code);
		console.error("Error message:", firestoreError.message);

		// If Firestore write fails due to permission-denied, log but don't throw
		// The user account is still created in Auth, Navigation will handle the read error
		if (firestoreError.code === "permission-denied") {
			console.error("🚨 CRITICAL: Firestore permission denied on user creation!");
			console.error("User auth account created, but Firestore document failed.");
			console.error("Please update Firestore security rules to allow user creation.");
		} else {
			// For other errors, throw so the signup flow knows it failed
			throw firestoreError;
		}
	}

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
	return () => { }; // Return empty cleanup function
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

/** ---------- PASSWORD RESET ---------- **/

export async function resetPassword(email) {
	if (!email) throw new Error("Email is required");
	try {
		await sendPasswordResetEmail(FIREBASE_AUTH, email);
		return { success: true };
	} catch (error) {
		console.error("Password reset error:", error);
		throw error;
	}
}

/** ---------- DRIVER EMAIL LOOKUP ---------- **/

/**
 * Get driver's email address by phone number
 * Used for driver login flow where drivers use phone numbers
 * @param {string} phone - Driver's phone number
 * @returns {Promise<string>} Driver's email address
 */
export async function getDriverEmailByPhone(phone) {
	if (!phone) {
		throw new Error("Phone number is required");
	}

	try {
		const driversRef = collection(FIREBASE_DB, "drivers");
		const q = query(driversRef, where("phone", "==", phone));
		const querySnapshot = await getDocs(q);

		if (querySnapshot.empty) {
			throw new Error("No driver found with this phone number");
		}

		const driverDoc = querySnapshot.docs[0];
		const driverData = driverDoc.data();

		if (!driverData.email) {
			throw new Error("Driver email not found");
		}

		console.log(`✅ Found driver email for phone ${phone}`);
		return driverData.email;
	} catch (error) {
		console.error("Error looking up driver email:", error);
		throw error;
	}
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
	resetPassword,
	getDriverEmailByPhone,
	getUserDoc,
};
