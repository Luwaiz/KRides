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
			pickupLocation: rideData.pickupLocation || "",
			pickupCoords: rideData.pickupCoords || null,
			destination: rideData.destination || "",
			destinationCoords: rideData.destinationCoords || null,
			numberOfPassengers: rideData.numberOfPassengers || 1,
			amount: rideData.amount || 0,
			status: "pending",
			driverId: null,
			driverName: null,
			driverPhone: null,
			vehicleId: null,
			paymentMethod: rideData.paymentMethod || "cash",
			transactionId: rideData.transactionId || null,
			createdAt: serverTimestamp(),
			acceptedAt: null,
			completedAt: null,
			cancelledAt: null,
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
 * Cancel a ride
 * @param {string} rideId - Ride ID
 * @param {string} cancelledBy - Who cancelled the ride ('customer' or 'driver')
 * @param {string} reason - Cancellation reason (optional)
 * @returns {Promise<void>}
 */
export const cancelRide = async (rideId, cancelledBy = 'customer', reason = '') => {
	try {
		const rideRef = doc(FIREBASE_DB, "rides", rideId);
		const updates = {
			status: "cancelled",
			cancelledAt: serverTimestamp(),
			cancelledBy,
		};

		if (reason) {
			updates.cancellationReason = reason;
		}

		await updateDoc(rideRef, updates);
		console.log(`✅ Ride cancelled by ${cancelledBy}:`, rideId);
	} catch (error) {
		console.error("❌ Error cancelling ride:", error);
		throw error;
	}
};

/**
 * Cancel a ride with automatic refund processing
 * @param {string} rideId - Ride ID
 * @param {string} cancelledBy - Who cancelled the ride ('customer' or 'driver')
 * @param {string} reason - Cancellation reason (optional)
 * @returns {Promise<Object>} Cancellation result with refund status
 */
export const cancelRideWithRefund = async (rideId, cancelledBy = 'customer', reason = '') => {
	try {
		const { processRefund } = require('./flutterwaveRefund');

		const rideRef = doc(FIREBASE_DB, "rides", rideId);

		// Get current ride data
		const rideDoc = await getDoc(rideRef);
		if (!rideDoc.exists()) {
			throw new Error("Ride not found");
		}

		const rideData = rideDoc.data();

		// Prepare cancellation updates
		const updates = {
			status: "cancelled",
			cancelledAt: serverTimestamp(),
			cancelledBy,
		};

		if (reason) {
			updates.cancellationReason = reason;
		}

		// Process refund if payment was made via Flutterwave
		if (rideData.transactionId && rideData.paymentMethod === 'flutterwave') {
			try {
				console.log("💰 Processing refund for cancelled ride...");
				console.log("   Transaction ID:", rideData.transactionId);
				console.log("   Amount:", rideData.amount);

				const refundResult = await processRefund(
					rideData.transactionId,
					null, // Full refund
					reason || `Ride cancelled by ${cancelledBy}`
				);

				if (refundResult.success) {
					updates.refundStatus = "completed";
					updates.refundId = refundResult.refundId;
					updates.refundedAt = serverTimestamp();
					updates.refundAmount = rideData.amount;

					console.log("✅ Refund processed successfully:", refundResult.refundId);
				}
			} catch (refundError) {
				console.error("❌ Refund failed:", refundError.message);

				// Still cancel the ride, but mark refund as failed
				updates.refundStatus = "failed";
				updates.refundError = refundError.message;
			}
		} else {
			console.log("ℹ️ No payment to refund (cash payment or no transaction ID)");
		}

		// Update ride document
		await updateDoc(rideRef, updates);
		console.log(`✅ Ride cancelled by ${cancelledBy}:`, rideId);

		return updates;
	} catch (error) {
		console.error("❌ Error cancelling ride:", error);
		throw error;
	}
};

/**
 * Decline a ride (driver side)
 * Adds driver ID to declined_by array so ride won't show for this driver again
 * @param {string} rideId - Ride ID
 * @param {string} driverId - Driver ID who declined
 * @returns {Promise<void>}
 */
export const declineRide = async (rideId, driverId) => {
	try {
		const rideRef = doc(FIREBASE_DB, "rides", rideId);
		const rideDoc = await getDoc(rideRef);

		if (!rideDoc.exists()) {
			throw new Error("Ride not found");
		}

		const rideData = rideDoc.data();
		const declinedBy = rideData.declined_by || [];

		// Add driver to declined_by array if not already there
		if (!declinedBy.includes(driverId)) {
			await updateDoc(rideRef, {
				declined_by: [...declinedBy, driverId],
			});
			console.log(`✅ Ride ${rideId} declined by driver ${driverId}`);
		} else {
			console.log(`ℹ️ Driver ${driverId} already declined ride ${rideId}`);
		}
	} catch (error) {
		console.error("❌ Error declining ride:", error);
		throw error;
	}
};

/**
 * Check and update pending refund statuses
 * Useful for monitoring refunds that are still processing
 * @returns {Promise<Array>} Array of refund status updates
 */
export const checkPendingRefunds = async () => {
	try {
		const { checkRefundStatus } = require('./flutterwaveRefund');

		const ridesRef = collection(FIREBASE_DB, "rides");
		const q = query(
			ridesRef,
			where("refundStatus", "==", "pending")
		);

		const snapshot = await getDocs(q);
		const pendingRefunds = [];

		for (const docSnapshot of snapshot.docs) {
			const ride = docSnapshot.data();
			if (ride.refundId) {
				try {
					const status = await checkRefundStatus(ride.refundId);

					// Update Firestore if status changed
					if (status.status === "completed") {
						const rideRef = doc(FIREBASE_DB, "rides", docSnapshot.id);
						await updateDoc(rideRef, {
							refundStatus: "completed",
							refundedAt: serverTimestamp(),
						});
					}

					pendingRefunds.push({
						rideId: docSnapshot.id,
						refundId: ride.refundId,
						status: status.status,
						updated: status.status === "completed",
					});
				} catch (error) {
					console.error(`Error checking refund ${ride.refundId}:`, error);
				}
			}
		}

		console.log(`📊 Checked ${pendingRefunds.length} pending refunds`);
		return pendingRefunds;
	} catch (error) {
		console.error("❌ Error checking pending refunds:", error);
		return [];
	}
};

/**
 * Listen to pending rides (driver side)
 * @param {Function} callback - Called with array of pending rides
 * @param {string} driverId - Optional driver ID to filter out declined rides
 * @returns {Function} Unsubscribe function
 */
export const listenToPendingRides = (callback, driverId = null) => {
	try {
		const ridesRef = collection(FIREBASE_DB, "rides");
		// Simple query without orderBy to avoid index requirement
		const q = query(ridesRef, where("status", "==", "pending"));

		const unsubscribe = onSnapshot(
			q,
			(snapshot) => {
				const rides = [];
				snapshot.forEach((doc) => {
					const rideData = doc.data();

					// Filter out rides declined by this driver
					if (driverId) {
						const declinedBy = rideData.declined_by || [];
						if (declinedBy.includes(driverId)) {
							console.log(`🚫 Filtering out ride ${doc.id} - declined by driver ${driverId}`);
							return; // Skip this ride
						}
					}

					rides.push({ ...rideData, rideId: doc.id });
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
		return () => { };
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
		return () => { };
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
		return () => { };
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
		return () => { };
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

/**
 * Get driver ride history (completed and cancelled rides)
 * @param {string} driverId - Driver ID
 * @returns {Promise<Array>} Array of completed/cancelled rides
 */
export const getDriverHistory = async (driverId) => {
	try {
		const ridesRef = collection(FIREBASE_DB, "rides");

		// Query for completed rides
		const completedQuery = query(
			ridesRef,
			where("driverId", "==", driverId),
			where("status", "==", "completed")
		);

		// Query for cancelled rides
		const cancelledQuery = query(
			ridesRef,
			where("driverId", "==", driverId),
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

		console.log("📜 Driver history fetched:", rides.length, "rides");
		return rides;
	} catch (error) {
		console.error("❌ Error getting driver history:", error);
		return [];
	}
};
