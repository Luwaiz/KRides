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

// Sign in with Google (already authenticated with Firebase)
export async function handleGoogleSignIn(firebaseUser, googleUser, role = 'customer') {
	const { uid, email, displayName, photoURL } = firebaseUser;

	console.log('🔐 handleGoogleSignIn called:', { uid, email, role });

	// Determine collection based on role
	const collectionName = role === 'driver' ? 'drivers' : 'users';
	const userRef = doc(FIREBASE_DB, collectionName, uid);

	// Check if user already exists
	const userSnap = await getDoc(userRef);

	if (userSnap.exists()) {
		console.log('✅ User already exists in', collectionName);
		return { user: firebaseUser, isNew: false, data: userSnap.data() };
	}

	// Create new user document
	const nameField = role === 'driver' ? 'fullname' : 'name';
	const userData = {
		uid,
		[nameField]: displayName || googleUser?.name || 'User',
		email,
		photoURL: photoURL || googleUser?.photo || null,
		role,
		authProvider: 'google',
		// Phone will be added later for drivers
		phone: null,
		createdAt: serverTimestamp(),
	};

	console.log(`📝 Creating new user in ${collectionName}:`, userData);

	try {
		await setDoc(userRef, userData);
		console.log(`✅ User created successfully in ${collectionName}`);
		return { user: firebaseUser, isNew: true, data: userData };
	} catch (error) {
		console.error('❌ Error creating user document:', error);
		throw error;
	}
}

// Update driver phone number after Google Sign-In
export async function updateDriverPhone(uid, phone) {
	if (!uid || !phone) {
		throw new Error('UID and phone are required');
	}

	console.log('📞 Updating driver phone:', { uid, phone });

	const driverRef = doc(FIREBASE_DB, 'drivers', uid);

	try {
		await updateDoc(driverRef, {
			phone,
			updatedAt: serverTimestamp(),
		});
		console.log('✅ Driver phone updated successfully');
		return { success: true };
	} catch (error) {
		console.error('❌ Error updating driver phone:', error);
		throw error;
	}
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
export async function signUpDriver({ phone, email, password, fullname, vehicle_id }) {
	// Use provided email or fallback to generated one (though UI enforces email now)
	const driverEmail = email || `${phone}@rideapp.com`;
	return signUpWithEmail({
		email: driverEmail,
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
	handleGoogleSignIn,
	updateDriverPhone,
	createUserDocIfMissing,
	registerFcmToken,
	unregisterFcmToken,
	setupNotificationHandlers,
	signOut,
	onAuthStateChanged,
	resetPassword,
	getUserDoc,
};
