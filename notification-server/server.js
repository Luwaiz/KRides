const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { sendDriverReportEmail, sendDriverWelcomeEmail } = require('./emailservice');
require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 3001;
const FLUTTERWAVE_PROXY_URL = process.env.QUOTAGUARDSTATIC_URL || process.env.QUOTAGUARD_URL || null;
const flutterwaveProxyAgent = FLUTTERWAVE_PROXY_URL ? new HttpsProxyAgent(FLUTTERWAVE_PROXY_URL) : null;

async function flutterwaveRequest(url, config = {}) {
    const axiosConfig = {
        url,
        // Every call site below inspects Flutterwave's own status/message in
        // the response body (a carryover from when these were plain fetch()
        // calls, which never throws on an HTTP error status) — axios's
        // default is the opposite: it throws on any non-2xx before that body
        // is ever reachable. Flutterwave routinely returns non-2xx for
        // perfectly ordinary outcomes (verify_by_reference 404s until a
        // transfer clears, a rejected transfer, an unresolvable account
        // number), so left at axios's default this silently replaced every
        // one of those specific, useful error messages with a generic
        // "Request failed with status code 4xx". Accept every status here so
        // response.data is always what the caller actually checks.
        validateStatus: () => true,
        ...config,
    };

    if (flutterwaveProxyAgent) {
        axiosConfig.httpsAgent = flutterwaveProxyAgent;
        axiosConfig.httpAgent = flutterwaveProxyAgent;
    }

    const response = await axios(axiosConfig);
    return response.data;
}

if (FLUTTERWAVE_PROXY_URL) {
    console.log('🔒 Flutterwave outbound requests are routed through QuotaGuard');
}

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

        const result = await flutterwaveRequest(`https://api.flutterwave.com/v3/transactions/${transactionId}/refund`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
            },
            data: payload,
        });

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
        const result = await flutterwaveRequest(`https://api.flutterwave.com/v3/refunds/${refundId}`, {
            headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
            },
        });

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
        const resolveResult = await flutterwaveRequest('https://api.flutterwave.com/v3/accounts/resolve', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
            },
            data: {
                account_number: accountNumber,
                account_bank: bankCode,
            },
        });

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

        const result = isUpdate
            ? await flutterwaveRequest(`https://api.flutterwave.com/v3/subaccounts/${existing.subaccountId}`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${secretKey}`,
                    'Content-Type': 'application/json',
                },
                data: {
                    account_number: accountNumber,
                    business_name: businessName || verifiedAccountName,
                    split_type: 'flat',
                    split_value: 50,
                },
            })
            : await flutterwaveRequest('https://api.flutterwave.com/v3/subaccounts', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${secretKey}`,
                    'Content-Type': 'application/json',
                },
                data: {
                    account_bank: bankCode,
                    account_number: accountNumber,
                    business_name: businessName || verifiedAccountName,
                    business_email: `${phone}@rideapp.com`,
                    business_mobile: phone,
                    country: 'NG',
                    split_type: 'flat',
                    split_value: 50,
                },
            });

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

// Mirrors constants/pricingConfig.js's PRICING_DEFAULTS on the mobile app —
// kept in sync manually since this is a separate codebase/runtime, not a
// shared package. Both sides fall back to these if config/pricing hasn't
// been touched yet, so nothing breaks before an admin ever visits Pricing.
const PRICING_DEFAULTS = {
    baseFarePerPassenger: 200,
    platformFeeStandard: 100,
    platformFeeGroup: 150,
    groupThreshold: 3,
};

async function getPricingConfig() {
    try {
        const snap = await db.collection('config').doc('pricing').get();
        if (snap.exists) return { ...PRICING_DEFAULTS, ...snap.data() };
    } catch (error) {
        console.error('❌ getPricingConfig error, using defaults:', error.message);
    }
    return PRICING_DEFAULTS;
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

        const result = await flutterwaveRequest('https://api.flutterwave.com/v3/virtual-account-numbers', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
            },
            data: {
                email,
                is_permanent: false,
                amount: parsedAmount,
                tx_ref: txRef,
                firstname: firstName,
                lastname: lastName,
                narration: `KRides Wallet Top-up - ₦${parsedAmount}`,
            },
        });

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
    // Respond only once we know whether this delivery needs a retry — acking
    // 200 up front (the previous behavior) told Flutterwave "delivered" even
    // when verification or the credit itself then failed, which meant their
    // own retry mechanism never got a chance to recover from anything but a
    // dropped connection. Events that can never succeed no matter how many
    // times they're retried (bad signature, malformed/unrelated payload)
    // still get a fast ack; only a transient failure gets a non-2xx.
    const webhookSecret = process.env.FLUTTERWAVE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error('❌ FLUTTERWAVE_WEBHOOK_SECRET is not set — rejecting webhook');
        return res.sendStatus(500); // may be fixable before Flutterwave gives up retrying
    }

    const signature = req.headers['verif-hash'];
    if (!signature || signature !== webhookSecret) {
        console.warn('🚫 Webhook rejected: invalid verif-hash');
        return res.sendStatus(401);
    }

    const { event, data } = req.body || {};

    if (event !== 'charge.completed' || data?.status !== 'successful') {
        console.log(`ℹ️ Ignoring webhook: event=${event} status=${data?.status}`);
        return res.sendStatus(200);
    }

    if (data.currency !== 'NGN') {
        console.log(`ℹ️ Ignoring non-NGN webhook: ${data.currency}`);
        return res.sendStatus(200);
    }

    const txRef = data.tx_ref || '';
    const flwTxId = String(data.id);
    const amount = Number(data.amount);

    if (!amount || amount <= 0 || isNaN(amount)) {
        console.error(`❌ Webhook has invalid amount: ${data.amount}`);
        return res.sendStatus(200);
    }

    // tx_ref format: krides_topup_{userId}_{timestamp}
    if (!txRef.startsWith('krides_topup_')) {
        console.log(`ℹ️ Ignoring unrelated tx_ref: ${txRef}`);
        return res.sendStatus(200);
    }

    // Strip prefix and suffix timestamp: krides_topup_{userId}_{ts}
    const withoutPrefix = txRef.replace('krides_topup_', '');
    const lastUnder = withoutPrefix.lastIndexOf('_');
    const userId = lastUnder > 0 ? withoutPrefix.slice(0, lastUnder) : withoutPrefix;
    if (!userId) {
        console.error('❌ Could not parse userId from tx_ref:', txRef);
        return res.sendStatus(200);
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

        // Ack now that the credit is durably written — nothing after this
        // point should block Flutterwave's view of whether delivery succeeded.
        res.sendStatus(200);

        // Best-effort: clear any orphanedTopups record a previous failed
        // attempt for this same flwTxId left behind, now that it's resolved.
        db.collection('orphanedTopups').doc(flwTxId).delete().catch(() => {});

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
        // Non-2xx so Flutterwave retries — the flwTxId idempotency lock makes
        // a retry safe even if the earlier attempt partially succeeded.
        res.sendStatus(500);

        // Record it for manual review in case retries never recover it (e.g.
        // Flutterwave gives up before whatever broke gets fixed). Only
        // reachable after verif-hash already checked out above, so userId/
        // amount here came from a signed Flutterwave payload — safe for the
        // admin panel to auto-credit from later (see /admin-api/orphaned-topups).
        try {
            const orphanRef = db.collection('orphanedTopups').doc(flwTxId);
            const orphanSnap = await orphanRef.get();
            await orphanRef.set({
                flwTxId,
                txRef,
                userId: userId || null,
                amount,
                error: error.message,
                status: 'unresolved',
                attempts: admin.firestore.FieldValue.increment(1),
                lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
                ...(orphanSnap.exists ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
            }, { merge: true });
        } catch (logErr) {
            console.error('❌ Could not record orphaned top-up:', logErr.message);
        }
    }
});

/**
 * POST /api/wallet/verify-topup
 * Backs the Wallet screen's "I've Sent The Money" button — lets the
 * customer actively ask "did this land yet?" instead of just waiting on the
 * webhook. Verifies the ID token, confirms the tx_ref is actually this
 * user's own top-up, then asks Flutterwave directly whether that reference
 * succeeded. If it did, credits the wallet through the exact same
 * flwTxId-keyed idempotent path the webhook uses — so this is safe to call
 * any number of times, and safe even if the webhook fires around the same
 * moment (whichever gets there first wins, the other is a no-op).
 *
 * This is also the manual-recovery path for a webhook that never arrives at
 * all (dropped, secret misconfigured at the time, etc) — the orphanedTopups
 * queue only catches a webhook that arrived and then failed to process, not
 * one that never showed up. A customer tapping this button after a delay
 * covers that gap without needing a polling job.
 *
 * Body: { idToken, txRef }
 */
app.post('/api/wallet/verify-topup', async (req, res) => {
    const { idToken, txRef } = req.body || {};
    if (!idToken || !txRef) {
        return res.status(400).json({ error: 'idToken and txRef are required' });
    }

    let userId;
    try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        userId = decoded.uid;
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
    }

    // tx_ref format: krides_topup_{userId}_{timestamp} — refuse to let a user
    // probe or credit a top-up reference that isn't their own.
    if (!txRef.startsWith(`krides_topup_${userId}_`)) {
        return res.status(403).json({ error: 'This reference does not belong to you' });
    }

    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) {
        return res.status(500).json({ error: 'Payment service not configured' });
    }

    try {
        const verifyResult = await flutterwaveRequest(
            `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
            { headers: { Authorization: `Bearer ${secretKey}` } }
        );

        if (verifyResult.status !== 'success' || !verifyResult.data) {
            // Flutterwave has no completed transaction against this reference
            // yet — most likely the transfer just hasn't been made (or hasn't
            // cleared) rather than anything broken.
            return res.json({ success: true, credited: false, status: 'not_found' });
        }

        const data = verifyResult.data;

        if (data.status !== 'successful') {
            return res.json({ success: true, credited: false, status: data.status });
        }
        if (data.currency !== 'NGN') {
            console.error(`❌ verify-topup: unexpected currency ${data.currency} for ${txRef}`);
            return res.status(400).json({ error: 'Unexpected currency on this transaction' });
        }

        const amount = Number(data.amount);
        const flwTxId = String(data.id);
        if (!amount || amount <= 0) {
            console.error(`❌ verify-topup: invalid amount on ${txRef}`);
            return res.status(400).json({ error: 'Invalid amount on transaction' });
        }

        const userRef = db.collection('users').doc(userId);
        const txnRef = userRef.collection('walletTransactions').doc(flwTxId);
        let alreadyCredited = false;

        await db.runTransaction(async (txn) => {
            const txnSnap = await txn.get(txnRef);
            if (txnSnap.exists) {
                alreadyCredited = true;
                return; // webhook (or an earlier click) already handled this
            }

            const userSnap = await txn.get(userRef);
            if (!userSnap.exists) {
                throw new Error(`User not found: ${userId}`);
            }

            txn.update(userRef, { walletBalance: admin.firestore.FieldValue.increment(amount) });
            txn.set(txnRef, {
                userId,
                type: 'topup',
                amount,
                rideId: null,
                flwTxRef: txRef,
                flwTxId,
                status: 'completed',
                note: 'Credited via manual "I\'ve sent the money" check',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });

        console.log(`✅ verify-topup credited userId=${userId} +₦${amount} (flwTxId=${flwTxId}, alreadyCredited=${alreadyCredited})`);

        // Clear any orphan record now that it's resolved one way or another.
        db.collection('orphanedTopups').doc(flwTxId).delete().catch(() => {});

        return res.json({ success: true, credited: true, amount });
    } catch (error) {
        console.error('❌ verify-topup error:', error);
        return res.status(500).json({ error: 'Could not verify payment. Please try again.' });
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
 * Platform keeps a flat fee on top of the driver's base-fare earnings —
 * amount set via admin-web's Pricing page (config/pricing), see
 * getPricingConfig(). No longer a fixed ₦ figure in code.
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

        // Platform fee (the cut on top of the driver's base-fare earnings)
        // is set from admin-web's Pricing page — see getPricingConfig().
        const totalAmount = Number(ride.amount) || 0;
        const passengers = Number(ride.numberOfPassengers) || 1;
        const pricing = await getPricingConfig();
        const platformFee = passengers >= pricing.groupThreshold ? pricing.platformFeeGroup : pricing.platformFeeStandard;
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
    const result = await flutterwaveRequest('https://api.flutterwave.com/v3/transfers', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
        },
        data: {
            account_bank: driver.bankCode,
            account_number: driver.accountNumber,
            amount,
            narration,
            currency: 'NGN',
            reference,
        },
    });
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

    const result = await flutterwaveRequest(
        `https://api.flutterwave.com/v3/transactions/${transactionId}/refund`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
            },
            data: payload,
        }
    );
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
        // Move off refundStatus:'failed' once given up on, or this same ride
        // matches the sweep's query and gets "found" again on every future
        // run forever, even though nothing further happens to it. Not
        // gated on `!ride.needsManualRefundReview` — a ride already flagged
        // from before this fix existed still has refundStatus:'failed' and
        // needs this write to actually happen at least once to escape the
        // loop; repeating it after that is harmless (idempotent), and it
        // won't be fetched again either way once refundStatus changes. The
        // admin review queue keys off needsManualRefundReview, not
        // refundStatus, so this doesn't affect its visibility there.
        await rideRef.update({
            refundStatus: 'needs_review',
            needsManualRefundReview: true,
            refundReviewReason: `Refund retry failed ${attempts} times — needs manual review`,
        }).catch(() => {});
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
        // Same reasoning as the card-refund branch above: move off
        // walletRefundStatus:'failed' once given up on (unconditionally —
        // see that comment for why it's not gated on needsManualRefundReview),
        // so this ride stops matching the sweep's query forever.
        await rideRef.update({
            walletRefundStatus: 'needs_review',
            needsManualRefundReview: true,
            refundReviewReason: `Wallet refund retry failed ${attempts} times — needs manual review`,
        }).catch(() => {});
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
        // Same class of bug as the refund sweeps above (see the comment
        // there): move off payoutStatus:'failed' once given up on, or this
        // ride matches this query forever. Unconditional (not gated on
        // needsManualPayoutReview) so a ride already flagged from before
        // this fix still escapes the loop on its next sweep.
        await rideRef.update({
            payoutStatus: 'needs_review',
            needsManualPayoutReview: true,
            payoutReviewReason: `Payout retry failed ${attempts} times — needs manual review`,
        }).catch(() => {});
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

// A ride marked paid stays visible on the payouts page (just badged/dimmed
// on the frontend) instead of disappearing the instant it's settled — but
// showing literally every paid ride a driver has ever had would make this
// query grow unbounded forever. Cap "recently paid" to this window; older
// settled rides still count in paidTotal (that's a running counter on the
// driver doc, not derived from this list), they just drop off the visible
// history after a month.
const PAYOUTS_PAID_HISTORY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// GET /admin-api/payouts/overview
// Every driver — not just ones currently owed money — each with what's
// pending now ("To Be Paid"), their all-time paid total ("Paid Total"), and
// a combined recent ride list (owed + recently-settled) so the admin panel
// can give each driver their own persistent tab instead of one flat list
// that only shows whoever happens to have something pending right now.
app.get('/admin-api/payouts/overview', async (req, res) => {
    try {
        const paidSince = admin.firestore.Timestamp.fromMillis(Date.now() - PAYOUTS_PAID_HISTORY_WINDOW_MS);

        const [owedSnap, paidSnap, driversSnap] = await Promise.all([
            db.collection('rides')
                // 'needs_review' = the automatic-retry sweep gave up after
                // PAYOUT_RETRY_MAX_ATTEMPTS — still owed, still needs a human
                // to pay it, same as 'failed'; it just stops the sweep from
                // rediscovering it every 10 minutes forever (see retryFailedPayout).
                .where('payoutStatus', 'in', ['pending_manual', 'failed', 'awaiting_bank_details', 'needs_review'])
                .get(),
            db.collection('rides')
                .where('payoutStatus', '==', 'paid_manually')
                .where('payoutPaidAt', '>=', paidSince)
                .get(),
            db.collection('drivers').limit(1000).get(),
        ]);

        // pickupLocation/destination are strings on older rides, {name,
        // address,...} objects on newer ones (see the same normalization
        // in components/HistoryCard.js on the mobile side).
        const placeName = (place) =>
            typeof place === 'object' && place ? (place.name || place.address || null) : (place || null);

        const toRideRow = (doc) => {
            const ride = doc.data();
            return {
                rideId: doc.id,
                driverId: ride.driverId || null,
                amount: Number(ride.payoutAmount) || 0,
                completedAt: ride.completedAt?.toDate?.()?.toISOString() || null,
                status: ride.payoutStatus,
                paidAt: ride.payoutPaidAt?.toDate?.()?.toISOString() || null,
                customerName: ride.customerName || null,
                pickupLocation: placeName(ride.pickupLocation),
                destination: placeName(ride.destination),
                numberOfPassengers: Number(ride.numberOfPassengers) || null,
                paymentMethod: ride.paymentMethod || null,
                transactionId: ride.transactionId || null,
                payoutReference: ride.payoutReference || null,
                payoutError: ride.payoutError || null,
            };
        };

        const owedByDriver = new Map();
        for (const doc of owedSnap.docs) {
            const row = toRideRow(doc);
            if (!row.driverId) continue;
            if (!owedByDriver.has(row.driverId)) owedByDriver.set(row.driverId, []);
            owedByDriver.get(row.driverId).push(row);
        }

        const ridesByDriver = new Map(
            Array.from(owedByDriver.entries()).map(([driverId, rows]) => [driverId, [...rows]])
        );
        for (const doc of paidSnap.docs) {
            const row = toRideRow(doc);
            if (!row.driverId) continue;
            if (!ridesByDriver.has(row.driverId)) ridesByDriver.set(row.driverId, []);
            ridesByDriver.get(row.driverId).push(row);
        }

        const sortByRecency = (rides) =>
            rides.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));

        const drivers = driversSnap.docs.map((doc) => {
            const driver = doc.data();
            const owedRides = owedByDriver.get(doc.id) || [];
            const rides = sortByRecency(ridesByDriver.get(doc.id) || []);
            return {
                driverId: doc.id,
                name: driver.fullname || driver.name || '(unknown name)',
                bankName: driver.bankName || null,
                accountNumber: driver.accountNumber || null,
                accountName: driver.accountName || null,
                toBePaid: owedRides.reduce((sum, r) => sum + r.amount, 0),
                paidTotal: Number(driver.totalPaidOut) || 0,
                rides,
            };
        });

        // A driver with rides owed but no drivers/{id} doc (shouldn't
        // happen, but the old endpoint tolerated it) still needs to show up.
        for (const [driverId, rides] of ridesByDriver) {
            if (drivers.some((d) => d.driverId === driverId)) continue;
            const owedRides = owedByDriver.get(driverId) || [];
            drivers.push({
                driverId,
                name: '(unknown name)',
                bankName: null,
                accountNumber: null,
                accountName: null,
                toBePaid: owedRides.reduce((sum, r) => sum + r.amount, 0),
                paidTotal: 0,
                rides: sortByRecency(rides),
            });
        }

        // Drivers owing money first (most owed first), then everyone else.
        drivers.sort((a, b) => b.toBePaid - a.toBePaid);

        res.json({ success: true, drivers });
    } catch (error) {
        console.error('❌ admin payouts/overview error:', error);
        res.status(500).json({ error: 'Could not load payouts overview' });
    }
});

// POST /admin-api/payouts/mark-paid — body: { rideIds: string[] }
// Marks each ride paid, then rolls its amount into that driver's running
// totalPaidOut — the number "Paid Total" reads from. A ride that's already
// paid_manually is skipped rather than re-counted, so a stale click or a
// retried request never inflates totalPaidOut twice for the same ride.
app.post('/admin-api/payouts/mark-paid', async (req, res) => {
    const { rideIds } = req.body || {};
    if (!Array.isArray(rideIds) || rideIds.length === 0) {
        return res.status(400).json({ error: 'rideIds must be a non-empty array' });
    }

    const results = [];
    const paidByDriver = new Map();

    for (const rideId of rideIds) {
        try {
            const rideRef = db.collection('rides').doc(rideId);
            const rideSnap = await rideRef.get();
            if (!rideSnap.exists) {
                results.push({ rideId, ok: false, error: 'not found' });
                continue;
            }

            const ride = rideSnap.data();
            if (ride.payoutStatus === 'paid_manually') {
                results.push({ rideId, ok: true, alreadyPaid: true });
                continue;
            }

            await rideRef.update({
                payoutStatus: 'paid_manually',
                payoutPaidAt: admin.firestore.FieldValue.serverTimestamp(),
                payoutError: admin.firestore.FieldValue.delete(),
            });

            if (ride.driverId) {
                const amount = Number(ride.payoutAmount) || 0;
                paidByDriver.set(ride.driverId, (paidByDriver.get(ride.driverId) || 0) + amount);
            }
            results.push({ rideId, ok: true });
        } catch (error) {
            results.push({ rideId, ok: false, error: error.message });
        }
    }

    await Promise.all(
        Array.from(paidByDriver.entries())
            .filter(([, amount]) => amount > 0)
            .map(([driverId, amount]) =>
                db.collection('drivers').doc(driverId)
                    .update({ totalPaidOut: admin.firestore.FieldValue.increment(amount) })
                    .catch((err) => console.error(`❌ Could not update totalPaidOut for driver ${driverId}:`, err.message))
            )
    );

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
        if (['failed', 'needs_review'].includes(ride.walletRefundStatus)) {
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

// GET /admin-api/orphaned-topups — unresolved orphanedTopups docs (a wallet
// top-up webhook that verified but failed to credit — see the catch block
// in POST /api/wallet/webhook)
app.get('/admin-api/orphaned-topups', async (req, res) => {
    try {
        const snap = await db.collection('orphanedTopups')
            .where('status', '==', 'unresolved')
            .get();

        const topups = snap.docs.map((doc) => {
            const t = doc.data();
            return {
                topupId: doc.id,
                flwTxId: t.flwTxId || doc.id,
                txRef: t.txRef || null,
                userId: t.userId || null,
                amount: Number(t.amount) || 0,
                error: t.error || null,
                attempts: t.attempts || 1,
                createdAt: t.createdAt?.toDate?.()?.toISOString() || null,
                lastAttemptAt: t.lastAttemptAt?.toDate?.()?.toISOString() || null,
            };
        });

        res.json({ success: true, topups });
    } catch (error) {
        console.error('❌ admin orphaned-topups error:', error);
        res.status(500).json({ error: 'Could not load orphaned top-ups' });
    }
});

// POST /admin-api/orphaned-topups/credit — body: { topupId }
// Runs the same credit the webhook would have and marks the record
// resolved. Safe to click more than once: it reuses the flwTxId-keyed
// idempotency lock in walletTransactions, so a retry (webhook or admin)
// that already landed is a no-op instead of a double credit.
app.post('/admin-api/orphaned-topups/credit', async (req, res) => {
    const { topupId } = req.body || {};
    if (!topupId) return res.status(400).json({ error: 'topupId is required' });

    try {
        const orphanRef = db.collection('orphanedTopups').doc(topupId);
        const orphanSnap = await orphanRef.get();
        if (!orphanSnap.exists) return res.status(404).json({ error: 'Not found' });

        const orphan = orphanSnap.data();
        if (!orphan.userId) {
            return res.status(400).json({ error: 'No userId on record — could not be parsed from tx_ref. Resolve manually.' });
        }
        if (!(Number(orphan.amount) > 0)) {
            return res.status(400).json({ error: 'No valid amount on record. Resolve manually.' });
        }

        const userRef = db.collection('users').doc(orphan.userId);
        const txnRef = userRef.collection('walletTransactions').doc(orphan.flwTxId || topupId);

        await db.runTransaction(async (txn) => {
            const txnSnap = await txn.get(txnRef);
            if (txnSnap.exists) return; // already credited (e.g. a delayed webhook retry beat this click) — no-op

            const userSnap = await txn.get(userRef);
            if (!userSnap.exists) throw new Error(`User not found: ${orphan.userId}`);

            txn.update(userRef, { walletBalance: admin.firestore.FieldValue.increment(orphan.amount) });
            txn.set(txnRef, {
                userId: orphan.userId,
                type: 'topup',
                amount: orphan.amount,
                rideId: null,
                flwTxRef: orphan.txRef || null,
                flwTxId: orphan.flwTxId || topupId,
                status: 'completed',
                note: 'Manually credited from Orphaned Top-ups review',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });

        await orphanRef.update({
            status: 'resolved',
            resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
            resolvedNote: 'Auto-credited from admin panel',
        });

        res.json({ success: true });
    } catch (error) {
        console.error('❌ admin orphaned-topups/credit error:', error);
        res.status(500).json({ error: error.message || 'Could not credit' });
    }
});

// POST /admin-api/orphaned-topups/resolve — body: { topupId, note }
// Marks resolved without crediting — for records with no parseable userId,
// or ones the admin has already fixed some other way (e.g. directly via
// scripts/test-fund-wallet.js after confirming the transfer in Flutterwave's
// dashboard).
app.post('/admin-api/orphaned-topups/resolve', async (req, res) => {
    const { topupId, note } = req.body || {};
    if (!topupId) return res.status(400).json({ error: 'topupId is required' });

    try {
        await db.collection('orphanedTopups').doc(topupId).update({
            status: 'resolved',
            resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
            resolvedNote: note || null,
        });
        res.json({ success: true });
    } catch (error) {
        console.error('❌ admin orphaned-topups/resolve error:', error);
        res.status(500).json({ error: 'Could not resolve orphaned top-up' });
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

// GET /admin-api/pricing — current pricing config (or defaults, if
// config/pricing has never been written).
app.get('/admin-api/pricing', async (req, res) => {
    try {
        const pricing = await getPricingConfig();
        res.json({ success: true, pricing });
    } catch (error) {
        console.error('❌ admin pricing error:', error);
        res.status(500).json({ error: 'Could not load pricing' });
    }
});

// POST /admin-api/pricing/update — body: { baseFarePerPassenger,
// platformFeeStandard, platformFeeGroup, groupThreshold }
// Takes effect immediately for every ride booked/completed after this —
// the mobile app has a live listener on config/pricing (see
// constants/pricingConfig.js) and complete-ride reads it fresh on every call.
app.post('/admin-api/pricing/update', async (req, res) => {
    const { baseFarePerPassenger, platformFeeStandard, platformFeeGroup, groupThreshold } = req.body || {};

    const fields = { baseFarePerPassenger, platformFeeStandard, platformFeeGroup, groupThreshold };
    for (const [key, value] of Object.entries(fields)) {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
            return res.status(400).json({ error: `${key} must be a non-negative number` });
        }
    }
    if (baseFarePerPassenger <= 0) {
        return res.status(400).json({ error: 'baseFarePerPassenger must be greater than 0' });
    }
    if (!Number.isInteger(groupThreshold) || groupThreshold < 1) {
        return res.status(400).json({ error: 'groupThreshold must be a whole number of at least 1' });
    }

    try {
        await db.collection('config').doc('pricing').set({
            baseFarePerPassenger,
            platformFeeStandard,
            platformFeeGroup,
            groupThreshold,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`💰 Pricing updated: base=₦${baseFarePerPassenger}/passenger, fee=₦${platformFeeStandard}(<${groupThreshold})/₦${platformFeeGroup}(>=${groupThreshold})`);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ admin pricing/update error:', error);
        res.status(500).json({ error: 'Could not update pricing' });
    }
});

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

