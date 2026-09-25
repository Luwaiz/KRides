
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


export async function signInWithEmail(email, password) {
	const credential = await signInWithEmailAndPassword(
		FIREBASE_AUTH,
		email,
		password
	);
	return credential.user;
}

export async function signUpWithEmail({
	email,
	password,
	name,
	phone,
	role = "customer",
	vehicle_id = null,
}) {
	if (phone) {
		const available = await checkPhoneAvailable(phone);
		if (!available) {
			const err = new Error("An account with this phone number already exists. Please log in instead.");
			err.code = "auth/phone-already-in-use";
			throw err;
		}
	}

	const credential = await createUserWithEmailAndPassword(
		FIREBASE_AUTH,
		email,
		password
	);
	const uid = credential.user.uid;

	const collectionName = role === "driver" ? "drivers" : "users";
	const userRef = doc(FIREBASE_DB, collectionName, uid);

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

		await firebaseSignOut(FIREBASE_AUTH).catch(() => {});

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

export async function signUpDriver({ email, phone, password, fullname, vehicle_id }) {
	return signUpWithEmail({
		email,
		password,
		name: fullname,
		phone,
		role: "driver",
		vehicle_id,
	});
}


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


export async function registerFcmToken(uid) {
	if (!uid) throw new Error("uid required");

	console.log(
		"FCM token registration skipped - Web SDK messaging not supported in React Native"
	);
	return null;
}

export async function unregisterFcmToken(uid) {
	if (!uid) throw new Error("uid required");
	console.log(
		"FCM token unregistration skipped - Web SDK messaging not supported in React Native"
	);
	return null;
}


export function setupNotificationHandlers(onNotification) {
	console.log(
		"Notification handlers skipped - Web SDK messaging not supported in React Native"
	);
	return () => { };
}


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


export function normalizeNigerianPhone(raw) {
	const digits = String(raw).replace(/\D/g, "");
	if (digits.startsWith("234") && digits.length === 13) {
		return "0" + digits.slice(3);
	}
	if (/^0[789]\d{9}$/.test(digits)) {
		return digits;
	}
	return null;
}

export async function getDriverEmailByPhone(phone) {
	if (!phone) throw new Error("Phone number is required");

	let response;
	try {
		const currentUser = FIREBASE_AUTH.currentUser;
		const idToken = currentUser ? await currentUser.getIdToken().catch(() => null) : null;

		response = await fetch(`${NOTIFICATION_SERVER}/api/auth/driver-email`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': NOTIFICATION_API_KEY || '',
				...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
			},
			body: JSON.stringify({ phone }),
		});
	} catch (networkError) {
		console.error("Driver email lookup — network error:", networkError);
		throw new Error("Unable to reach the server. Please check your internet connection.");
	}

	const data = await response.json();

	if (!response.ok) {
		if (response.status === 429) {
			const waitMin = Math.ceil((data.retryAfterSeconds || 900) / 60);
			throw new Error(`Too many attempts. Please wait ${waitMin} minute${waitMin === 1 ? '' : 's'} before trying again.`);
		}
		if (response.status === 404) throw new Error("No driver found with this phone number");
		throw new Error(data.error || "Driver lookup failed. Please try again.");
	}

	console.log('✅ Driver email resolved');
	return data.email;
}

export async function checkPhoneAvailable(phone) {
	if (!phone) return true;

	try {
		const response = await fetch(`${NOTIFICATION_SERVER}/api/auth/check-phone`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': NOTIFICATION_API_KEY || '',
			},
			body: JSON.stringify({ phone }),
		});
		const data = await response.json();
		if (!response.ok) {
			console.warn('⚠️ Phone availability check failed:', data.error);
			return true;
		}
		return data.available !== false;
	} catch (error) {
		console.warn('⚠️ Phone availability check — network error:', error.message);
		return true;
	}
}


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


export async function handleGoogleSignIn(firebaseUser, googleUser, role = 'customer') {
	if (!firebaseUser || !firebaseUser.uid) {
		throw new Error("Firebase user is required");
	}

	const uid = firebaseUser.uid;
	const collectionName = role === "driver" ? "drivers" : "users";
	const otherCollectionName = role === "driver" ? "users" : "drivers";
	const userRef = doc(FIREBASE_DB, collectionName, uid);

	const otherRoleSnap = await getDoc(doc(FIREBASE_DB, otherCollectionName, uid));
	if (otherRoleSnap.exists()) {
		const err = new Error(
			role === "driver"
				? "This Google account is already registered as a customer. Please use customer login instead."
				: "This Google account is already registered as a driver. Please use driver login instead."
		);
		err.code = "auth/wrong-role-account";
		throw err;
	}

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
		const userSnap = await getDoc(userRef);

		if (userSnap.exists()) {
			await updateDoc(userRef, {
				...userData,
				updatedAt: serverTimestamp(),
			});
			console.log(`✅ Updated existing ${role} profile for ${uid}`);
			return { data: { ...userSnap.data(), ...userData } };
		} else {
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
	normalizeNigerianPhone,
	getDriverEmailByPhone,
	getUserDoc,
	handleGoogleSignIn,
};
