import { FIREBASE_DB, FIREBASE_AUTH } from "../firebaseConfig";
import { createCardRide, cancelRideOnServer, checkRefundStatus } from "./flutterwaveRefund";

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


import {
	collection,
	doc,
	updateDoc,
	onSnapshot,
	query,
	where,
	orderBy,
	limit,
	startAfter,
	getDocs,
	getDoc,
	arrayUnion,
} from "firebase/firestore";

// Paid rides are created by the server: it verifies the Flutterwave charge, computes
// the fare, and notifies drivers. The app can't write ride documents directly.
export const createRide = async (rideData) => {
	const validationErrors = validateRideData(rideData);
	if (validationErrors.length > 0) {
		const message = `Ride data invalid: ${validationErrors.join('; ')}`;
		console.error('❌ createRide validation failed:', message);
		throw new Error(message);
	}

	const currentUser = FIREBASE_AUTH.currentUser;
	if (!currentUser) {
		throw new Error("No authenticated user found. Please log in again.");
	}
	if (currentUser.uid !== rideData.customerId) {
		throw new Error(
			`Auth mismatch: Firebase UID (${currentUser.uid}) !== customerId (${rideData.customerId})`
		);
	}
	if (!rideData.transactionId) {
		throw new Error("A completed payment is required to book a ride.");
	}

	const { rideId } = await createCardRide(rideData.transactionId, {
		customerName: rideData.customerName,
		customerPhone: rideData.customerPhone,
		customerPhotoURL: rideData.customerPhotoURL || null,
		pickupLocation: rideData.pickupLocation,
		pickupCoords: rideData.pickupCoords,
		destination: rideData.destination,
		destinationCoords: rideData.destinationCoords,
		numberOfPassengers: Number(rideData.numberOfPassengers),
	});
	console.log("✅ Ride created:", rideId);
	return rideId;
};

// The server decides who is cancelling (from the login token) and issues any refund,
// so `cancelledBy` is no longer sent; it's kept in the signature for existing callers.
export const cancelRideWithRefund = async (rideId, cancelledBy = 'customer', reason = '') => {
	const result = await cancelRideOnServer(rideId, reason);
	if (result.alreadyCancelled) {
		console.log("ℹ️ Ride already cancelled — no action taken");
	} else if (result.refundProcessing) {
		console.log("ℹ️ Cancellation already in progress — no action taken");
	} else {
		console.log(`✅ Ride cancelled by ${result.cancelledBy || cancelledBy}:`, rideId);
	}
	return result;
};

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

export const checkPendingRefunds = async (customerId) => {
	if (!customerId) return [];

	try {
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
							// Passing the rideId lets the server record a completed refund on the ride.
							status = await checkRefundStatus(ride.refundId, docSnapshot.id);
							break;
						} catch (e) {
							lastErr = e;
							if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
						}
					}
					if (!status) throw lastErr;

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

export const listenToPendingRides = (callback, driverId = null) => {
	try {
		const ridesRef = collection(FIREBASE_DB, "rides");
		const q = query(ridesRef, where("status", "==", "pending"), limit(50));

		const unsubscribe = onSnapshot(
			q,
			(snapshot) => {
				const rides = [];
				snapshot.forEach((doc) => {
					const rideData = doc.data();

					if (driverId) {
						const declinedBy = rideData.declined_by || [];
						if (declinedBy.includes(driverId)) {
							console.log(`🚫 Filtering out ride ${doc.id} - declined by driver ${driverId}`);
							return;
						}
					}

					rides.push({ ...rideData, rideId: doc.id });
				});
				rides.sort((a, b) => {
					const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
					const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
					return bTime - aTime;
				});
				console.log("📨 Pending rides updated:", rides.length);
				callback(rides);
			},
			(error) => {
				if (error.code === "permission-denied") {
					console.log(
						"🔒 Permission denied listening to pending rides - user likely logged out"
					);
				} else {
					console.error("❌ Error listening to pending rides:", error);
				}
				callback([]);
			}
		);

		return unsubscribe;
	} catch (error) {
		console.error("❌ Error setting up pending rides listener:", error);
		return () => { };
	}
};

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

		const completedQuery = query(
			ridesRef,
			where("customerId", "==", customerId),
			where("status", "==", "completed")
		);

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

export const getDriverHistory = async (driverId) => {
	try {
		const ridesRef = collection(FIREBASE_DB, "rides");

		const completedQuery = query(
			ridesRef,
			where("driverId", "==", driverId),
			where("status", "==", "completed")
		);

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

export const getCustomerHistoryPaginated = async (customerId, pageSize = 20, lastDoc = null) => {
	try {
		const ridesRef = collection(FIREBASE_DB, "rides");

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

		rides.sort((a, b) => {
			const aTime = (a.completedAt || a.cancelledAt)?.toMillis
				? (a.completedAt || a.cancelledAt).toMillis()
				: 0;
			const bTime = (b.completedAt || b.cancelledAt)?.toMillis
				? (b.completedAt || b.cancelledAt).toMillis()
				: 0;
			return bTime - aTime;
		});

		const paginatedRides = rides.slice(0, pageSize);

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

export const getDriverHistoryPaginated = async (driverId, pageSize = 20, lastDoc = null) => {
	try {
		const ridesRef = collection(FIREBASE_DB, "rides");

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

		rides.sort((a, b) => {
			const aTime = (a.completedAt || a.cancelledAt)?.toMillis
				? (a.completedAt || a.cancelledAt).toMillis()
				: 0;
			const bTime = (b.completedAt || b.cancelledAt)?.toMillis
				? (b.completedAt || b.cancelledAt).toMillis()
				: 0;
			return bTime - aTime;
		});

		const paginatedRides = rides.slice(0, pageSize);

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
