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

			const driverDoc = await tx.get(db.collection("drivers").doc(driverUid));
			const driverData = driverDoc.data();
			const subaccountId = driverData?.subaccountId || null;

			tx.update(rideRef, {
				status: "accepted",
				assignedDriverUid: driverUid,
				driverSubaccountId: subaccountId, // Save subaccount ID for payment split
				driverName: driverData?.fullname || "Driver", // Ensure driver name is saved
				driverPhone: driverData?.phone || "",
				vehicleId: driverData?.vehicle_id || "",
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

/**
 * createDriverSubAccount - Callable function to create a Flutterwave sub-account for a driver.
 * Input: { driverId, accountBank, accountNumber, businessName, businessEmail, businessMobile, splitValue }
 * Requires authentication.
 */
exports.createDriverSubAccount = functions.https.onCall(async (data, context) => {
	// 1. Authentication check
	if (!context.auth) {
		throw new functions.https.HttpsError(
			"unauthenticated",
			"The function must be called while authenticated."
		);
	}

	const {
		driverId,
		accountBank,
		accountNumber,
		businessName,
		businessEmail,
		businessMobile,
		splitValue = 50,
	} = data;

	// 2. Validation
	if (!driverId || !accountBank || !accountNumber || !businessName || !businessMobile) {
		throw new functions.https.HttpsError(
			"invalid-argument",
			"Missing required fields: driverId, accountBank, accountNumber, businessName, businessMobile"
		);
	}

	// Ensure the caller is the driver themselves or admin (optional strict check)
	if (context.auth.uid !== driverId) {
		throw new functions.https.HttpsError(
			"permission-denied",
			"You can only create a sub-account for yourself."
		);
	}

	try {
		const axios = require("axios");
		const FLUTTERWAVE_SECRET_KEY = "FLWSECK_TEST-f3c5c2ad9a10329d839b64ba46d167bd-X"; // Provided by user

		console.log(`Creating sub-account for driver: ${driverId}, Bank: ${accountBank}, Account: ${accountNumber}`);

		// 3. Call Flutterwave API
		const response = await axios.post(
			"https://api.flutterwave.com/v3/subaccounts",
			{
				account_bank: accountBank,
				account_number: accountNumber,
				business_name: businessName,
				business_email: businessEmail,
				business_mobile: businessMobile,
				country: "NG",
				split_type: "flat",
				split_value: splitValue,
			},
			{
				headers: {
					Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
					"Content-Type": "application/json",
				},
			}
		);

		const responseData = response.data;

		if (responseData.status !== "success") {
			throw new Error(responseData.message || "Flutterwave API failed");
		}

		const subaccountId = responseData.data.subaccount_id;
		const bankName = responseData.data.bank_name || "Unknown Bank";

		console.log(`Sub-account created successfully: ${subaccountId}`);

		// 4. Update Driver Firestore Document
		await db.collection("drivers").doc(driverId).update({
			bankName: bankName,
			bankCode: accountBank,
			accountNumber: accountNumber,
			accountName: businessName, // Assuming business name is account name
			subaccountId: subaccountId,
			subaccountCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
			bankDetailsVerified: true,
		});

		return {
			status: "success",
			message: "Sub-account created and linked successfully",
			data: {
				subaccountId,
				bankName,
			},
		};
	} catch (error) {
		console.error("Error creating sub-account:", error.response?.data || error.message);

		// Handle specific Flutterwave errors
		const errorMessage = error.response?.data?.message || error.message || "Failed to create sub-account";

		throw new functions.https.HttpsError(
			"internal",
			errorMessage
		);
	}
});
