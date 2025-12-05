const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

// Initialize admin SDK (uses default credentials in Cloud; locally use
// GOOGLE_APPLICATION_CREDENTIALS env var or the emulator)
admin.initializeApp();
const db = admin.firestore();

/**
 * Helper function to send Expo Push Notification
 * @param {string} expoPushToken - The Expo push token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Optional data payload
 */
async function sendExpoPushNotification(expoPushToken, title, body, data = {}) {
	if (!expoPushToken) {
		console.warn("No push token provided");
		return null;
	}

	// Skip if not an Expo token
	if (!expoPushToken.startsWith("ExponentPushToken[")) {
		console.warn("Invalid Expo token format:", expoPushToken);
		return null;
	}

	const message = {
		to: expoPushToken,
		sound: "default",
		title: title,
		body: body,
		data: data,
	};

	try {
		console.log(`📤 Sending Expo notification to ${expoPushToken}: ${title}`);
		const response = await axios.post(
			"https://exp.host/--/api/v2/push/send",
			message,
			{
				headers: {
					Accept: "application/json",
					"Accept-encoding": "gzip, deflate",
					"Content-Type": "application/json",
				},
			}
		);

		console.log("✅ Expo notification sent:", response.data);
		return response.data;
	} catch (error) {
		console.error("❌ Error sending Expo notification:", error.message);
		return null;
	}
}

/**
 * onRideCreated - Firestore trigger when a ride document is created.
 * Notifies drivers via Expo Push Notifications.
 */
exports.onRideCreated = functions.firestore
	.document("rides/{rideId}")
	.onCreate(async (snap, context) => {
		const ride = snap.data();
		const rideId = context.params.rideId;
		console.log("onRideCreated:", rideId, ride);

		try {
			// Find all drivers who have push tokens
			const driversSnap = await db
				.collection("users")
				.where("role", "==", "driver")
				.get();
			const promises = [];

			driversSnap.forEach((doc) => {
				const driver = doc.data();
				const driverUid = driver.uid;
				const pushToken = driver.pushToken;

				// Write a driver_inbox fallback doc
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

				// Send Expo push notification if token exists
				if (pushToken) {
					promises.push(
						sendExpoPushNotification(
							pushToken,
							"New Ride Request 🚗",
							`${ride.customerName || "A customer"} requested a ride from ${ride.pickupLocation || "nearby"}`,
							{
								type: "ride_booked",
								rideId: String(rideId),
							}
						)
					);
				} else {
					console.log(`⚠️ Driver ${driverUid} has no push token`);
				}
			});

			await Promise.all(promises);
			console.log("✅ Notified drivers about ride", rideId);
		} catch (err) {
			console.error("❌ Error in onRideCreated:", err);
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

		// Fetch customer push token to notify
		const rideSnap2 = await rideRef.get();
		const ride2 = rideSnap2.data();
		const customerUid = ride2.customerId;
		const customerDoc = await db.collection("users").doc(customerUid).get();
		const customer = customerDoc.exists ? customerDoc.data() : null;
		const pushToken = customer?.pushToken;

		// Send Expo push notification to customer
		if (pushToken) {
			await sendExpoPushNotification(
				pushToken,
				"Ride Accepted! 🚗",
				`${ride2.driverName || "A driver"} is on the way to pick you up!`,
				{
					type: "ride_accepted",
					rideId: String(rideId),
				}
			);
		} else {
			console.log("⚠️ Customer has no push token");
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
 * onRideCompleted - Firestore trigger when a ride is completed.
 * Notifies customer via Expo Push Notifications.
 */
exports.onRideCompleted = functions.firestore
	.document("rides/{rideId}")
	.onUpdate(async (change, context) => {
		const before = change.before.data();
		const after = change.after.data();
		const rideId = context.params.rideId;

		// Only trigger if status changed to "completed"
		if (before.status !== "completed" && after.status === "completed") {
			console.log("onRideCompleted:", rideId);

			try {
				const customerUid = after.customerId;
				if (!customerUid) {
					console.warn("No customer ID found for ride", rideId);
					return null;
				}

				// Get customer push token
				const customerDoc = await db.collection("users").doc(customerUid).get();
				const customer = customerDoc.exists ? customerDoc.data() : null;
				const pushToken = customer?.pushToken;

				// Send Expo push notification
				if (pushToken) {
					await sendExpoPushNotification(
						pushToken,
						"Ride Completed! ✅",
						`Your ride has been completed. How was your experience?`,
						{
							type: "ride_completed",
							rideId: String(rideId),
						}
					);
					console.log("✅ Sent completion notification to customer");
				} else {
					console.log("⚠️ Customer has no push token");
				}

				// Write a notification doc for customer
				const notifRef = db
					.collection("notifications")
					.doc(customerUid)
					.collection("items")
					.doc();
				await notifRef.set({
					type: "ride_completed",
					rideId,
					createdAt: admin.firestore.FieldValue.serverTimestamp(),
					read: false,
				});
			} catch (err) {
				console.error("❌ Error in onRideCompleted:", err);
			}
		}

		return null;
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
