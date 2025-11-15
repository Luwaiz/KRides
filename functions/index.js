const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize admin SDK (uses default credentials in Cloud; locally use
// GOOGLE_APPLICATION_CREDENTIALS env var or the emulator)
admin.initializeApp();
const db = admin.firestore();
const fcm = admin.messaging();

/**
 * onRideCreated - Firestore trigger when a ride document is created.
 * Notifies drivers (broadly) via FCM and writes driver_inbox documents as a fallback.
 */
exports.onRideCreated = functions.firestore
	.document("rides/{rideId}")
	.onCreate(async (snap, context) => {
		const ride = snap.data();
		const rideId = context.params.rideId;
		console.log("onRideCreated:", rideId, ride);

		try {
			// Find all drivers who have tokens. For scaling, replace this by geo queries
			const driversSnap = await db
				.collection("users")
				.where("role", "==", "driver")
				.get();
			const promises = [];

			driversSnap.forEach((doc) => {
				const driver = doc.data();
				const driverUid = driver.uid;
				const tokens = driver.fcmTokens ? Object.keys(driver.fcmTokens) : [];

				// write a driver_inbox fallback doc
				const inboxRef = db
					.collection("driver_inbox")
					.doc(driverUid)
					.collection("rides")
					.doc(rideId);
				promises.push(
					inboxRef.set({
						rideId,
						ride,
						createdAt: admin.firestore.FieldValue.serverTimestamp(),
					})
				);

				if (tokens.length > 0) {
					const payload = {
						notification: {
							title: "New Ride Request",
							body: `${ride.rider_name || "Customer"} requested a ride`,
						},
						data: {
							type: "ride_booked",
							rideId: String(rideId),
						},
					};
					promises.push(
						fcm.sendToDevice(tokens, payload).catch((e) => {
							console.warn(
								"FCM sendToDevice failed for driver",
								driverUid,
								e.message || e
							);
						})
					);
				}
			});

			await Promise.all(promises);
			console.log("Notified drivers about ride", rideId);
		} catch (err) {
			console.error("Error in onRideCreated:", err);
		}
		return null;
	});

/**
 * acceptRide - Callable function for driver to accept a ride atomically.
 * Input: { rideId: string }
 * Requires authentication.
 */
exports.acceptRide = functions.https.onCall(async (data, context) => {
	if (!context.auth) {
		throw new functions.https.HttpsError(
			"unauthenticated",
			"The function must be called while authenticated."
		);
	}
	const driverUid = context.auth.uid;
	const rideId = data && data.rideId;
	if (!rideId) {
		throw new functions.https.HttpsError(
			"invalid-argument",
			"rideId is required"
		);
	}

	const rideRef = db.collection("rides").doc(rideId);

	try {
		await db.runTransaction(async (tx) => {
			const rideSnap = await tx.get(rideRef);
			if (!rideSnap.exists) {
				throw new functions.https.HttpsError("not-found", "Ride not found");
			}
			const ride = rideSnap.data();
			if (ride.status !== "pending") {
				throw new functions.https.HttpsError(
					"failed-precondition",
					"Ride is not pending"
				);
			}

			tx.update(rideRef, {
				status: "accepted",
				assignedDriverUid: driverUid,
				assignedAt: admin.firestore.FieldValue.serverTimestamp(),
			});
		});

		// Fetch customer tokens to notify
		const rideSnap2 = await rideRef.get();
		const ride2 = rideSnap2.data();
		const customerUid = ride2.customerUid;
		const customerDoc = await db.collection("users").doc(customerUid).get();
		const customer = customerDoc.exists ? customerDoc.data() : null;
		const tokens =
			customer && customer.fcmTokens ? Object.keys(customer.fcmTokens) : [];

		if (tokens.length > 0) {
			const payload = {
				notification: {
					title: "Ride Accepted",
					body: `Driver accepted your ride request`,
				},
				data: {
					type: "ride_accepted",
					rideId: String(rideId),
				},
			};
			await fcm
				.sendToDevice(tokens, payload)
				.catch((e) =>
					console.warn("FCM send to customer failed", e.message || e)
				);
		}

		// Write a notification doc for customer
		const notifRef = db
			.collection("notifications")
			.doc(customerUid)
			.collection("items")
			.doc();
		await notifRef.set({
			type: "ride_accepted",
			rideId,
			driverUid,
			createdAt: admin.firestore.FieldValue.serverTimestamp(),
			read: false,
		});

		return { status: "ok" };
	} catch (err) {
		console.error("acceptRide error", err);
		if (err instanceof functions.https.HttpsError) throw err;
		throw new functions.https.HttpsError(
			"internal",
			err.message || "Internal error"
		);
	}
});
