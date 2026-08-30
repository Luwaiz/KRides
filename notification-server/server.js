const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const crypto = require('crypto');
const { sendDriverReportEmail, sendDriverWelcomeEmail } = require('./emailservice');
require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 3001;

// Middleware
// The mobile app calls this over React Native's fetch, which doesn't enforce
// browser CORS, so this permissive policy is harmless for /api. Scoped to
// /api specifically (not global) — the cors package treats `origin: false`
// as falsy and actually answers every preflight with Allow-Origin: *, and if
// this ran unscoped it would run first for every /admin-api request too
// (cors() ends OPTIONS requests itself without calling next()), pre-empting
// the origin-allowlisted policy registered further down for /admin-api.
app.use('/api', cors({ origin: false }));
app.use(express.json());

// API key authentication — all /api/* routes require a valid key.
// The key is shared with the mobile app via an environment variable so it
// never appears in source control. Set NOTIFICATION_API_KEY in your .env
// and as an EAS Secret for production builds.
const API_KEY = process.env.NOTIFICATION_API_KEY;

// Admin web app — separate key from the mobile app's (extracting one
// shouldn't hand out the other), separate route prefix (so it's exempt from
// the /api middleware below), and an explicit CORS origin allowlist since,
// unlike the mobile app, this one's a real browser.
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const ADMIN_ALLOWED_ORIGINS = (process.env.ADMIN_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

app.use('/admin-api', cors({
    origin: (origin, callback) => {
        // No Origin header = non-browser caller (curl, server-to-server) — allow.
        if (!origin || ADMIN_ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        // Passing an Error here (rather than `callback(null, false)`) makes the
        // cors package call next(err) instead of next() — Express then skips
        // straight to its default error handler and returns a raw stack trace
        // (confirmed by actually sending a disallowed-origin request). Failing
        // "quietly" instead just omits Access-Control-Allow-Origin, which is
        // what actually blocks a real browser — the request still reaches the
        // real access gate below (the x-admin-key check), same as it would for
        // any non-browser caller.
        callback(null, false);
    },
}));

app.use('/admin-api', (req, res, next) => {
    if (!ADMIN_API_KEY) {
        console.error('❌ ADMIN_API_KEY is not set');
        return res.status(503).json({ error: 'Admin panel not configured' });
    }
    if (req.path === '/login') return next();
    const provided = req.headers['x-admin-key'];
    if (!provided || provided !== ADMIN_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});

// 'manual' (default): driver payouts are queued for manual transfer instead
// of calling Flutterwave's Transfers API — see the comment on it in
// complete-ride. Set PAYOUT_MODE=automatic once IP whitelisting is sorted.
const PAYOUT_MODE = process.env.PAYOUT_MODE || 'manual';
console.log(`💳 Payout mode: ${PAYOUT_MODE}`);

app.use('/api', (req, res, next) => {
    // Flutterwave webhook uses its own signature verification — exempt from API key check
    if (req.path === '/wallet/webhook') return next();

    if (!API_KEY) {
        console.error('❌ NOTIFICATION_API_KEY is not set');
        return res.status(503).json({ error: 'Server not configured' });
    }
    const provided = req.headers['x-api-key'];
    if (!provided || provided !== API_KEY) {
        console.warn('🚫 Rejected request with invalid API key from', req.ip);
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});

// Initialize Firebase Admin SDK
// Load credentials from env var (JSON string) to avoid committing service account keys.
// Set FIREBASE_ADMIN_SDK in your .env file and as a Render environment secret.
if (!process.env.FIREBASE_ADMIN_SDK) {
    console.error('❌ FIREBASE_ADMIN_SDK environment variable is not set');
    process.exit(1);
}
// The value is stored as base64 to survive env var escaping issues with the
// private key's newlines. Decode it before parsing.
const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_ADMIN_SDK, 'base64').toString('utf8')
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://kampusride.firebaseio.com"
});

const db = admin.firestore();

// Using Firebase Cloud Messaging (FCM) for push notifications
console.log('✅ Firebase Admin SDK initialized for FCM notifications');

/**
 * Helper function to send FCM Push Notification with retry logic
 * Uses Firebase Admin SDK instead of Expo's push service
 * @param {string} fcmToken - The FCM push token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Optional data payload
 */
async function sendFCMNotification(fcmToken, title, body, data = {}) {
    if (!fcmToken) {
        console.warn('No push token provided');
        return { success: false, error: 'No push token' };
    }

    // Build FCM message
    const message = {
        token: fcmToken,
        notification: {
            title: title,
            body: body,
        },
        data: {
            ...data,
            // Convert all data values to strings (FCM requirement)
            title: title,
            body: body,
        },
        android: {
            priority: 'high',
            notification: {
                sound: 'default',
                channelId: 'default',
            },
        },
        apns: {
            payload: {
                aps: {
                    sound: 'default',
                    badge: 1,
                },
            },
        },
    };

    // Retry configuration
    const maxRetries = 2;
    const initialDelay = 500;
    const maxDelay = 4000;
    const backoffMultiplier = 2;
    // If a send times out we cannot know whether FCM queued it already,
    // so we treat timeouts as ambiguous and do NOT retry to avoid duplicates.
    const FCM_SEND_TIMEOUT_MS = 8000;

    const permanentErrors = [
        'messaging/invalid-registration-token',
        'messaging/registration-token-not-registered',
        'messaging/invalid-argument',
        'messaging/invalid-recipient',
    ];

    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            console.log(`📤 Sending FCM notification to ${fcmToken.substring(0, 20)}...: ${title} (attempt ${attempt + 1}/${maxRetries + 1})`);

            // Race the send against a timeout. A timeout is treated as ambiguous —
            // FCM may have already accepted the message, so we do NOT retry.
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('FCM_SEND_TIMEOUT')), FCM_SEND_TIMEOUT_MS)
            );

            const response = await Promise.race([
                admin.messaging().send(message),
                timeoutPromise,
            ]);

            console.log('✅ FCM notification sent successfully:', response);
            return { success: true, messageId: response };

        } catch (error) {
            lastError = error;
            console.log(`   ❌ FCM error:`, error.code || error.message);

            // Timeout — ambiguous outcome, do not retry to prevent duplicate delivery
            if (error.message === 'FCM_SEND_TIMEOUT') {
                console.warn('⚠️ FCM send timed out — not retrying to avoid duplicate delivery');
                return { success: false, error: 'timeout', message: 'Send timed out; message may have been delivered' };
            }

            // Permanent errors — retrying will never help
            if (permanentErrors.includes(error.code)) {
                console.warn(`🚫 Permanent error (${error.code}), not retrying`);
                return { success: false, error: error.code, message: error.message, permanent: true };
            }

            if (attempt === maxRetries) {
                console.error(`❌ FCM notification failed after ${maxRetries + 1} attempts:`, error.message);
                return { success: false, error: error.code || 'unknown', message: error.message };
            }

            const delay = Math.min(initialDelay * Math.pow(backoffMultiplier, attempt), maxDelay);
            console.log(`⚠️ Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms — ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    return {
        success: false,
        error: lastError?.code || 'unknown',
        message: lastError?.message || 'Unknown error'
    };
}

/**
 * POST /api/notifications/send
 * Send a push notification to a specific user
 * 
 * Body: {
 *   userId: string,
 *   role: 'customer' | 'driver',
 *   title: string,
 *   body: string,
 *   data: object (optional)
 * }
 */
app.post('/api/notifications/send', async (req, res) => {
    try {
        const { userId, role, title, body, data } = req.body;

        if (!userId || !role || !title || !body) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userId, role, title, body'
            });
        }

        // Get user's push token from Firestore
        const collectionName = role === 'driver' ? 'drivers' : 'users';
        const userDoc = await db.collection(collectionName).doc(userId).get();

        if (!userDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const userData = userDoc.data();
        const pushToken = userData.fcmToken;

        if (!pushToken) {
            return res.json({ success: false, skipped: true, reason: 'no_push_token' });
        }

        // Send notification
        const result = await sendFCMNotification(pushToken, title, body, data || {});

        res.json(result);
    } catch (error) {
        console.error('Error in /api/notifications/send:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/notifications/send-bulk
 * Send notifications to multiple users
 * 
 * Body: {
 *   userIds: string[],
 *   role: 'customer' | 'driver',
 *   title: string,
 *   body: string,
 *   data: object (optional)
 * }
 */
app.post('/api/notifications/send-bulk', async (req, res) => {
    try {
        const { userIds, role, title, body, data } = req.body;

        if (!userIds || !Array.isArray(userIds) || !role || !title || !body) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userIds (array), role, title, body'
            });
        }

        const collectionName = role === 'driver' ? 'drivers' : 'users';
        const results = [];

        // Get all user tokens
        for (const userId of userIds) {
            const userDoc = await db.collection(collectionName).doc(userId).get();

            if (userDoc.exists) {
                const userData = userDoc.data();
                const pushToken = userData.fcmToken;

                if (pushToken) {
                    const result = await sendFCMNotification(pushToken, title, body, data || {});
                    results.push({ userId, ...result });
                } else {
                    results.push({ userId, success: false, error: 'No push token' });
                }
            } else {
                results.push({ userId, success: false, error: 'User not found' });
            }
        }

        const successCount = results.filter(r => r.success).length;

        res.json({
            success: true,
            totalSent: successCount,
            totalFailed: results.length - successCount,
            results
        });
    } catch (error) {
        console.error('Error in /api/notifications/send-bulk:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/notifications/notify-drivers
 * Notify all drivers about a new ride
 * 
 * Body: {
 *   rideId: string,
 *   customerName: string,
 *   pickupLocation: string,
 *   destination: string
 * }
 */
app.post('/api/notifications/notify-drivers', async (req, res) => {
    try {
        const { rideId, customerName, pickupLocation, destination } = req.body;

        if (!rideId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: rideId'
            });
        }

        // Only notify drivers who are currently online — avoids scanning the
        // entire drivers collection on every booking.
        const driversSnapshot = await db.collection('drivers')
            .where('isOnline', '==', true)
            .limit(100)
            .get();
        const results = [];

        for (const doc of driversSnapshot.docs) {
            const driver = doc.data();
            const pushToken = driver.fcmToken;

            if (pushToken) {
                const result = await sendFCMNotification(
                    pushToken,
                    'New Ride Request 🚗',
                    `${customerName || 'A customer'} requested a ride from ${pickupLocation || 'nearby'} to ${destination || 'destination'}`,
                    {
                        type: 'ride_booked',
                        rideId: String(rideId),
                    }
                );
                results.push({ driverId: doc.id, ...result });
                if (result.permanent) {
                    await db.collection('drivers').doc(doc.id).update({ fcmToken: null });
                    console.log(`🧹 Cleared stale FCM token for driver ${doc.id}`);
                }
            } else {
                console.log(`⚠️ Driver ${doc.id} has no push token`);
            }
        }

        const successCount = results.filter(r => r.success).length;

        res.json({
            success: true,
            driversNotified: successCount,
            totalDrivers: driversSnapshot.size,
            results
        });
    } catch (error) {
        console.error('Error in /api/notifications/notify-drivers:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/notifications/ride-accepted
 * Notify customer that their ride was accepted
 * 
 * Body: {
 *   customerId: string,
 *   rideId: string,
 *   driverName: string
 * }
 */
app.post('/api/notifications/ride-accepted', async (req, res) => {
    try {
        const { customerId, rideId, driverName } = req.body;

        if (!customerId || !rideId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: customerId, rideId'
            });
        }

        const customerDoc = await db.collection('users').doc(customerId).get();

        if (!customerDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
        }

        const customer = customerDoc.data();
        const pushToken = customer.fcmToken;

        if (!pushToken) {
            return res.json({ success: false, skipped: true, reason: 'no_push_token' });
        }

        const result = await sendFCMNotification(
            pushToken,
            'Ride Accepted! 🚗',
            `${driverName || 'A driver'} is on the way to pick you up!`,
            {
                type: 'ride_accepted',
                rideId: String(rideId),
            }
        );
        if (result.permanent) {
            await db.collection('users').doc(customerId).update({ fcmToken: null });
            console.log(`🧹 Cleared stale FCM token for customer ${customerId}`);
        }

        res.json(result);
    } catch (error) {
        console.error('Error in /api/notifications/ride-accepted:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/notifications/ride-completed
 * Notify customer that their ride was completed
 * 
 * Body: {
 *   customerId: string,
 *   rideId: string
 * }
 */
app.post('/api/notifications/ride-completed', async (req, res) => {
    try {
        const { customerId, rideId } = req.body;

        if (!customerId || !rideId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: customerId, rideId'
            });
        }

        const customerDoc = await db.collection('users').doc(customerId).get();

        if (!customerDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
        }

        const customer = customerDoc.data();
        const pushToken = customer.fcmToken;

        if (!pushToken) {
            return res.json({ success: false, skipped: true, reason: 'no_push_token' });
        }

        const result = await sendFCMNotification(
            pushToken,
            'Ride Completed! ✅',
            'Your ride has been completed. How was your experience?',
            {
                type: 'ride_completed',
                rideId: String(rideId),
            }
        );
        if (result.permanent) {
            await db.collection('users').doc(customerId).update({ fcmToken: null });
            console.log(`🧹 Cleared stale FCM token for customer ${customerId}`);
        }

        res.json(result);
    } catch (error) {
        console.error('Error in /api/notifications/ride-completed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/notifications/notify-driver-arrived
 * Notify customer that driver has arrived at pickup location
 * 
 * Body: {
 *   customerId: string,
 *   driverName: string
 * }
 */
app.post('/api/notifications/notify-driver-arrived', async (req, res) => {
    try {
        const { customerId, driverName } = req.body;
        console.log('📍 Driver arrival notification request:', { customerId, driverName });

        if (!customerId || !driverName) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: customerId, driverName'
            });
        }

        const customerDoc = await db.collection('users').doc(customerId).get();

        if (!customerDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
        }

        const customer = customerDoc.data();
        const pushToken = customer.fcmToken;

        if (!pushToken) {
            return res.json({ success: false, skipped: true, reason: 'no_push_token' });
        }

        const result = await sendFCMNotification(
            pushToken,
            'Driver Arrived! 🚗',
            `${driverName} has arrived at your pickup location`,
            {
                type: 'driver_arrived',
                driverName: String(driverName),
            }
        );
        if (result.permanent) {
            await db.collection('users').doc(customerId).update({ fcmToken: null });
            console.log(`🧹 Cleared stale FCM token for customer ${customerId}`);
        }

        console.log('✅ Driver arrival notification sent');
        res.json(result);
    } catch (error) {
        console.error('❌ Error in /api/notifications/notify-driver-arrived:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Submit a driver rating (customer → driver)
app.post('/api/rides/rate', async (req, res) => {
    const decoded = await verifyFirebaseToken(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const { rideId, driverId, rating, feedback } = req.body;

    if (!rideId || !driverId) {
        return res.status(400).json({ error: 'rideId and driverId are required' });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'rating must be an integer 1–5' });
    }

    try {
        const rideRef = db.collection('rides').doc(rideId);
        const driverRef = db.collection('drivers').doc(driverId);
        const now = new Date();

        // A transaction (not a plain read + batch) so the "already rated"
        // check and the write happen atomically — otherwise two near-
        // simultaneous requests (double tap, client retry) can both pass the
        // check and both commit, double-counting toward the driver's rating.
        await db.runTransaction(async (txn) => {
            const rideSnap = await txn.get(rideRef);
            if (!rideSnap.exists) {
                throw Object.assign(new Error('Ride not found'), { httpStatus: 404 });
            }

            const ride = rideSnap.data();
            if (ride.customerId !== decoded.uid) {
                throw Object.assign(new Error('Forbidden — not your ride'), { httpStatus: 403 });
            }
            if (ride.customerRating) {
                throw Object.assign(new Error('Already rated'), { httpStatus: 409 });
            }

            const driverSnap = await txn.get(driverRef);
            const existingRatings = driverSnap.exists ? (driverSnap.data().ratings || []) : [];
            const updatedRatings = [...existingRatings, {
                rideId,
                rating,
                feedback: (feedback || '').trim(),
                createdAt: now,
            }];

            // Cap stored history so a long-tenured driver's document can't
            // approach Firestore's 1MB limit — keep the most recent entries.
            const RATINGS_CAP = 500;
            const cappedRatings = updatedRatings.length > RATINGS_CAP
                ? updatedRatings.slice(updatedRatings.length - RATINGS_CAP)
                : updatedRatings;

            txn.update(driverRef, { ratings: cappedRatings });
            txn.set(rideRef, {
                customerRating: rating,
                customerFeedback: (feedback || '').trim(),
                ratedAt: now,
            }, { merge: true });
        });

        res.json({ success: true });
    } catch (error) {
        if (error.httpStatus) {
            return res.status(error.httpStatus).json({ error: error.message });
        }
        console.error('❌ Error submitting rating:', error);
        res.status(500).json({ error: 'Failed to submit rating. Please try again.' });
    }
});

// Verify Firebase ID token — returns decoded token or null
async function verifyFirebaseToken(req) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return null;
    try {
        return await admin.auth().verifyIdToken(auth.slice(7));
    } catch {
        return null;
    }
}

// Process a refund via Flutterwave
app.post('/api/payments/refund', async (req, res) => {
    const decoded = await verifyFirebaseToken(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const { transactionId, amount, comments } = req.body;

    if (!transactionId) {
        return res.status(400).json({ error: 'transactionId is required' });
    }

    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) {
        return res.status(500).json({ error: 'Payment service not configured' });
    }

    try {
        const payload = { comments: comments || 'Ride cancelled by customer' };
        if (amount) payload.amount = amount;

        const response = await fetch(
            `https://api.flutterwave.com/v3/transactions/${transactionId}/refund`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${secretKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            }
        );

        const result = await response.json();

        if (result.status === 'success') {
            res.json({
                success: true,
                refundId: result.data.id,
                status: result.data.status,
                message: result.message,
                data: result.data,
            });
        } else {
            res.status(400).json({ success: false, error: result.message || 'Refund failed' });
        }
    } catch (error) {
        console.error('❌ Flutterwave refund error:', error);
        res.status(500).json({ success: false, error: 'Payment service unavailable. Please try again.' });
    }
});

// Check refund status
app.get('/api/payments/refund/:refundId', async (req, res) => {
    const decoded = await verifyFirebaseToken(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const { refundId } = req.params;
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;

    if (!secretKey) {
        return res.status(500).json({ error: 'Payment service not configured' });
    }

    try {
        const response = await fetch(`https://api.flutterwave.com/v3/refunds/${refundId}`, {
            headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
            },
        });

        const result = await response.json();

        if (result.status === 'success') {
            res.json({ success: true, status: result.data.status, data: result.data });
        } else {
            res.status(400).json({ success: false, error: result.message });
        }
    } catch (error) {
        console.error('❌ Flutterwave refund status error:', error);
        res.status(500).json({ success: false, error: 'Payment service unavailable.' });
    }
});

// Create Flutterwave subaccount for driver payouts
app.post('/api/payments/create-subaccount', async (req, res) => {
    const decoded = await verifyFirebaseToken(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const { bankCode, accountNumber, accountName, businessName, phone } = req.body;

    if (!bankCode || !accountNumber || !accountName) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) {
        return res.status(500).json({ error: 'Payment service not configured' });
    }

    try {
        // Resolve the account number against the bank before creating a payout
        // subaccount for it — catches a mistyped account number up front instead
        // of silently routing future ride earnings to the wrong account.
        const resolveResponse = await fetch('https://api.flutterwave.com/v3/accounts/resolve', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                account_number: accountNumber,
                account_bank: bankCode,
            }),
        });
        const resolveResult = await resolveResponse.json();

        if (resolveResult.status !== 'success' || !resolveResult.data?.account_name) {
            return res.status(400).json({
                error: 'Could not verify this account number with the selected bank. Please double-check the details.',
            });
        }

        const verifiedAccountName = resolveResult.data.account_name;

        // A driver editing existing bank details should update that same
        // Flutterwave subaccount in place rather than spawning a new one on
        // every edit. Flutterwave's update endpoint can change account_number
        // but not account_bank, so a genuine bank change still needs a fresh
        // subaccount — only reuse the existing one when the bank is unchanged.
        const driverSnap = await db.collection('drivers').doc(decoded.uid).get();
        const existing = driverSnap.exists ? driverSnap.data() : null;
        const isUpdate = !!(existing?.subaccountId && existing?.bankCode === bankCode);

        const response = isUpdate
            ? await fetch(`https://api.flutterwave.com/v3/subaccounts/${existing.subaccountId}`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${secretKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    account_number: accountNumber,
                    business_name: businessName || verifiedAccountName,
                    split_type: 'flat',
                    split_value: 50,
                }),
            })
            : await fetch('https://api.flutterwave.com/v3/subaccounts', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${secretKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    account_bank: bankCode,
                    account_number: accountNumber,
                    business_name: businessName || verifiedAccountName,
                    business_email: `${phone}@rideapp.com`,
                    business_mobile: phone,
                    country: 'NG',
                    split_type: 'flat',
                    split_value: 50,
                }),
            });

        const result = await response.json();

        if (result.status === 'success') {
            // The update endpoint's response doesn't echo subaccount_id back —
            // fall back to the one already on file in that case.
            const subaccountId = result.data?.subaccount_id || (isUpdate ? existing.subaccountId : undefined);
            res.json({ success: true, data: { ...result.data, subaccount_id: subaccountId, verified_account_name: verifiedAccountName } });
        } else {
            res.status(400).json({ error: result.message || (isUpdate ? 'Subaccount update failed' : 'Subaccount creation failed') });
        }
    } catch (error) {
        console.error('❌ Flutterwave subaccount error:', error);
        res.status(500).json({ error: 'Payment service unavailable. Please try again.' });
    }
});

// Accepts 08XXXXXXXXX, +234XXXXXXXXXX, 234XXXXXXXXXX — mirrors
// hooks/Firebase.js's normalizeNigerianPhone on the mobile side. Shared by
// every phone-keyed pre-auth endpoint (driver-email lookup, check-phone,
// admin driver creation) so they can't drift out of sync with each other.
function normalizeNigerianPhone(phone) {
    const digits = String(phone).replace(/\D/g, '');
    if (digits.startsWith('234') && digits.length === 13) return '0' + digits.slice(3);
    if (/^0[789]\d{9}$/.test(digits)) return digits;
    return null;
}

// In-memory rate limiter for /api/auth/driver-email
// Tracks { attempts, resetAt } per normalized phone number.
// Simple Map is sufficient for a single-instance Render deployment.
const driverEmailRateLimit = new Map();
const DRIVER_EMAIL_MAX_ATTEMPTS = 5;
const DRIVER_EMAIL_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkDriverEmailRateLimit(phone) {
    const now = Date.now();
    const entry = driverEmailRateLimit.get(phone);

    if (entry && now < entry.resetAt) {
        if (entry.attempts >= DRIVER_EMAIL_MAX_ATTEMPTS) {
            const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
            return { blocked: true, retryAfterSec };
        }
        entry.attempts++;
        return { blocked: false };
    }

    // New window
    driverEmailRateLimit.set(phone, { attempts: 1, resetAt: now + DRIVER_EMAIL_WINDOW_MS });
    return { blocked: false };
}

// Sweep stale entries every 30 minutes so the Map doesn't grow forever
setInterval(() => {
    const now = Date.now();
    for (const [key, val] of driverEmailRateLimit) {
        if (now >= val.resetAt) driverEmailRateLimit.delete(key);
    }
}, 30 * 60 * 1000);

/**
 * POST /api/auth/driver-email
 * Look up a driver's email by phone number.
 * Used by the driver login screen before Firebase Auth is called.
 * Runs with Admin SDK so the Firestore drivers collection can be locked to
 * owner-only reads on the client side.
 *
 * Body: { phone: string }
 * Response: { email: string }
 */
app.post('/api/auth/driver-email', async (req, res) => {
    const { phone } = req.body;
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
        return res.status(400).json({ error: 'phone is required' });
    }

    const normalized = normalizeNigerianPhone(phone);

    if (!normalized) {
        return res.status(400).json({ error: 'Invalid Nigerian phone number format' });
    }

    const rateCheck = checkDriverEmailRateLimit(normalized);
    if (rateCheck.blocked) {
        console.warn(`🚫 Rate limit hit for driver-email lookup: ${normalized}`);
        return res.status(429).json({
            error: 'Too many attempts. Please wait before trying again.',
            retryAfterSeconds: rateCheck.retryAfterSec,
        });
    }

    try {
        const snapshot = await db.collection('drivers')
            .where('phone', '==', normalized)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return res.status(404).json({ error: 'No driver found with this phone number' });
        }

        const driver = snapshot.docs[0].data();
        if (!driver.email) {
            console.error('⚠️ Driver document has no email field:', snapshot.docs[0].id);
            return res.status(500).json({ error: 'Driver account is incomplete' });
        }

        return res.json({ email: driver.email });
    } catch (error) {
        console.error('❌ Driver email lookup error:', error);
        return res.status(500).json({ error: 'Lookup failed. Please try again.' });
    }
});

/**
 * POST /api/auth/check-phone
 * Checks whether a phone number is already registered (as a customer or
 * driver) before the client creates a Firebase Auth account for it.
 * Runs with Admin SDK so this can be checked pre-signup, before the caller
 * has any Firebase session the client-side Firestore rules could key off.
 *
 * Body: { phone: string }
 * Response: { available: boolean }
 */
app.post('/api/auth/check-phone', async (req, res) => {
    const { phone } = req.body;
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
        return res.status(400).json({ error: 'phone is required' });
    }

    const normalized = normalizeNigerianPhone(phone);

    if (!normalized) {
        return res.status(400).json({ error: 'Invalid Nigerian phone number format' });
    }

    // Shares the driver-email lookup's rate limit bucket — both are
    // phone-keyed pre-auth lookups exposed to the same abuse pattern.
    const rateCheck = checkDriverEmailRateLimit(normalized);
    if (rateCheck.blocked) {
        console.warn(`🚫 Rate limit hit for check-phone: ${normalized}`);
        return res.status(429).json({
            error: 'Too many attempts. Please wait before trying again.',
            retryAfterSeconds: rateCheck.retryAfterSec,
        });
    }

    try {
        const [usersSnap, driversSnap] = await Promise.all([
            db.collection('users').where('phone', '==', normalized).limit(1).get(),
            db.collection('drivers').where('phone', '==', normalized).limit(1).get(),
        ]);

        return res.json({ available: usersSnap.empty && driversSnap.empty });
    } catch (error) {
        console.error('❌ Phone availability check error:', error);
        return res.status(500).json({ error: 'Check failed. Please try again.' });
    }
});

// ── Wallet ────────────────────────────────────────────────────────────────────

/**
 * POST /api/wallet/create-topup-account
 * Creates a one-time Flutterwave virtual account for a specific top-up amount.
 * No BVN/NIN required (non-permanent accounts are exempt from that requirement).
 * The tx_ref encodes the userId so the webhook can credit the right wallet.
 *
 * Body: { userId, email, name, amount }
 */
app.post('/api/wallet/create-topup-account', async (req, res) => {
    const { userId, email, name, amount } = req.body;

    if (!userId || !email || !amount) {
        return res.status(400).json({ error: 'userId, email, and amount are required' });
    }

    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
        return res.status(400).json({ error: 'amount must be a positive number' });
    }

    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) {
        return res.status(500).json({ error: 'Payment service not configured' });
    }

    try {
        // Unique ref per top-up so each transaction can be independently tracked
        const txRef = `krides_topup_${userId}_${Date.now()}`;

        const nameParts = (name || 'KRides User').trim().split(/\s+/);
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'User';

        console.log(`🏦 Creating top-up account for user ${userId} (${email}) amount=₦${parsedAmount}`);

        const response = await fetch('https://api.flutterwave.com/v3/virtual-account-numbers', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                is_permanent: false,
                amount: parsedAmount,
                tx_ref: txRef,
                firstname: firstName,
                lastname: lastName,
                narration: `KRides Wallet Top-up - ₦${parsedAmount}`,
            }),
        });

        const result = await response.json();

        if (result.status !== 'success') {
            console.error('❌ Flutterwave VA creation failed:', result.message);
            return res.status(400).json({
                success: false,
                error: result.message || 'Could not create top-up account',
            });
        }

        const { account_number, bank_name, expiry_date } = result.data;

        console.log(`✅ Top-up account created for ${userId}: ${account_number} (${bank_name})`);

        return res.json({
            success: true,
            accountNumber: account_number,
            bankName: bank_name,
            accountName: `${firstName} ${lastName}`.trim(),
            amount: parsedAmount,
            expiryDate: expiry_date || null,
            txRef,
        });

    } catch (error) {
        console.error('❌ Top-up account creation error:', error);
        return res.status(500).json({
            success: false,
            error: 'Could not create top-up account. Please try again.',
        });
    }
});

/**
 * POST /api/wallet/webhook
 * Receives Flutterwave transfer notifications. No API-key auth — Flutterwave
 * signs every request with a secret hash instead.
 *
 * Security model:
 *  1. Verify verif-hash header matches FLUTTERWAVE_WEBHOOK_SECRET
 *  2. Only process status==="successful" charge.completed events
 *  3. Use flwTxId as the walletTransaction doc ID — idempotent by design
 *     (a second delivery of the same webhook finds the doc already exists and exits)
 */
app.post('/api/wallet/webhook', async (req, res) => {
    // Always respond 200 quickly so Flutterwave stops retrying
    res.sendStatus(200);

    const webhookSecret = process.env.FLUTTERWAVE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error('❌ FLUTTERWAVE_WEBHOOK_SECRET is not set — rejecting webhook');
        return;
    }

    const signature = req.headers['verif-hash'];
    if (!signature || signature !== webhookSecret) {
        console.warn('🚫 Webhook rejected: invalid verif-hash');
        return;
    }

    const { event, data } = req.body || {};

    if (event !== 'charge.completed' || data?.status !== 'successful') {
        console.log(`ℹ️ Ignoring webhook: event=${event} status=${data?.status}`);
        return;
    }

    if (data.currency !== 'NGN') {
        console.log(`ℹ️ Ignoring non-NGN webhook: ${data.currency}`);
        return;
    }

    const txRef = data.tx_ref || '';
    const flwTxId = String(data.id);
    const amount = Number(data.amount);

    if (!amount || amount <= 0 || isNaN(amount)) {
        console.error(`❌ Webhook has invalid amount: ${data.amount}`);
        return;
    }

    // tx_ref format: krides_topup_{userId}_{timestamp}
    if (!txRef.startsWith('krides_topup_')) {
        console.log(`ℹ️ Ignoring unrelated tx_ref: ${txRef}`);
        return;
    }

    // Strip prefix and suffix timestamp: krides_topup_{userId}_{ts}
    const withoutPrefix = txRef.replace('krides_topup_', '');
    const lastUnder = withoutPrefix.lastIndexOf('_');
    const userId = lastUnder > 0 ? withoutPrefix.slice(0, lastUnder) : withoutPrefix;
    if (!userId) {
        console.error('❌ Could not parse userId from tx_ref:', txRef);
        return;
    }

    console.log(`💰 Wallet top-up: userId=${userId} amount=₦${amount} flwTxId=${flwTxId}`);

    try {
        const userRef = db.collection('users').doc(userId);
        // Use flwTxId as doc ID — attempting to create it inside a transaction
        // is the idempotency lock: if it already exists the transaction aborts.
        const txnRef = userRef.collection('walletTransactions').doc(flwTxId);

        await db.runTransaction(async (txn) => {
            const txnSnap = await txn.get(txnRef);
            if (txnSnap.exists) {
                console.log(`ℹ️ Webhook already processed: flwTxId=${flwTxId}`);
                return; // idempotent — do nothing
            }

            const userSnap = await txn.get(userRef);
            if (!userSnap.exists) {
                throw new Error(`User not found: ${userId}`);
            }

            // Credit balance
            txn.update(userRef, {
                walletBalance: admin.firestore.FieldValue.increment(amount),
            });

            // Record the transaction
            txn.set(txnRef, {
                userId,
                type: 'topup',
                amount,
                rideId: null,
                flwTxRef: txRef,
                flwTxId,
                status: 'completed',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });

        console.log(`✅ Wallet credited: userId=${userId} +₦${amount}`);

        // Non-critical: notify the student their balance updated
        try {
            const userSnap = await userRef.get();
            const fcmToken = userSnap.data()?.fcmToken;
            if (fcmToken) {
                await sendFCMNotification(
                    fcmToken,
                    'Wallet Top-up Successful',
                    `₦${amount.toLocaleString('en-NG')} has been added to your KRides wallet.`,
                    { type: 'wallet_topup', amount: String(amount) }
                );
            }
        } catch (notifErr) {
            console.warn('⚠️ Could not send top-up notification:', notifErr.message);
        }

    } catch (error) {
        console.error('❌ Webhook processing error:', error.message);
    }
});

/**
 * POST /api/wallet/pay-ride
 * Atomically deducts the fare from the student's wallet and creates the ride
 * document in a single Firestore transaction. The Firebase ID token in the
 * request body is verified server-side — the server never trusts the client's
 * self-reported userId.
 *
 * Body: { idToken, rideData: { customerName, customerPhone, pickupLocation,
 *          pickupCoords, destination, destinationCoords, numberOfPassengers, amount } }
 */
app.post('/api/wallet/pay-ride', async (req, res) => {
    const { idToken, rideData } = req.body;

    if (!idToken || !rideData) {
        return res.status(400).json({ error: 'idToken and rideData are required' });
    }

    let userId;
    try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        userId = decoded.uid;
    } catch (err) {
        console.warn('🚫 pay-ride: invalid ID token:', err.message);
        return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
    }

    const amount = Number(rideData.amount);
    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid fare amount' });
    }

    try {
        const userRef = db.collection('users').doc(userId);
        const rideRef = db.collection('rides').doc();

        await db.runTransaction(async (txn) => {
            const userSnap = await txn.get(userRef);
            if (!userSnap.exists) throw new Error('USER_NOT_FOUND');

            const balance = userSnap.data().walletBalance || 0;
            if (balance < amount) throw new Error(`INSUFFICIENT_BALANCE:${balance}`);

            // Create ride
            txn.set(rideRef, {
                customerId: userId,
                customerName: (rideData.customerName || 'Customer').trim(),
                customerPhone: (rideData.customerPhone || '').trim(),
                pickupLocation: (rideData.pickupLocation || '').trim(),
                pickupCoords: rideData.pickupCoords || null,
                destination: (rideData.destination || '').trim(),
                destinationCoords: rideData.destinationCoords || null,
                numberOfPassengers: rideData.numberOfPassengers || 1,
                amount,
                paymentMethod: 'wallet',
                transactionId: null,
                status: 'pending',
                driverId: null,
                driverName: null,
                driverPhone: null,
                vehicleId: null,
                declined_by: [],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Deduct wallet balance
            txn.update(userRef, {
                walletBalance: admin.firestore.FieldValue.increment(-amount),
            });

            // Record wallet transaction
            const walletTxnRef = userRef.collection('walletTransactions').doc();
            txn.set(walletTxnRef, {
                userId,
                type: 'ride_payment',
                amount: -amount,
                rideId: rideRef.id,
                flwTxRef: null,
                flwTxId: null,
                status: 'completed',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });

        console.log(`✅ Wallet ride booked: userId=${userId} rideId=${rideRef.id} amount=₦${amount}`);
        return res.json({ success: true, rideId: rideRef.id });

    } catch (error) {
        if (error.message === 'USER_NOT_FOUND') {
            return res.status(404).json({ error: 'Account not found' });
        }
        if (error.message?.startsWith('INSUFFICIENT_BALANCE')) {
            const balance = Number(error.message.split(':')[1] || 0);
            return res.status(400).json({
                error: 'insufficient_balance',
                balance,
                shortfall: amount - balance,
            });
        }
        console.error('❌ Wallet pay-ride error:', error);
        return res.status(500).json({ error: 'Could not process payment. Please try again.' });
    }
});


/**
 * POST /api/payments/complete-ride
 * Marks a ride as completed and transfers the driver's earnings to their bank account.
 * Platform keeps ₦50 (1–2 passengers) or ₦100 (3+ passengers) per ride.
 *
 * Body: { idToken, rideId }
 */
app.post('/api/payments/complete-ride', async (req, res) => {
    const { idToken, rideId } = req.body;

    if (!idToken || !rideId) {
        return res.status(400).json({ error: 'idToken and rideId are required' });
    }

    // Verify driver identity
    let driverId;
    try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        driverId = decoded.uid;
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
    }

    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) {
        return res.status(500).json({ error: 'Payment service not configured' });
    }

    try {
        const rideRef = db.collection('rides').doc(rideId);
        const rideSnap = await rideRef.get();

        if (!rideSnap.exists) {
            return res.status(404).json({ error: 'Ride not found' });
        }

        const ride = rideSnap.data();

        if (ride.driverId !== driverId) {
            return res.status(403).json({ error: 'You are not the driver for this ride' });
        }

        if (ride.status === 'completed') {
            return res.json({ success: true, alreadyCompleted: true });
        }

        if (!['accepted', 'in_progress'].includes(ride.status)) {
            return res.status(400).json({ error: `Cannot complete a ride with status: ${ride.status}` });
        }

        // Mark ride completed
        await rideRef.update({
            status: 'completed',
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`✅ Ride ${rideId} marked as completed by driver ${driverId}`);

        // Calculate driver earnings (platform takes ₦50 for <3 passengers, ₦100 for 3+)
        const totalAmount = Number(ride.amount) || 0;
        const passengers = Number(ride.numberOfPassengers) || 1;
        const platformFee = passengers >= 3 ? 150 : 100;
        const driverEarnings = Math.max(totalAmount - platformFee, 0);

        // Only transfer if ride was paid digitally and driver has bank details
        if (totalAmount <= 0) {
            return res.json({ success: true, payout: null, reason: 'no_amount' });
        }

        const driverSnap = await db.collection('drivers').doc(driverId).get();
        const driver = driverSnap.exists ? driverSnap.data() : null;

        if (!driver?.bankCode || !driver?.accountNumber) {
            console.warn(`⚠️ Driver ${driverId} has no bank details — skipping payout`);
            // Still record what's owed — without this, a ride completed before
            // the driver added bank details had no payoutStatus at all, so the
            // amount was invisible to every tracking mechanism (admin queue,
            // retry sweep) forever, even after the driver later added details.
            // Its own status (not 'failed'/'pending_manual') keeps the
            // automatic retry sweep from calling Flutterwave with bank fields
            // it knows are missing.
            await rideRef.update({
                payoutStatus: 'awaiting_bank_details',
                payoutAmount: driverEarnings,
            });
            return res.json({ success: true, payout: null, reason: 'no_bank_details' });
        }

        // Flutterwave's live Transfers API currently rejects every call with
        // an IP-whitelisting error (Render's plan has no static outbound IP
        // yet). Rather than let every ride burn a doomed API call and sit in
        // the automatic retry sweep, PAYOUT_MODE=manual (the default until
        // that's fixed) skips straight to a manual queue — see
        // scripts/list-pending-payouts.js and scripts/mark-payout-paid.js.
        // Flip back with PAYOUT_MODE=automatic once IP whitelisting works.
        if (PAYOUT_MODE === 'manual') {
            console.log(`📝 Manual payout mode: ₦${driverEarnings} owed to driver ${driverId} for ride ${rideId}`);
            await rideRef.update({
                payoutStatus: 'pending_manual',
                payoutAmount: driverEarnings,
            });
            return res.json({
                success: true,
                payout: null,
                reason: 'manual_payout_pending',
            });
        }

        // Initiate Flutterwave transfer
        const reference = `krides_payout_${rideId}`;
        console.log(`💸 Transferring ₦${driverEarnings} to driver ${driverId} (${driver.accountNumber})`);

        try {
            await transferToDriver(driver, driverEarnings, reference, `KRides ride payment - ${rideId.slice(0, 8)}`);
            console.log(`✅ Payout initiated for driver ${driverId}: ₦${driverEarnings}`);

            // Record the payout on the ride document
            await rideRef.update({
                payoutStatus: 'initiated',
                payoutAmount: driverEarnings,
                payoutReference: reference,
            });

            return res.json({
                success: true,
                payout: { amount: driverEarnings, reference },
            });
        } catch (transferError) {
            console.error(`❌ Payout failed for driver ${driverId}:`, transferError.message);
            await rideRef.update({ payoutStatus: 'failed', payoutAmount: driverEarnings, payoutError: transferError.message });
            // Ride is still completed — payout failure is non-blocking
            return res.json({
                success: true,
                payout: null,
                reason: 'transfer_failed',
                error: transferError.message,
            });
        }

    } catch (error) {
        console.error('❌ complete-ride error:', error);
        return res.status(500).json({ error: 'Could not complete ride. Please try again.' });
    }
});

/**
 * Executes a Flutterwave transfer to a driver's bank account. Throws with
 * Flutterwave's own message on any non-success status so callers can treat
 * "transfer rejected" and "network/parse error" the same way.
 */
async function transferToDriver(driver, amount, reference, narration) {
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    const transferResponse = await fetch('https://api.flutterwave.com/v3/transfers', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            account_bank: driver.bankCode,
            account_number: driver.accountNumber,
            amount,
            narration,
            currency: 'NGN',
            reference,
        }),
    });

    const result = await transferResponse.json();
    if (result.status !== 'success' && result.status !== 'NEW') {
        throw new Error(result.message || 'Transfer failed');
    }
    return result;
}

/**
 * POST /api/payments/wallet-refund
 * Credits a cancelled wallet-paid ride back to the customer's wallet.
 * Body: { idToken, rideId }
 */
app.post('/api/payments/wallet-refund', async (req, res) => {
    const { idToken, rideId } = req.body;

    if (!idToken || !rideId) {
        return res.status(400).json({ error: 'idToken and rideId are required' });
    }

    let customerId;
    try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        customerId = decoded.uid;
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
    }

    try {
        const rideRef = db.collection('rides').doc(rideId);
        const rideSnap = await rideRef.get();

        if (!rideSnap.exists) {
            return res.status(404).json({ error: 'Ride not found' });
        }

        const ride = rideSnap.data();

        if (ride.customerId !== customerId) {
            return res.status(403).json({ error: 'This ride does not belong to you' });
        }

        if (ride.paymentMethod !== 'wallet') {
            return res.status(400).json({ error: 'This ride was not paid via wallet' });
        }

        // Eligible if cancellation is in progress (refundProcessing=true) or ride is already cancelled
        if (ride.refundProcessing !== true && ride.status !== 'cancelled') {
            return res.status(400).json({ error: `Cannot refund ride with status: ${ride.status}` });
        }

        // Idempotency — return success immediately if already refunded
        if (ride.walletRefunded === true) {
            return res.json({ success: true, alreadyRefunded: true });
        }

        const amount = Number(ride.amount) || 0;
        if (amount <= 0) {
            return res.json({ success: true, refunded: false, reason: 'no_amount' });
        }

        const userRef = db.collection('users').doc(customerId);
        let alreadyRefunded = false;
        let refundedAmount = amount;

        await db.runTransaction(async (txn) => {
            // Re-read the ride *inside* the transaction so Firestore serializes
            // concurrent refund attempts against it, instead of both racing past
            // the walletRefunded check made outside the transaction above.
            const rideTxnSnap = await txn.get(rideRef);
            if (!rideTxnSnap.exists) throw new Error('Ride not found');

            if (rideTxnSnap.data().walletRefunded === true) {
                alreadyRefunded = true;
                return;
            }

            refundedAmount = Number(rideTxnSnap.data().amount) || 0;

            const userSnap = await txn.get(userRef);
            if (!userSnap.exists) throw new Error('Customer not found');

            const currentBalance = Number(userSnap.data().walletBalance) || 0;
            txn.update(userRef, { walletBalance: currentBalance + refundedAmount });

            const txRef = db.collection('walletTransactions').doc();
            txn.set(txRef, {
                userId: customerId,
                type: 'refund',
                amount: refundedAmount,
                description: 'Ride cancellation refund',
                rideId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Idempotency guard — prevent a second refund if this endpoint is called twice
            txn.update(rideRef, { walletRefunded: true });
        });

        if (alreadyRefunded) {
            return res.json({ success: true, alreadyRefunded: true });
        }

        console.log(`✅ Wallet refund of ₦${refundedAmount} credited to customer ${customerId} (ride ${rideId})`);
        return res.json({ success: true, refundedAmount });

    } catch (error) {
        console.error('❌ wallet-refund error:', error);
        return res.status(500).json({ error: 'Could not process wallet refund. Please try again.' });
    }
});

/**
 * POST /api/reports/driver
 * Customer reports a driver. Saves to Firestore and emails admin.
 * Body: { idToken, rideId, reason, description }
 */
app.post('/api/reports/driver', async (req, res) => {
    const { idToken, rideId, reason, description } = req.body;

    if (!idToken || !rideId || !reason) {
        return res.status(400).json({ error: 'idToken, rideId, and reason are required' });
    }

    let customerId;
    try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        customerId = decoded.uid;
    } catch {
        return res.status(401).json({ error: 'Invalid or expired session' });
    }

    try {
        // Read ride
        const rideSnap = await db.collection('rides').doc(rideId).get();
        if (!rideSnap.exists) return res.status(404).json({ error: 'Ride not found' });
        const ride = rideSnap.data();

        if (ride.customerId !== customerId) {
            return res.status(403).json({ error: 'This ride does not belong to you' });
        }
        if (!ride.driverId) {
            return res.status(400).json({ error: 'No driver on this ride' });
        }

        // Idempotency — one report per customer per ride
        const existing = await db.collection('driverReports')
            .where('customerId', '==', customerId)
            .where('rideId', '==', rideId)
            .limit(1)
            .get();
        if (!existing.empty) {
            return res.json({ success: true, alreadyReported: true });
        }

        // Read driver and customer info for the email
        const [driverSnap, customerSnap] = await Promise.all([
            db.collection('drivers').doc(ride.driverId).get(),
            db.collection('users').doc(customerId).get(),
        ]);
        const driver = driverSnap.exists ? driverSnap.data() : {};
        const customer = customerSnap.exists ? customerSnap.data() : {};

        const reportedAt = new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' });
        const pickupStr = typeof ride.pickupLocation === 'object'
            ? ride.pickupLocation?.name || ride.pickupLocation?.address || 'Unknown'
            : ride.pickupLocation || 'Unknown';
        const destStr = typeof ride.destination === 'object'
            ? ride.destination?.name || ride.destination?.address || 'Unknown'
            : ride.destination || 'Unknown';

        // Save report to Firestore
        await db.collection('driverReports').add({
            customerId,
            customerName: customer.firstName ? `${customer.firstName} ${customer.lastName || ''}`.trim() : 'Unknown',
            customerPhone: customer.phone || ride.customerPhone || 'N/A',
            driverId: ride.driverId,
            driverName: driver.fullName || driver.name || ride.driverName || 'Unknown',
            driverPhone: driver.phone || ride.driverPhone || 'N/A',
            driverEmail: driver.email || 'N/A',
            driverVehicleId: driver.vehicle_id || 'N/A',
            rideId,
            pickupLocation: pickupStr,
            destination: destStr,
            rideAmount: ride.amount || 0,
            rideStatus: ride.status,
            reason,
            description: description || '',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const emailResult = await sendDriverReportEmail({
            driverName: driver.fullName || driver.name || ride.driverName || 'Unknown',
            driverPhone: driver.phone || ride.driverPhone || 'N/A',
            driverEmail: driver.email || 'N/A',
            driverVehicleId: driver.vehicle_id || 'N/A',
            customerName: customer.firstName ? `${customer.firstName} ${customer.lastName || ''}`.trim() : 'Unknown',
            customerPhone: customer.phone || ride.customerPhone || 'N/A',
            pickupLocation: pickupStr,
            destination: destStr,
            rideAmount: ride.amount || 0,
            rideStatus: ride.status,
            rideId,
            reason,
            description,
        }).catch((err) => {
            console.error('❌ Driver report email error:', err.message);
            return { sent: false, reason: 'send_failed' };
        });

        console.log(`📋 Report saved for ride ${rideId}${emailResult.sent ? ' — admin notified by email' : ` — email not sent (${emailResult.reason})`}`);

        return res.json({ success: true });

    } catch (error) {
        console.error('❌ driver report error:', error);
        return res.status(500).json({ error: 'Could not submit report. Please try again.' });
    }
});

/**
 * Auto-cancel pending rides nobody accepts in time.
 * Without this, a ride the customer paid for but that no driver accepted —
 * e.g. because the customer closed the app — sits at status 'pending'
 * indefinitely with the charge never resolved.
 */
const PENDING_RIDE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const PENDING_RIDE_SWEEP_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

async function refundFlutterwaveTransaction(transactionId, amount, comments) {
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) throw new Error('Payment service not configured');

    const payload = { comments: comments || 'Ride cancelled' };
    if (amount) payload.amount = amount;

    const response = await fetch(
        `https://api.flutterwave.com/v3/transactions/${transactionId}/refund`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        }
    );
    const result = await response.json();
    if (result.status !== 'success') {
        throw new Error(result.message || 'Refund failed');
    }
    return result.data;
}

async function refundWalletForRide(rideRef, customerId, amount, description) {
    await db.runTransaction(async (txn) => {
        // Re-read the ride inside the transaction (same fix as /wallet-refund)
        // so this can never double-credit a ride refunded through another path.
        const rideTxnSnap = await txn.get(rideRef);
        if (!rideTxnSnap.exists || rideTxnSnap.data().walletRefunded === true) return;

        const userRef = db.collection('users').doc(customerId);
        const userSnap = await txn.get(userRef);
        if (!userSnap.exists) throw new Error('Customer not found');

        const currentBalance = Number(userSnap.data().walletBalance) || 0;
        txn.update(userRef, { walletBalance: currentBalance + amount });

        const txRef = db.collection('walletTransactions').doc();
        txn.set(txRef, {
            userId: customerId,
            type: 'refund',
            amount,
            description,
            rideId: rideRef.id,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        txn.update(rideRef, { walletRefunded: true });
    });
}

async function sweepStalePendingRides() {
    try {
        const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - PENDING_RIDE_TIMEOUT_MS);
        const snap = await db.collection('rides')
            .where('status', '==', 'pending')
            .where('createdAt', '<', cutoff)
            .get();

        if (snap.empty) return;

        console.log(`⏱️ Auto-cancel sweep: ${snap.size} stale pending ride(s) found`);

        for (const rideDoc of snap.docs) {
            const rideRef = rideDoc.ref;
            const ride = rideDoc.data();

            // Atomically claim the ride so a driver accepting, or the customer
            // cancelling, at the same moment wins the race instead of us.
            let claimed = false;
            try {
                await db.runTransaction(async (txn) => {
                    const freshSnap = await txn.get(rideRef);
                    if (!freshSnap.exists) return;
                    const fresh = freshSnap.data();
                    if (fresh.status !== 'pending' || fresh.refundProcessing === true) return;
                    txn.update(rideRef, {
                        status: 'cancelled',
                        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
                        cancelledBy: 'system',
                        cancellationReason: 'no_driver_timeout',
                    });
                    claimed = true;
                });
            } catch (err) {
                console.error(`❌ Auto-cancel transaction failed for ride ${rideDoc.id}:`, err);
                continue;
            }

            if (!claimed) continue;

            const amount = Number(ride.amount) || 0;
            const needsRefund = amount > 0 && (ride.paymentMethod === 'wallet' || ride.paymentMethod === 'flutterwave');
            let refunded = false;
            let refundAttempted = false;

            try {
                if (amount > 0 && ride.paymentMethod === 'wallet' && ride.customerId) {
                    refundAttempted = true;
                    await refundWalletForRide(rideRef, ride.customerId, amount, 'Ride auto-cancelled — no driver found');
                    refunded = true;
                } else if (amount > 0 && ride.paymentMethod === 'flutterwave' && ride.transactionId) {
                    refundAttempted = true;
                    await refundFlutterwaveTransaction(ride.transactionId, amount, 'No driver accepted the ride in time');
                    await rideRef.update({ refundStatus: 'completed', refundedAt: admin.firestore.FieldValue.serverTimestamp() });
                    refunded = true;
                } else if (amount > 0 && ride.paymentMethod === 'flutterwave' && !ride.transactionId) {
                    // Paid by card but the transaction ID was never recorded — the
                    // same "needs manual review" flag used elsewhere for this gap.
                    await rideRef.update({
                        refundStatus: 'needs_review',
                        needsManualRefundReview: true,
                        refundReviewReason: 'Flutterwave transactionId missing at auto-cancel time',
                    });
                }
            } catch (err) {
                console.error(`❌ Auto-cancel refund failed for ride ${rideDoc.id}:`, err);
                const failureUpdate = { autoCancelRefundError: err.message };
                if (ride.paymentMethod === 'flutterwave') failureUpdate.refundStatus = 'failed';
                if (ride.paymentMethod === 'wallet') failureUpdate.walletRefundStatus = 'failed';
                await rideRef.update(failureUpdate).catch(() => {});
            }

            const refundLabel = refunded
                ? 'refunded'
                : refundAttempted
                    ? 'refund attempt failed — see ride doc'
                    : 'no refund needed';
            console.log(`✅ Auto-cancelled stale pending ride ${rideDoc.id} (${refundLabel})`);

            // Best-effort push notification — a failure here shouldn't block the sweep
            try {
                if (ride.customerId) {
                    const customerSnap = await db.collection('users').doc(ride.customerId).get();
                    const pushToken = customerSnap.exists ? customerSnap.data()?.fcmToken : null;
                    if (pushToken) {
                        const message = !needsRefund
                            ? "We couldn't find a driver in time, so your ride was cancelled."
                            : refunded
                                ? "We couldn't find a driver in time, so your ride was cancelled and refunded."
                                : "We couldn't find a driver in time, so your ride was cancelled. Contact support about your refund.";
                        const result = await sendFCMNotification(
                            pushToken,
                            'Ride Cancelled',
                            message,
                            { type: 'ride_auto_cancelled', rideId: rideDoc.id }
                        );
                        if (result.permanent) {
                            await db.collection('users').doc(ride.customerId).update({ fcmToken: null });
                            console.log(`🧹 Cleared stale FCM token for customer ${ride.customerId}`);
                        }
                    }
                }
            } catch (err) {
                console.error(`⚠️ Auto-cancel notification failed for ride ${rideDoc.id}:`, err);
            }
        }
    } catch (error) {
        console.error('❌ sweepStalePendingRides error:', error);
    }
}

setInterval(sweepStalePendingRides, PENDING_RIDE_SWEEP_INTERVAL_MS);

/**
 * Retry refunds that previously failed to confirm.
 * A ride that lands on refundStatus/walletRefundStatus 'failed' has no
 * refundId to poll (unlike a 'pending' Flutterwave refund, which
 * checkPendingRefunds on the client re-checks) — the failure happened before
 * we ever got a confirmed refund back, often from a transient issue (a
 * network blip, Flutterwave briefly returning an error page instead of
 * JSON). The safe move is to retry the refund attempt itself: Flutterwave
 * rejects refunding an already-refunded transaction rather than double
 * refunding, and refundWalletForRide's own transaction checks the
 * `walletRefunded` flag before crediting, so a retry can never double-pay a
 * refund that actually went through despite our side failing to confirm it.
 * Capped at a few attempts — after that it's flagged for manual review
 * instead of retrying forever against a persistent problem.
 */
const REFUND_RETRY_MAX_ATTEMPTS = 3;
const REFUND_RETRY_SWEEP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const REFUND_RETRY_MIN_AGE_MS = 5 * 60 * 1000; // let transient blips clear first

async function retryFlutterwaveRefund(rideDoc) {
    const rideRef = rideDoc.ref;
    const ride = rideDoc.data();
    const attempts = ride.refundRetryCount || 0;

    if (!ride.transactionId) {
        await rideRef.update({
            refundStatus: 'needs_review',
            needsManualRefundReview: true,
            refundReviewReason: 'Refund failed and no transactionId on record to retry',
        }).catch(() => {});
        return;
    }

    if (attempts >= REFUND_RETRY_MAX_ATTEMPTS) {
        if (!ride.needsManualRefundReview) {
            await rideRef.update({
                needsManualRefundReview: true,
                refundReviewReason: `Refund retry failed ${attempts} times — needs manual review`,
            }).catch(() => {});
        }
        return;
    }

    try {
        console.log(`🔁 Retrying refund for ride ${rideDoc.id} (attempt ${attempts + 1}/${REFUND_RETRY_MAX_ATTEMPTS})`);
        await refundFlutterwaveTransaction(ride.transactionId, ride.refundAmount || ride.amount, 'Retry of previously failed refund');
        await rideRef.update({
            refundStatus: 'completed',
            refundedAt: admin.firestore.FieldValue.serverTimestamp(),
            refundRetryCount: attempts + 1,
        });
        console.log(`✅ Refund retry succeeded for ride ${rideDoc.id}`);
    } catch (err) {
        console.error(`❌ Refund retry failed for ride ${rideDoc.id}:`, err.message);
        await rideRef.update({
            refundRetryCount: attempts + 1,
            autoRetryRefundError: err.message,
        }).catch(() => {});
    }
}

async function retryWalletRefund(rideDoc) {
    const rideRef = rideDoc.ref;
    const ride = rideDoc.data();
    const attempts = ride.walletRefundRetryCount || 0;

    if (attempts >= REFUND_RETRY_MAX_ATTEMPTS) {
        if (!ride.needsManualRefundReview) {
            await rideRef.update({
                needsManualRefundReview: true,
                refundReviewReason: `Wallet refund retry failed ${attempts} times — needs manual review`,
            }).catch(() => {});
        }
        return;
    }

    if (!ride.customerId || !(Number(ride.amount) > 0)) return;

    try {
        console.log(`🔁 Retrying wallet refund for ride ${rideDoc.id} (attempt ${attempts + 1}/${REFUND_RETRY_MAX_ATTEMPTS})`);
        await refundWalletForRide(rideRef, ride.customerId, Number(ride.amount), 'Retry of previously failed wallet refund');
        await rideRef.update({
            walletRefundStatus: 'completed',
            walletRefundRetryCount: attempts + 1,
        });
        console.log(`✅ Wallet refund retry succeeded for ride ${rideDoc.id}`);
    } catch (err) {
        console.error(`❌ Wallet refund retry failed for ride ${rideDoc.id}:`, err.message);
        await rideRef.update({
            walletRefundRetryCount: attempts + 1,
            autoRetryRefundError: err.message,
        }).catch(() => {});
    }
}

async function retryFailedRefunds() {
    try {
        const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - REFUND_RETRY_MIN_AGE_MS);

        const [flutterwaveSnap, walletSnap] = await Promise.all([
            db.collection('rides')
                .where('refundStatus', '==', 'failed')
                .where('cancelledAt', '<', cutoff)
                .limit(20)
                .get(),
            db.collection('rides')
                .where('walletRefundStatus', '==', 'failed')
                .where('cancelledAt', '<', cutoff)
                .limit(20)
                .get(),
        ]);

        if (flutterwaveSnap.empty && walletSnap.empty) return;

        console.log(`🔁 Refund retry sweep: ${flutterwaveSnap.size} card + ${walletSnap.size} wallet failed refund(s) found`);

        for (const rideDoc of flutterwaveSnap.docs) {
            await retryFlutterwaveRefund(rideDoc);
        }
        for (const rideDoc of walletSnap.docs) {
            await retryWalletRefund(rideDoc);
        }
    } catch (error) {
        console.error('❌ retryFailedRefunds error:', error);
    }
}

setInterval(retryFailedRefunds, REFUND_RETRY_SWEEP_INTERVAL_MS);

/**
 * Retry driver payouts that previously failed (e.g. Flutterwave rejecting
 * the transfer outright — IP whitelisting, insufficient balance, etc).
 * Safe to retry with a fresh reference each time: transferToDriver only
 * ever marks a ride 'failed' when Flutterwave's synchronous response
 * confirms the transfer was rejected, never on an ambiguous timeout, so a
 * retry can't collide with a transfer that actually went through.
 * Capped at a few attempts — after that it's flagged for manual review.
 */
const PAYOUT_RETRY_MAX_ATTEMPTS = 3;
const PAYOUT_RETRY_SWEEP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const PAYOUT_RETRY_MIN_AGE_MS = 5 * 60 * 1000; // let transient blips clear first

async function retryFailedPayout(rideDoc) {
    const rideRef = rideDoc.ref;
    const ride = rideDoc.data();
    const attempts = ride.payoutRetryCount || 0;

    if (attempts >= PAYOUT_RETRY_MAX_ATTEMPTS) {
        if (!ride.needsManualPayoutReview) {
            await rideRef.update({
                needsManualPayoutReview: true,
                payoutReviewReason: `Payout retry failed ${attempts} times — needs manual review`,
            }).catch(() => {});
        }
        return;
    }

    if (!ride.driverId || !(Number(ride.payoutAmount) > 0)) return;

    const driverSnap = await db.collection('drivers').doc(ride.driverId).get();
    const driver = driverSnap.exists ? driverSnap.data() : null;

    if (!driver?.bankCode || !driver?.accountNumber) {
        await rideRef.update({
            needsManualPayoutReview: true,
            payoutReviewReason: 'Driver has no bank details on file to retry payout',
        }).catch(() => {});
        return;
    }

    try {
        console.log(`🔁 Retrying payout for ride ${rideDoc.id} (attempt ${attempts + 1}/${PAYOUT_RETRY_MAX_ATTEMPTS})`);
        // Flutterwave references must be unique per attempt — the original
        // reference was already submitted (and rejected), so reusing it
        // would itself get rejected as a duplicate.
        const reference = `krides_payout_${rideDoc.id}_retry${attempts + 1}`;
        await transferToDriver(driver, ride.payoutAmount, reference, `KRides ride payment - ${rideDoc.id.slice(0, 8)}`);
        await rideRef.update({
            payoutStatus: 'initiated',
            payoutReference: reference,
            payoutRetryCount: attempts + 1,
            payoutError: admin.firestore.FieldValue.delete(),
        });
        console.log(`✅ Payout retry succeeded for ride ${rideDoc.id}`);
    } catch (err) {
        console.error(`❌ Payout retry failed for ride ${rideDoc.id}:`, err.message);
        await rideRef.update({
            payoutRetryCount: attempts + 1,
            payoutError: err.message,
        }).catch(() => {});
    }
}

async function retryFailedPayouts() {
    // In manual mode, retrying through the API is pointless — it's the same
    // call that's already known to fail. Ride's payoutStatus stays 'failed'
    // (or whatever it already is) until picked up by the manual queue.
    if (PAYOUT_MODE === 'manual') return;

    try {
        const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - PAYOUT_RETRY_MIN_AGE_MS);

        const snap = await db.collection('rides')
            .where('payoutStatus', '==', 'failed')
            .where('completedAt', '<', cutoff)
            .limit(20)
            .get();

        if (snap.empty) return;

        console.log(`🔁 Payout retry sweep: ${snap.size} failed payout(s) found`);

        for (const rideDoc of snap.docs) {
            await retryFailedPayout(rideDoc);
        }
    } catch (error) {
        console.error('❌ retryFailedPayouts error:', error);
    }
}

setInterval(retryFailedPayouts, PAYOUT_RETRY_SWEEP_INTERVAL_MS);

// ── Admin web app API ────────────────────────────────────────────────────
// Backs the separately-hosted admin-web app (Vercel/Netlify). Auth and CORS
// are handled by the /admin-api middleware registered near the top of this
// file — everything below just assumes a valid request got through.

app.post('/admin-api/login', (req, res) => {
    const { password } = req.body || {};
    if (password !== ADMIN_API_KEY) {
        return res.status(401).json({ error: 'Incorrect password' });
    }
    res.json({ success: true });
});

// GET /admin-api/payouts/pending
// Same data as scripts/list-pending-payouts.js, grouped by driver.
app.get('/admin-api/payouts/pending', async (req, res) => {
    try {
        const snap = await db.collection('rides')
            .where('payoutStatus', 'in', ['pending_manual', 'failed', 'awaiting_bank_details'])
            .get();

        // pickupLocation/destination are strings on older rides, {name,
        // address,...} objects on newer ones (see the same normalization
        // in components/HistoryCard.js on the mobile side).
        const placeName = (place) =>
            typeof place === 'object' && place ? (place.name || place.address || null) : (place || null);

        const byDriver = new Map();
        for (const doc of snap.docs) {
            const ride = doc.data();
            const driverId = ride.driverId;
            if (!driverId) continue;

            if (!byDriver.has(driverId)) byDriver.set(driverId, []);
            byDriver.get(driverId).push({
                rideId: doc.id,
                amount: Number(ride.payoutAmount) || 0,
                completedAt: ride.completedAt?.toDate?.()?.toISOString() || null,
                status: ride.payoutStatus,
                customerName: ride.customerName || null,
                pickupLocation: placeName(ride.pickupLocation),
                destination: placeName(ride.destination),
                numberOfPassengers: Number(ride.numberOfPassengers) || null,
                paymentMethod: ride.paymentMethod || null,
                transactionId: ride.transactionId || null,
                payoutReference: ride.payoutReference || null,
                payoutError: ride.payoutError || null,
            });
        }

        const drivers = [];
        for (const [driverId, rides] of byDriver) {
            const driverSnap = await db.collection('drivers').doc(driverId).get();
            const driver = driverSnap.exists ? driverSnap.data() : null;
            drivers.push({
                driverId,
                name: driver?.fullname || driver?.name || '(unknown name)',
                bankName: driver?.bankName || null,
                accountNumber: driver?.accountNumber || null,
                accountName: driver?.accountName || null,
                total: rides.reduce((sum, r) => sum + r.amount, 0),
                rides: rides.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')),
            });
        }
        drivers.sort((a, b) => b.total - a.total);

        res.json({ success: true, drivers });
    } catch (error) {
        console.error('❌ admin payouts/pending error:', error);
        res.status(500).json({ error: 'Could not load pending payouts' });
    }
});

// POST /admin-api/payouts/mark-paid — body: { rideIds: string[] }
app.post('/admin-api/payouts/mark-paid', async (req, res) => {
    const { rideIds } = req.body || {};
    if (!Array.isArray(rideIds) || rideIds.length === 0) {
        return res.status(400).json({ error: 'rideIds must be a non-empty array' });
    }

    const results = [];
    for (const rideId of rideIds) {
        try {
            const rideRef = db.collection('rides').doc(rideId);
            const rideSnap = await rideRef.get();
            if (!rideSnap.exists) {
                results.push({ rideId, ok: false, error: 'not found' });
                continue;
            }
            await rideRef.update({
                payoutStatus: 'paid_manually',
                payoutPaidAt: admin.firestore.FieldValue.serverTimestamp(),
                payoutError: admin.firestore.FieldValue.delete(),
            });
            results.push({ rideId, ok: true });
        } catch (error) {
            results.push({ rideId, ok: false, error: error.message });
        }
    }
    res.json({ success: true, results });
});

// GET /admin-api/refunds/review — rides flagged needsManualRefundReview
app.get('/admin-api/refunds/review', async (req, res) => {
    try {
        const snap = await db.collection('rides')
            .where('needsManualRefundReview', '==', true)
            .get();

        const rides = snap.docs.map((doc) => {
            const ride = doc.data();
            return {
                rideId: doc.id,
                customerId: ride.customerId || null,
                customerName: ride.customerName || null,
                amount: Number(ride.amount) || 0,
                refundStatus: ride.refundStatus || null,
                walletRefundStatus: ride.walletRefundStatus || null,
                refundReviewReason: ride.refundReviewReason || null,
                cancelledAt: ride.cancelledAt?.toDate?.()?.toISOString() || null,
                transactionId: ride.transactionId || null,
            };
        });

        res.json({ success: true, rides });
    } catch (error) {
        console.error('❌ admin refunds/review error:', error);
        res.status(500).json({ error: 'Could not load refund review queue' });
    }
});

// POST /admin-api/refunds/resolve — body: { rideId, note }
app.post('/admin-api/refunds/resolve', async (req, res) => {
    const { rideId, note } = req.body || {};
    if (!rideId) return res.status(400).json({ error: 'rideId is required' });

    try {
        const rideRef = db.collection('rides').doc(rideId);
        const rideSnap = await rideRef.get();
        if (!rideSnap.exists) return res.status(404).json({ error: 'Ride not found' });
        const ride = rideSnap.data();

        const updates = {
            needsManualRefundReview: false,
            refundReviewResolvedAt: admin.firestore.FieldValue.serverTimestamp(),
            refundReviewNote: note || null,
        };

        // retryFailedRefunds's sweep queries on refundStatus/walletRefundStatus
        // == 'failed', not on needsManualRefundReview — clearing only the flag
        // would leave a 'failed' status in place, and the very next sweep
        // (retryRefundCount already maxed out) immediately re-sets the flag,
        // undoing this resolve within 10 minutes. Bump the status field itself
        // to a terminal value so the sweep's query excludes it for good.
        if (['failed', 'needs_review'].includes(ride.refundStatus)) {
            updates.refundStatus = 'resolved_manually';
        }
        if (ride.walletRefundStatus === 'failed') {
            updates.walletRefundStatus = 'resolved_manually';
        }

        await rideRef.update(updates);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ admin refunds/resolve error:', error);
        res.status(500).json({ error: 'Could not resolve refund review' });
    }
});

// GET /admin-api/orphaned-charges — unresolved orphanedCharges docs
app.get('/admin-api/orphaned-charges', async (req, res) => {
    try {
        const snap = await db.collection('orphanedCharges')
            .where('status', '==', 'unresolved')
            .get();

        const charges = snap.docs.map((doc) => {
            const c = doc.data();
            return {
                chargeId: doc.id,
                customerId: c.customerId || null,
                transactionId: c.transactionId || null,
                amount: Number(c.amount) || 0,
                rideCreationError: c.rideCreationError || null,
                refundError: c.refundError || null,
                createdAt: c.createdAt?.toDate?.()?.toISOString() || null,
            };
        });

        res.json({ success: true, charges });
    } catch (error) {
        console.error('❌ admin orphaned-charges error:', error);
        res.status(500).json({ error: 'Could not load orphaned charges' });
    }
});

// POST /admin-api/orphaned-charges/resolve — body: { chargeId, note }
app.post('/admin-api/orphaned-charges/resolve', async (req, res) => {
    const { chargeId, note } = req.body || {};
    if (!chargeId) return res.status(400).json({ error: 'chargeId is required' });

    try {
        await db.collection('orphanedCharges').doc(chargeId).update({
            status: 'resolved',
            resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
            resolutionNote: note || null,
        });
        res.json({ success: true });
    } catch (error) {
        console.error('❌ admin orphaned-charges/resolve error:', error);
        res.status(500).json({ error: 'Could not resolve orphaned charge' });
    }
});

// GET /admin-api/reports — driver complaints from POST /api/reports/driver
// (see driverReports collection there for the exact schema being read here).
// Reports predating the resolved/open workflow have no `status` field at
// all, which reads as 'open' — same fail-safe-to-visible approach as the
// other review queues.
app.get('/admin-api/reports', async (req, res) => {
    try {
        const snap = await db.collection('driverReports')
            .orderBy('createdAt', 'desc')
            .limit(200)
            .get();

        const reports = snap.docs.map((doc) => {
            const r = doc.data();
            return {
                reportId: doc.id,
                status: r.status === 'resolved' ? 'resolved' : 'open',
                customerName: r.customerName || null,
                customerPhone: r.customerPhone || null,
                driverId: r.driverId || null,
                driverName: r.driverName || null,
                driverPhone: r.driverPhone || null,
                driverEmail: r.driverEmail || null,
                rideId: r.rideId || null,
                pickupLocation: r.pickupLocation || null,
                destination: r.destination || null,
                rideAmount: Number(r.rideAmount) || 0,
                rideStatus: r.rideStatus || null,
                reason: r.reason || null,
                description: r.description || null,
                createdAt: r.createdAt?.toDate?.()?.toISOString() || null,
                resolvedAt: r.resolvedAt?.toDate?.()?.toISOString() || null,
                resolutionNote: r.resolutionNote || null,
            };
        });

        res.json({ success: true, reports });
    } catch (error) {
        console.error('❌ admin reports error:', error);
        res.status(500).json({ error: 'Could not load reports' });
    }
});

// POST /admin-api/reports/resolve — body: { reportId, note }
app.post('/admin-api/reports/resolve', async (req, res) => {
    const { reportId, note } = req.body || {};
    if (!reportId) return res.status(400).json({ error: 'reportId is required' });

    try {
        await db.collection('driverReports').doc(reportId).update({
            status: 'resolved',
            resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
            resolutionNote: note || null,
        });
        res.json({ success: true });
    } catch (error) {
        console.error('❌ admin reports/resolve error:', error);
        res.status(500).json({ error: 'Could not resolve report' });
    }
});

// POST /admin-api/reports/reopen — body: { reportId }
// For when a report was marked resolved too early — puts it back in the
// open queue without losing the earlier resolution note.
app.post('/admin-api/reports/reopen', async (req, res) => {
    const { reportId } = req.body || {};
    if (!reportId) return res.status(400).json({ error: 'reportId is required' });

    try {
        await db.collection('driverReports').doc(reportId).update({
            status: 'open',
        });
        res.json({ success: true });
    } catch (error) {
        console.error('❌ admin reports/reopen error:', error);
        res.status(500).json({ error: 'Could not reopen report' });
    }
});

// Generates a fresh password-reset link and emails it to the driver — the
// only way into an admin-created account, since nobody (including the
// admin) ever sees or sets the account's actual password. Shared by
// drivers/create (right after account creation) and
// drivers/resend-welcome-email (if that first send failed, or the driver
// says they never got it).
async function sendDriverSetPasswordEmail(driverName, driverEmail) {
    const resetLink = await admin.auth().generatePasswordResetLink(driverEmail);
    return sendDriverWelcomeEmail({ driverName, driverEmail, resetLink });
}

// GET /admin-api/drivers — every driver, self-registered or admin-created.
app.get('/admin-api/drivers', async (req, res) => {
    try {
        // Not .orderBy('createdAt') — that silently drops any doc missing
        // the field entirely, which older driver docs (predating that
        // field) could well be. Sort in JS instead so nothing vanishes.
        const snap = await db.collection('drivers').limit(1000).get();

        const drivers = snap.docs.map((doc) => {
            const d = doc.data();
            return {
                driverId: doc.id,
                fullName: d.fullname || d.name || null,
                phone: d.phone || null,
                email: d.email || null,
                vehicleId: d.vehicle_id || null,
                bankDetailsVerified: !!d.bankDetailsVerified,
                bankDetailsSkipped: !!d.bankDetailsSkipped,
                createdByAdmin: !!d.createdByAdmin,
                createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
            };
        });

        drivers.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

        res.json({ success: true, drivers });
    } catch (error) {
        console.error('❌ admin drivers error:', error);
        res.status(500).json({ error: 'Could not load drivers' });
    }
});

// POST /admin-api/drivers/create — body: { fullName, phone, email, vehicleId }
// Creates a driver account the same way self-signup does (same
// drivers/{uid} schema as hooks/Firebase.js's signUpWithEmail) but from the
// admin side — for drivers onboarded in person, over the phone, etc. The
// account gets a random password nobody ever sees; the driver sets their
// own via the emailed reset link, then logs in through the normal driver
// login screen (phone number, looked up to the real email server-side)
// exactly like anyone who signed up themselves.
app.post('/admin-api/drivers/create', async (req, res) => {
    const { fullName, phone, email, vehicleId } = req.body || {};

    if (!fullName?.trim() || !phone?.trim() || !email?.trim() || !vehicleId?.trim()) {
        return res.status(400).json({ error: 'fullName, phone, email, and vehicleId are all required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({ error: 'Invalid email address' });
    }

    const normalizedPhone = normalizeNigerianPhone(phone);
    if (!normalizedPhone) {
        return res.status(400).json({ error: 'Invalid Nigerian phone number format' });
    }

    try {
        // Auth enforces email uniqueness itself (caught below); phone isn't
        // the Auth identifier here, so it needs its own check across both
        // collections, same as /api/auth/check-phone does pre-signup.
        const [usersSnap, driversSnap] = await Promise.all([
            db.collection('users').where('phone', '==', normalizedPhone).limit(1).get(),
            db.collection('drivers').where('phone', '==', normalizedPhone).limit(1).get(),
        ]);
        if (!usersSnap.empty || !driversSnap.empty) {
            return res.status(409).json({ error: 'A driver or customer with this phone number already exists' });
        }

        let userRecord;
        try {
            userRecord = await admin.auth().createUser({
                email: email.trim(),
                password: crypto.randomBytes(18).toString('base64'),
                displayName: fullName.trim(),
            });
        } catch (authError) {
            if (authError.code === 'auth/email-already-exists') {
                return res.status(409).json({ error: 'A driver or customer with this email already exists' });
            }
            throw authError;
        }

        await db.collection('drivers').doc(userRecord.uid).set({
            uid: userRecord.uid,
            fullname: fullName.trim(),
            email: email.trim(),
            phone: normalizedPhone,
            vehicle_id: vehicleId.trim(),
            role: 'driver',
            fcmTokens: {},
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdByAdmin: true,
        });

        const emailResult = await sendDriverSetPasswordEmail(fullName.trim(), email.trim());

        console.log(`👤 Admin created driver ${userRecord.uid} (${fullName.trim()})${emailResult.sent ? ' — welcome email sent' : ` — welcome email NOT sent (${emailResult.reason})`}`);

        res.json({
            success: true,
            driverId: userRecord.uid,
            emailSent: emailResult.sent,
            emailFailReason: emailResult.sent ? null : emailResult.reason,
        });
    } catch (error) {
        console.error('❌ admin drivers/create error:', error);
        res.status(500).json({ error: 'Could not create driver account' });
    }
});

// POST /admin-api/drivers/resend-welcome-email — body: { driverId }
app.post('/admin-api/drivers/resend-welcome-email', async (req, res) => {
    const { driverId } = req.body || {};
    if (!driverId) return res.status(400).json({ error: 'driverId is required' });

    try {
        const driverSnap = await db.collection('drivers').doc(driverId).get();
        if (!driverSnap.exists) return res.status(404).json({ error: 'Driver not found' });
        const driver = driverSnap.data();
        if (!driver.email) return res.status(400).json({ error: 'Driver has no email on file' });

        const emailResult = await sendDriverSetPasswordEmail(driver.fullname || driver.name || 'Driver', driver.email);
        res.json({
            success: true,
            emailSent: emailResult.sent,
            emailFailReason: emailResult.sent ? null : emailResult.reason,
        });
    } catch (error) {
        console.error('❌ admin drivers/resend-welcome-email error:', error);
        res.status(500).json({ error: 'Could not resend welcome email' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'KRides Notification Server' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Notification server running on port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
});

