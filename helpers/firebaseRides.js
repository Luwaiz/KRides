import { FIREBASE_DB } from "../firebaseConfig";
import { NOTIFICATION_API_KEY } from "@env";

// ── Validation ────────────────────────────────────────────────────────────────

const VALID_STATUSES = new Set(['pending', 'accepted', 'in_progress', 'completed', 'cancelled']);

function isValidCoord(lat, lng) {
	return (
		typeof lat === 'number' && isFinite(lat) && lat >= -90 && lat <= 90 &&
		typeof lng === 'number' && isFinite(lng) && lng >= -180 && lng <= 180
	);
}

function validateRideData(data) {
	const errors = [];

	if (!data.customerId || typeof data.customerId !== 'string') {
		errors.push('customerId is required');
	}

	const amount = Number(data.amount);
	if (!isFinite(amount) || amount <= 0) {
		errors.push(`amount must be a positive number (got ${data.amount})`);
	}

	const passengers = Number(data.numberOfPassengers);
	if (!Number.isInteger(passengers) || passengers < 1 || passengers > 10) {
		errors.push(`numberOfPassengers must be 1–10 (got ${data.numberOfPassengers})`);
	}

	if (!data.pickupLocation || !String(data.pickupLocation).trim()) {
		errors.push('pickupLocation is required');
	} else if (String(data.pickupLocation).length > 200) {
		errors.push('pickupLocation exceeds maximum length (200 chars)');
	}

	if (!data.destination || !String(data.destination).trim()) {
		errors.push('destination is required');
	} else if (String(data.destination).length > 200) {
		errors.push('destination exceeds maximum length (200 chars)');
	}

	if (data.customerName && String(data.customerName).length > 100) {
		errors.push('customerName exceeds maximum length (100 chars)');
	}

	if (data.customerPhone && String(data.customerPhone).length > 20) {
		errors.push('customerPhone exceeds maximum length (20 chars)');
	}

	if (!data.pickupCoords) {
		errors.push('pickupCoords are required');
	} else {
		const { latitude: lat, longitude: lng } = data.pickupCoords;
		if (!isValidCoord(lat, lng)) {
			errors.push(`pickupCoords are invalid (lat=${lat}, lng=${lng})`);
		}
	}

	if (!data.destinationCoords) {
		errors.push('destinationCoords are required');
	} else {
		const { latitude: lat, longitude: lng } = data.destinationCoords;
		if (!isValidCoord(lat, lng)) {
			errors.push(`destinationCoords are invalid (lat=${lat}, lng=${lng})`);
		}
	}

	return errors;
}

// ── Imports ───────────────────────────────────────────────────────────────────

import {
	collection,
	doc,
	setDoc,
	updateDoc,
	onSnapshot,
	query,
	where,
	orderBy,
	limit,
	startAfter,
	serverTimestamp,
	getDocs,
	getDoc,
	runTransaction,
	arrayUnion,
} from "firebase/firestore";

const PAYMENTS_SERVER_URL = 'https://krides.onrender.com/api/payments';
import {
	notifyDriversAboutNewRide,
	notifyCustomerRideCompleted,
} from "./notificationHelpers";

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
	const validationErrors = validateRideData(rideData);
	if (validationErrors.length > 0) {
		const message = `Ride data invalid: ${validationErrors.join('; ')}`;
		console.error('❌ createRide validation failed:', message);
		throw new Error(message);
	}

	try {
		// Import FIREBASE_AUTH to check current user
		const { FIREBASE_AUTH } = require("../firebaseConfig");
		const currentUser = FIREBASE_AUTH.currentUser;

		console.log("🔐 createRide - Auth Check: UIDs match:", currentUser?.uid === rideData.customerId);

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
			customerName: (rideData.customerName || "").trim(),
			customerPhone: (rideData.customerPhone || "").trim(),
			customerPhotoURL: rideData.customerPhotoURL || null,
			pickupLocation: (rideData.pickupLocation || "").trim(),
			pickupCoords: rideData.pickupCoords || null,
			destination: (rideData.destination || "").trim(),
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

		// Fire-and-forget: if notification fails, mark the ride so the
		// customer's listener can surface a warning instead of silently waiting.
		notifyDriversAboutNewRide(
			rideId,
			rideData.customerName,
			rideData.pickupLocation,
			rideData.destination
		).catch(async (err) => {
			console.warn("⚠️ Driver notification failed:", err.message);
			updateDoc(rideDoc, { notificationFailed: true }).catch(() => {});
		});

		return rideId;
	} catch (error) {
		console.error("❌ Error creating ride:", error);
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
	if (!VALID_STATUSES.has(status)) {
		throw new Error(
			`Invalid ride status: "${status}". Must be one of: ${[...VALID_STATUSES].join(', ')}`
		);
	}

	try {
		const rideRef = doc(FIREBASE_DB, "rides", rideId);
		const updates = { status };

		if (status === "completed") {
			updates.completedAt = serverTimestamp();
		}

		await updateDoc(rideRef, updates);
		console.log(`✅ Ride status updated to ${status}:`, rideId);
		if (status === "completed") {
			const rideDoc = await getDoc(rideRef);
			if (rideDoc.exists()) {
				const rideData = rideDoc.data();
				if (rideData.customerId) {
					await notifyCustomerRideCompleted(rideData.customerId, rideId);
				}
			}
		}
	} catch (error) {
		console.error("❌ Error updating ride status:", error);
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
	const { processRefund } = require('./flutterwaveRefund');
	const rideRef = doc(FIREBASE_DB, "rides", rideId);

	// Atomically claim the cancellation slot. If another request already
	// set refundProcessing=true or already cancelled, we bail out early —
	// this prevents a double-refund when the user taps Cancel twice or when
	// two code paths race.
	let rideData;
	try {
		await runTransaction(FIREBASE_DB, async (txn) => {
			const snap = await txn.get(rideRef);
			if (!snap.exists()) throw new Error("RIDE_NOT_FOUND");
			const data = snap.data();
			if (data.status === 'cancelled') throw new Error("ALREADY_CANCELLED");
			if (data.refundProcessing === true) throw new Error("REFUND_IN_PROGRESS");
			txn.update(rideRef, { refundProcessing: true });
			rideData = data;
		});
	} catch (err) {
		if (err.message === "ALREADY_CANCELLED") {
			console.log("ℹ️ Ride already cancelled — no action taken");
			return { status: "cancelled", alreadyCancelled: true };
		}
		if (err.message === "REFUND_IN_PROGRESS") {
			console.log("ℹ️ Cancellation already in progress — no action taken");
			return { status: "pending", refundProcessing: true };
		}
		if (err.message === "RIDE_NOT_FOUND") throw new Error("Ride not found");
		throw err;
	}

	const updates = {
		status: "cancelled",
		cancelledAt: serverTimestamp(),
		cancelledBy,
		refundProcessing: false, // Release the lock regardless of outcome
	};

	if (reason) updates.cancellationReason = reason;

	// Process refund if payment was made via Flutterwave
	if (rideData.transactionId && rideData.paymentMethod === 'flutterwave') {
		try {
			console.log("💰 Processing refund for cancelled ride, amount:", rideData.amount);

			const refundResult = await processRefund(
				rideData.transactionId,
				null, // Full refund
				reason || `Ride cancelled by ${cancelledBy}`
			);

			if (refundResult.success) {
				updates.refundId = refundResult.refundId;
				updates.refundAmount = rideData.amount;
				if (refundResult.status === 'completed') {
					updates.refundStatus = "completed";
					updates.refundedAt = serverTimestamp();
				} else {
					// Flutterwave processing async — checkPendingRefunds will poll for completion
					updates.refundStatus = "pending";
				}
				console.log("✅ Refund initiated:", refundResult.refundId, "status:", refundResult.status);
			}
		} catch (refundError) {
			console.error("❌ Refund failed:", refundError.message);
			updates.refundStatus = "failed";
			updates.refundError = refundError.message;
		}
	} else if (rideData.paymentMethod === 'wallet' && rideData.customerId) {
		try {
			console.log("💰 Processing wallet refund for cancelled ride...");
			const { FIREBASE_AUTH } = require("../firebaseConfig");
			const idToken = await FIREBASE_AUTH.currentUser?.getIdToken();
			if (!idToken) throw new Error("No authenticated user for wallet refund");

			// Match flutterwaveRefund.js's timeout — an unbounded fetch here could
			// hang indefinitely after the server already committed the credit,
			// leaving walletRefundStatus stuck out of sync with reality.
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 10000);
			let response;
			try {
				response = await fetch(`${PAYMENTS_SERVER_URL}/wallet-refund`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'x-api-key': NOTIFICATION_API_KEY || '',
						'Authorization': `Bearer ${idToken}`,
					},
					body: JSON.stringify({ idToken, rideId }),
					signal: controller.signal,
				});
			} finally {
				clearTimeout(timeoutId);
			}
			const result = await response.json();

			if (result.success) {
				updates.walletRefundStatus = 'completed';
				updates.walletRefunded = true;
				updates.refundAmount = rideData.amount;
				console.log(`✅ Wallet refund of ₦${rideData.amount} processed`);
			} else {
				updates.walletRefundStatus = 'failed';
				updates.walletRefundError = result.error;
				console.error("❌ Wallet refund failed:", result.error);
			}
		} catch (walletRefundErr) {
			console.error("❌ Wallet refund error:", walletRefundErr.message);
			updates.walletRefundStatus = 'failed';
			updates.walletRefundError = walletRefundErr.message;
		}
	} else if (rideData.paymentMethod === 'flutterwave' && !rideData.transactionId) {
		// Paid via Flutterwave but transaction ID is missing (callback lost mid-flow)
		// Flag for manual support review so the customer isn't silently left without a refund.
		console.warn("⚠️ Flutterwave payment with no transactionId — flagging for manual review");
		updates.refundStatus = 'needs_review';
		updates.needsManualRefundReview = true;
		updates.refundReviewReason = 'Flutterwave transactionId missing at cancellation time';
	} else {
		console.log("ℹ️ Cash ride — no refund needed");
	}

	try {
		await updateDoc(rideRef, updates);
		console.log(`✅ Ride cancelled by ${cancelledBy}:`, rideId);
	} catch (writeError) {
		// Release the processing lock even if the full update fails
		updateDoc(rideRef, { refundProcessing: false }).catch(() => {});
		throw writeError;
	}

	return updates;
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

		if (declinedBy.includes(driverId)) {
			console.log(`ℹ️ Driver ${driverId} already declined ride ${rideId}`);
			return;
		}

		if (declinedBy.length >= 100) {
			console.warn(`⚠️ Ride ${rideId} declined_by array at cap, skipping`);
			return;
		}

		await updateDoc(rideRef, {
			declined_by: arrayUnion(driverId),
		});
		console.log(`✅ Ride ${rideId} declined by driver ${driverId}`);
	} catch (error) {
		console.error("❌ Error declining ride:", error);
		throw error;
	}
};

/**
 * Check and update pending refund statuses for one customer
 * Useful for monitoring refunds that are still processing
 * @param {string} customerId - Customer ID (required — firestore.rules rejects
 *   an unscoped query across the whole rides collection outright, since it
 *   can't guarantee every match belongs to the requesting user)
 * @returns {Promise<Array>} Array of refund status updates
 */
export const checkPendingRefunds = async (customerId) => {
	if (!customerId) return [];

	try {
		const { checkRefundStatus } = require('./flutterwaveRefund');

		const ridesRef = collection(FIREBASE_DB, "rides");
		const q = query(
			ridesRef,
			where("customerId", "==", customerId),
			where("refundStatus", "==", "pending")
		);

		const snapshot = await getDocs(q);
		const pendingRefunds = [];

		for (const docSnapshot of snapshot.docs) {
			const ride = docSnapshot.data();
			if (ride.refundId) {
				try {
					let status, lastErr;
					for (let attempt = 0; attempt < 3; attempt++) {
						try {
							status = await checkRefundStatus(ride.refundId);
							break;
						} catch (e) {
							lastErr = e;
							if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
						}
					}
					if (!status) throw lastErr;

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
					pendingRefunds.push({
						rideId: docSnapshot.id,
						refundId: ride.refundId,
						status: "check_failed",
						error: error.message,
					});
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
		// Cap at 50 — avoids a full-collection scan when many rides accumulate.
		const q = query(ridesRef, where("status", "==", "pending"), limit(50));

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

/**
 * Get customer ride history with pagination
 * @param {string} customerId - Customer ID
 * @param {number} pageSize - Number of rides per page (default: 20)
 * @param {Object} lastDoc - Last document from previous page (for pagination)
 * @returns {Promise<{rides: Array, lastVisible: Object, hasMore: boolean}>}
 */
export const getCustomerHistoryPaginated = async (customerId, pageSize = 20, lastDoc = null) => {
	try {
		const ridesRef = collection(FIREBASE_DB, "rides");

		// Ordered by date so startAfter(lastDoc) actually advances the page
		// instead of re-fetching the same first batch every time — this needs
		// a composite index per status (customerId + status + completedAt /
		// cancelledAt); Firestore will log a console link to create it on
		// first use if it's missing.
		const completedQuery = query(
			ridesRef,
			where("customerId", "==", customerId),
			where("status", "==", "completed"),
			orderBy("completedAt", "desc"),
			...(lastDoc?.completed ? [startAfter(lastDoc.completed)] : []),
			limit(pageSize)
		);

		const cancelledQuery = query(
			ridesRef,
			where("customerId", "==", customerId),
			where("status", "==", "cancelled"),
			orderBy("cancelledAt", "desc"),
			...(lastDoc?.cancelled ? [startAfter(lastDoc.cancelled)] : []),
			limit(pageSize)
		);

		const [completedSnapshot, cancelledSnapshot] = await Promise.all([
			getDocs(completedQuery),
			getDocs(cancelledQuery),
		]);

		const rides = [];
		let lastCompletedDoc = lastDoc?.completed || null;
		let lastCancelledDoc = lastDoc?.cancelled || null;

		completedSnapshot.forEach((doc) => {
			rides.push({ ...doc.data(), rideId: doc.id });
			lastCompletedDoc = doc;
		});

		cancelledSnapshot.forEach((doc) => {
			rides.push({ ...doc.data(), rideId: doc.id });
			lastCancelledDoc = doc;
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

		// Limit to pageSize after merging
		const paginatedRides = rides.slice(0, pageSize);

		// Check if there are more rides
		const hasMore = completedSnapshot.size === pageSize || cancelledSnapshot.size === pageSize;

		const lastVisible = {
			completed: lastCompletedDoc,
			cancelled: lastCancelledDoc
		};

		console.log("📜 Customer history (paginated) fetched:", paginatedRides.length, "rides, hasMore:", hasMore);
		return { rides: paginatedRides, lastVisible, hasMore };
	} catch (error) {
		console.error("❌ Error getting customer history (paginated):", error);
		return { rides: [], lastVisible: null, hasMore: false };
	}
};

/**
 * Get driver ride history with pagination
 * @param {string} driverId - Driver ID
 * @param {number} pageSize - Number of rides per page (default: 20)
 * @param {Object} lastDoc - Last document from previous page (for pagination)
 * @returns {Promise<{rides: Array, lastVisible: Object, hasMore: boolean}>}
 */
export const getDriverHistoryPaginated = async (driverId, pageSize = 20, lastDoc = null) => {
	try {
		const ridesRef = collection(FIREBASE_DB, "rides");

		// Ordered by date so startAfter(lastDoc) actually advances the page
		// instead of re-fetching the same first batch every time — this needs
		// a composite index per status (driverId + status + completedAt /
		// cancelledAt); Firestore will log a console link to create it on
		// first use if it's missing.
		const completedQuery = query(
			ridesRef,
			where("driverId", "==", driverId),
			where("status", "==", "completed"),
			orderBy("completedAt", "desc"),
			...(lastDoc?.completed ? [startAfter(lastDoc.completed)] : []),
			limit(pageSize)
		);

		const cancelledQuery = query(
			ridesRef,
			where("driverId", "==", driverId),
			where("status", "==", "cancelled"),
			orderBy("cancelledAt", "desc"),
			...(lastDoc?.cancelled ? [startAfter(lastDoc.cancelled)] : []),
			limit(pageSize)
		);

		const [completedSnapshot, cancelledSnapshot] = await Promise.all([
			getDocs(completedQuery),
			getDocs(cancelledQuery),
		]);

		const rides = [];
		let lastCompletedDoc = lastDoc?.completed || null;
		let lastCancelledDoc = lastDoc?.cancelled || null;

		completedSnapshot.forEach((doc) => {
			rides.push({ ...doc.data(), rideId: doc.id });
			lastCompletedDoc = doc;
		});

		cancelledSnapshot.forEach((doc) => {
			rides.push({ ...doc.data(), rideId: doc.id });
			lastCancelledDoc = doc;
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

		// Limit to pageSize after merging
		const paginatedRides = rides.slice(0, pageSize);

		// Check if there are more rides
		const hasMore = completedSnapshot.size === pageSize || cancelledSnapshot.size === pageSize;

		const lastVisible = {
			completed: lastCompletedDoc,
			cancelled: lastCancelledDoc
		};

		console.log("📜 Driver history (paginated) fetched:", paginatedRides.length, "rides, hasMore:", hasMore);
		return { rides: paginatedRides, lastVisible, hasMore };
	} catch (error) {
		console.error("❌ Error getting driver history (paginated):", error);
		return { rides: [], lastVisible: null, hasMore: false };
	}
};
