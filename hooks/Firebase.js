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
import { NOTIFICATION_API_KEY } from "@env";

const NOTIFICATION_SERVER = 'https://krides.onrender.com';

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

		// Always throw so the signup screen shows an error instead of silently
		// leaving the user in a broken state (Auth account exists, no profile).
		if (firestoreError.code === "permission-denied") {
			console.error("🚨 Firestore permission denied on profile creation — check security rules.");
			throw new Error(
				"Account was created but your profile could not be saved. " +
				"Please contact support or try signing up again."
			);
		} else {
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
/**
 * Normalize a Nigerian phone number to the 11-digit local format (08XXXXXXXXX).
 * Accepts: 08123456789 · +2348123456789 · 2348123456789
 */
export function normalizeNigerianPhone(raw) {
	const digits = String(raw).replace(/\D/g, "");
	if (digits.startsWith("234") && digits.length === 13) {
		return "0" + digits.slice(3);
	}
	// 11-digit local format (08XXXXXXXXX or 09XXXXXXXXX)
	if (/^0[789]\d{9}$/.test(digits)) {
		return digits;
	}
	return null; // unparseable — caller must handle
}

export async function getDriverEmailByPhone(phone) {
	if (!phone) throw new Error("Phone number is required");

	let response;
	try {
		response = await fetch(`${NOTIFICATION_SERVER}/api/auth/driver-email`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': NOTIFICATION_API_KEY || '',
			},
			body: JSON.stringify({ phone }),
		});
	} catch (networkError) {
		console.error("Driver email lookup — network error:", networkError);
		throw new Error("Unable to reach the server. Please check your internet connection.");
	}

	const data = await response.json();

	if (!response.ok) {
		if (response.status === 404) throw new Error("No driver found with this phone number");
		throw new Error(data.error || "Driver lookup failed. Please try again.");
	}

	console.log(`✅ Driver email resolved for phone ${phone}`);
	return data.email;
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

/** ---------- GOOGLE SIGN-IN ---------- **/

/**
 * Handle Google Sign-In user creation/update
 * Creates or updates user document in Firestore after successful Google Sign-In
 * @param {object} firebaseUser - Firebase user object from signInWithCredential
 * @param {object} googleUser - Google user data from GoogleSignin
 * @param {string} role - User role ('customer' or 'driver')
 * @returns {Promise<{data: object}>} User profile data
 */
export async function handleGoogleSignIn(firebaseUser, googleUser, role = 'customer') {
	if (!firebaseUser || !firebaseUser.uid) {
		throw new Error("Firebase user is required");
	}

	const uid = firebaseUser.uid;
	const collectionName = role === "driver" ? "drivers" : "users";
	const userRef = doc(FIREBASE_DB, collectionName, uid);

	// Extract user data from Google profile
	const userData = {
		uid,
		email: firebaseUser.email || googleUser?.email || null,
		name: firebaseUser.displayName || googleUser?.name || null,
		phone: firebaseUser.phoneNumber || googleUser?.phoneNumber || null,
		photoURL: firebaseUser.photoURL || googleUser?.photo || null,
		role,
		fcmTokens: {},
		updatedAt: serverTimestamp(),
	};

	try {
		// Check if user document exists
		const userSnap = await getDoc(userRef);

		if (userSnap.exists()) {
			// Update existing user
			await updateDoc(userRef, {
				...userData,
				updatedAt: serverTimestamp(),
			});
			console.log(`✅ Updated existing ${role} profile for ${uid}`);
			return { data: { ...userSnap.data(), ...userData } };
		} else {
			// Create new user document
			await setDoc(userRef, {
				...userData,
				createdAt: serverTimestamp(),
			});
			console.log(`✅ Created new ${role} profile for ${uid}`);
			return { data: userData };
		}
	} catch (error) {
		console.error(`❌ Error handling Google Sign-In for ${uid}:`, error);
		throw error;
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
	handleGoogleSignIn,
};
