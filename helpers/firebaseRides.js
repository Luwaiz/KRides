import { FIREBASE_DB } from "../firebaseConfig";
import {
	collection,
	doc,
	setDoc,
	updateDoc,
	onSnapshot,
	query,
	where,
	orderBy,
	serverTimestamp,
	getDocs,
	getDoc,
} from "firebase/firestore";

/**
 * Firestore Collections Structure:
 *
 * rides/{rideId}
 *   - id: string
 *   - customerId: string
 *   - customerName: string
 *   - customerPhone: string
 *   - pickupLocation: string (name)
 *   - pickupCoords: { latitude, longitude, address }
 *   - destination: string (name)
 *   - destinationCoords: { latitude, longitude, address }
 *   - numberOfPassengers: number
 *   - amount: number
 *   - status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'
 *   - driverId: string | null
 *   - driverName: string | null
 *   - driverPhone: string | null
 *   - vehicleId: string | null
 *   - paymentMethod: string
 *   - createdAt: timestamp
 *   - acceptedAt: timestamp | null
 *   - completedAt: timestamp | null
 */

/**
 * Create a new ride booking
 * @param {Object} rideData - Ride details
 * @returns {Promise<string>} rideId
 */
export const createRide = async (rideData) => {
	try {
		// Import FIREBASE_AUTH to check current user
		const { FIREBASE_AUTH } = require("../firebaseConfig");
		const currentUser = FIREBASE_AUTH.currentUser;

		console.log("🔐 createRide - Auth Check:");
		console.log("   - Firebase currentUser:", !!currentUser);
		console.log("   - Firebase UID:", currentUser?.uid);
		console.log("   - Ride customerId:", rideData.customerId);
		console.log("   - UIDs match:", currentUser?.uid === rideData.customerId);

		if (!currentUser) {
			throw new Error("No authenticated user found. Please log in again.");
		}

		if (currentUser.uid !== rideData.customerId) {
			throw new Error(
				`Auth mismatch: Firebase UID (${currentUser.uid}) !== customerId (${rideData.customerId})`
			);
		}

		const ridesRef = collection(FIREBASE_DB, "rides");
		const rideDoc = doc(ridesRef);
		const rideId = rideDoc.id;

		const ride = {
			id: rideId,
			customerId: rideData.customerId,
			customerName: rideData.customerName || "",
			customerPhone: rideData.customerPhone || "",
			pickupLocation: rideData.pickupLocation,
			pickupCoords: rideData.pickupCoords || null,
			destination: rideData.destination,
			destinationCoords: rideData.destinationCoords || null,
			numberOfPassengers: rideData.numberOfPassengers || 1,
			amount: rideData.amount || 0,
			status: "pending",
			driverId: null,
			driverName: null,
			driverPhone: null,
			vehicleId: null,
			paymentMethod: rideData.paymentMethod || "cash",
			createdAt: serverTimestamp(),
			acceptedAt: null,
			completedAt: null,
		};

		await setDoc(rideDoc, ride);
		console.log("✅ Ride created:", rideId);
		return rideId;
	} catch (error) {
		console.error("❌ Error creating ride:", error);
		throw error;
	}
};

/**
 * Accept a ride (driver side)
 * @param {string} rideId - Ride ID
 * @param {Object} driverData - Driver details
 * @returns {Promise<void>}
 */
export const acceptRide = async (rideId, driverData) => {
	try {
		const rideRef = doc(FIREBASE_DB, "rides", rideId);

		await updateDoc(rideRef, {
			status: "accepted",
			driverId: driverData.driverId,
			driverName: driverData.driverName || "",
			driverPhone: driverData.driverPhone || "",
			vehicleId: driverData.vehicleId || "",
			acceptedAt: serverTimestamp(),
		});

		console.log("✅ Ride accepted:", rideId);
	} catch (error) {
		console.error("❌ Error accepting ride:", error);
		throw error;
	}
};

/**
 * Update ride status
 * @param {string} rideId - Ride ID
 * @param {string} status - New status
 * @returns {Promise<void>}
 */
export const updateRideStatus = async (rideId, status) => {
	try {
		const rideRef = doc(FIREBASE_DB, "rides", rideId);
		const updates = { status };

		if (status === "completed") {
			updates.completedAt = serverTimestamp();
		}

		await updateDoc(rideRef, updates);
		console.log(`✅ Ride status updated to ${status}:`, rideId);
	} catch (error) {
		console.error("❌ Error updating ride status:", error);
		throw error;
	}
};

/**
 * Listen to pending rides (driver side)
 * @param {Function} callback - Called with array of pending rides
 * @returns {Function} Unsubscribe function
 */
export const listenToPendingRides = (callback) => {
	try {
		const ridesRef = collection(FIREBASE_DB, "rides");
		// Simple query without orderBy to avoid index requirement
		const q = query(ridesRef, where("status", "==", "pending"));

		const unsubscribe = onSnapshot(
			q,
			(snapshot) => {
				const rides = [];
				snapshot.forEach((doc) => {
					rides.push({ ...doc.data(), rideId: doc.id });
				});
				// Sort by createdAt on client side
				rides.sort((a, b) => {
					const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
					const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
					return bTime - aTime; // descending order (newest first)
				});
				console.log("📨 Pending rides updated:", rides.length);
				callback(rides);
			},
			(error) => {
				// Silently handle permission-denied errors (happens during logout)
				if (error.code === "permission-denied") {
					console.log(
						"🔒 Permission denied listening to pending rides - user likely logged out"
					);
				} else {
					console.error("❌ Error listening to pending rides:", error);
				}
				callback([]); // Return empty array on error
			}
		);

		return unsubscribe;
	} catch (error) {
		console.error("❌ Error setting up pending rides listener:", error);
		return () => {};
	}
};

/**
 * Listen to a specific ride (customer side)
 * @param {string} rideId - Ride ID
 * @param {Function} callback - Called with ride data
 * @returns {Function} Unsubscribe function
 */
export const listenToRide = (rideId, callback) => {
	try {
		const rideRef = doc(FIREBASE_DB, "rides", rideId);

		const unsubscribe = onSnapshot(
			rideRef,
			(doc) => {
				if (doc.exists()) {
					const rideData = { ...doc.data(), rideId: doc.id };
					console.log("📨 Ride updated:", rideData.status);
					callback(rideData);
				} else {
					console.log("❌ Ride not found:", rideId);
					callback(null);
				}
			},
			(error) => {
				// Silently handle permission-denied errors (happens during logout)
				if (error.code === "permission-denied") {
					console.log(
						"🔒 Permission denied listening to ride - user likely logged out"
					);
				} else {
					console.error("❌ Error listening to ride:", error);
				}
				callback(null);
			}
		);

		return unsubscribe;
	} catch (error) {
		console.error("❌ Error setting up ride listener:", error);
		return () => {};
	}
};

/**
 * Listen to customer's rides
 * @param {string} customerId - Customer ID
 * @param {Function} callback - Called with array of rides
 * @returns {Function} Unsubscribe function
 */
export const listenToCustomerRides = (customerId, callback) => {
	try {
		const ridesRef = collection(FIREBASE_DB, "rides");
		// Simple query without orderBy to avoid index requirement
		const q = query(ridesRef, where("customerId", "==", customerId));

		const unsubscribe = onSnapshot(
			q,
			(snapshot) => {
				const rides = [];
				snapshot.forEach((doc) => {
					rides.push({ ...doc.data(), rideId: doc.id });
				});
				// Sort by createdAt on client side
				rides.sort((a, b) => {
					const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
					const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
					return bTime - aTime;
				});
				console.log("📨 Customer rides updated:", rides.length);
				callback(rides);
			},
			(error) => {
				// Silently handle permission-denied errors (happens during logout)
				if (error.code === "permission-denied") {
					console.log(
						"🔒 Permission denied listening to customer rides - user likely logged out"
					);
				} else {
					console.error("❌ Error listening to customer rides:", error);
				}
				callback([]);
			}
		);

		return unsubscribe;
	} catch (error) {
		console.error("❌ Error setting up customer rides listener:", error);
		return () => {};
	}
};

/**
 * Listen to driver's accepted rides
 * @param {string} driverId - Driver ID
 * @param {Function} callback - Called with array of rides
 * @returns {Function} Unsubscribe function
 */
export const listenToDriverRides = (driverId, callback) => {
	try {
		const ridesRef = collection(FIREBASE_DB, "rides");
		// Use two separate queries to avoid complex index
		const qAccepted = query(
			ridesRef,
			where("driverId", "==", driverId),
			where("status", "==", "accepted")
		);

		const qInProgress = query(
			ridesRef,
			where("driverId", "==", driverId),
			where("status", "==", "in_progress")
		);

		let allRides = [];

		const unsubscribe1 = onSnapshot(
			qAccepted,
			(snapshot) => {
				const acceptedRides = [];
				snapshot.forEach((doc) => {
					acceptedRides.push({ ...doc.data(), rideId: doc.id });
				});

				// Merge and sort
				const combined = [
					...acceptedRides,
					...allRides.filter((r) => r.status === "in_progress"),
				];
				combined.sort((a, b) => {
					const aTime = a.acceptedAt?.toMillis ? a.acceptedAt.toMillis() : 0;
					const bTime = b.acceptedAt?.toMillis ? b.acceptedAt.toMillis() : 0;
					return bTime - aTime;
				});
				allRides = combined;
				callback(combined);
			},
			(error) => {
				// Silently handle permission-denied errors (happens during logout)
				if (error.code === "permission-denied") {
					console.log(
						"🔒 Permission denied listening to accepted rides - user likely logged out"
					);
				} else {
					console.error("❌ Error listening to accepted rides:", error);
				}
			}
		);

		const unsubscribe2 = onSnapshot(
			qInProgress,
			(snapshot) => {
				const inProgressRides = [];
				snapshot.forEach((doc) => {
					inProgressRides.push({ ...doc.data(), rideId: doc.id });
				});

				// Merge and sort
				const combined = [
					...inProgressRides,
					...allRides.filter((r) => r.status === "accepted"),
				];
				combined.sort((a, b) => {
					const aTime = a.acceptedAt?.toMillis ? a.acceptedAt.toMillis() : 0;
					const bTime = b.acceptedAt?.toMillis ? b.acceptedAt.toMillis() : 0;
					return bTime - aTime;
				});
				allRides = combined;
				callback(combined);
			},
			(error) => {
				// Silently handle permission-denied errors (happens during logout)
				if (error.code === "permission-denied") {
					console.log(
						"🔒 Permission denied listening to in_progress rides - user likely logged out"
					);
				} else {
					console.error("❌ Error listening to in_progress rides:", error);
				}
			}
		);

		console.log("📨 Driver rides listener setup complete");

		return () => {
			unsubscribe1();
			unsubscribe2();
		};
	} catch (error) {
		console.error("❌ Error setting up driver rides listener:", error);
		return () => {};
	}
};

/**
 * Get ride by ID
 * @param {string} rideId - Ride ID
 * @returns {Promise<Object|null>} Ride data
 */
export const getRide = async (rideId) => {
	try {
		const rideRef = doc(FIREBASE_DB, "rides", rideId);
		const rideDoc = await getDoc(rideRef);

		if (rideDoc.exists()) {
			return { ...rideDoc.data(), rideId: rideDoc.id };
		}
		return null;
	} catch (error) {
		console.error("❌ Error getting ride:", error);
		return null;
	}
};

/**
 * Cancel a ride
 * @param {string} rideId - Ride ID
 * @returns {Promise<void>}
 */
export const cancelRide = async (rideId) => {
	try {
		const rideRef = doc(FIREBASE_DB, "rides", rideId);
		await updateDoc(rideRef, {
			status: "cancelled",
			cancelledAt: serverTimestamp(),
		});
		console.log("✅ Ride cancelled:", rideId);
	} catch (error) {
		console.error("❌ Error cancelling ride:", error);
		throw error;
	}
};

/**
 * Get customer ride history (completed and cancelled rides)
 * @param {string} customerId - Customer ID
 * @returns {Promise<Array>} Array of completed/cancelled rides
 */
export const getCustomerHistory = async (customerId) => {
	try {
		const ridesRef = collection(FIREBASE_DB, "rides");

		// Query for completed rides
		const completedQuery = query(
			ridesRef,
			where("customerId", "==", customerId),
			where("status", "==", "completed")
		);

		// Query for cancelled rides
		const cancelledQuery = query(
			ridesRef,
			where("customerId", "==", customerId),
			where("status", "==", "cancelled")
		);

		const [completedSnapshot, cancelledSnapshot] = await Promise.all([
			getDocs(completedQuery),
			getDocs(cancelledQuery),
		]);

		const rides = [];

		completedSnapshot.forEach((doc) => {
			rides.push({ ...doc.data(), rideId: doc.id });
		});

		cancelledSnapshot.forEach((doc) => {
			rides.push({ ...doc.data(), rideId: doc.id });
		});

		// Sort by completion/cancellation date (newest first)
		rides.sort((a, b) => {
			const aTime = (a.completedAt || a.cancelledAt)?.toMillis
				? (a.completedAt || a.cancelledAt).toMillis()
				: 0;
			const bTime = (b.completedAt || b.cancelledAt)?.toMillis
				? (b.completedAt || b.cancelledAt).toMillis()
				: 0;
			return bTime - aTime;
		});

		console.log("📜 Customer history fetched:", rides.length, "rides");
		return rides;
	} catch (error) {
		console.error("❌ Error getting customer history:", error);
		return [];
	}
};
