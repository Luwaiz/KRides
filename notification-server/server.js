const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API key authentication — all /api/* routes require a valid key.
// The key is shared with the mobile app via an environment variable so it
// never appears in source control. Set NOTIFICATION_API_KEY in your .env
// and as an EAS Secret for production builds.
const API_KEY = process.env.NOTIFICATION_API_KEY;

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

// Notify customer that driver has arrived
app.post('/api/notifications/notify-driver-arrived', async (req, res) => {
    const { customerId, driverName } = req.body;
    console.log('\ud83d\udccd Driver arrival notification request:', { customerId, driverName });
    if (!customerId || !driverName) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
        const customerDoc = await db.collection('users').doc(customerId).get();
        if (!customerDoc.exists) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        const pushToken = customerDoc.data()?.fcmToken;
        if (!pushToken) {
            return res.json({ success: false, skipped: true, reason: 'no_push_token' });
        }
        await sendFCMNotification(
            pushToken,
            'Driver Arrived! 🚗',
            `${driverName} has arrived at your pickup location`,
            { type: 'driver_arrived', driverName }
        );
        console.log('\u2705 Driver arrival notification sent');
        res.json({ success: true });
    } catch (error) {
        console.error('\u274c Error:', error);
        res.status(500).json({ error: error.message });
    }
});

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

// Process a refund via Flutterwave
app.post('/api/payments/refund', async (req, res) => {
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
    const { bankCode, accountNumber, accountName, businessName, phone } = req.body;

    if (!bankCode || !accountNumber || !accountName) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) {
        return res.status(500).json({ error: 'Payment service not configured' });
    }

    try {
        const response = await fetch('https://api.flutterwave.com/v3/subaccounts', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                account_bank: bankCode,
                account_number: accountNumber,
                business_name: businessName || accountName,
                business_email: `${phone}@rideapp.com`,
                business_mobile: phone,
                country: 'NG',
                split_type: 'flat',
                split_value: 50,
            }),
        });

        const result = await response.json();

        if (result.status === 'success') {
            res.json({ success: true, data: result.data });
        } else {
            res.status(400).json({ error: result.message || 'Subaccount creation failed' });
        }
    } catch (error) {
        console.error('❌ Flutterwave subaccount error:', error);
        res.status(500).json({ error: 'Payment service unavailable. Please try again.' });
    }
});

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

    // Normalize: accept 08XXXXXXXXX, +234XXXXXXXXXX, 234XXXXXXXXXX
    const normalized = (() => {
        const digits = phone.replace(/\D/g, '');
        if (digits.startsWith('234') && digits.length === 13) return '0' + digits.slice(3);
        if (/^0[789]\d{9}$/.test(digits)) return digits;
        return null;
    })();

    if (!normalized) {
        return res.status(400).json({ error: 'Invalid Nigerian phone number format' });
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

// ── Wallet ────────────────────────────────────────────────────────────────────

/**
 * POST /api/wallet/create-virtual-account
 * Creates a permanent Flutterwave virtual account for a customer and stores
 * the details in their Firestore document. If the account already exists the
 * stored details are returned immediately — no second Flutterwave API call.
 *
 * Body: { userId, email, name }
 */
app.post('/api/wallet/create-virtual-account', async (req, res) => {
    const { userId, email, name } = req.body;

    if (!userId || !email) {
        return res.status(400).json({ error: 'userId and email are required' });
    }

    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) {
        return res.status(500).json({ error: 'Payment service not configured' });
    }

    try {
        const userRef = db.collection('users').doc(userId);
        const userSnap = await userRef.get();

        // Return cached account if one was already created — avoids duplicate VA creation
        if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.virtualAccountNumber && data.virtualAccountBank) {
                console.log(`✅ Returning cached virtual account for ${userId}`);
                return res.json({
                    success: true,
                    accountNumber: data.virtualAccountNumber,
                    bankName: data.virtualAccountBank,
                    accountName: data.virtualAccountName || name || 'KRides Wallet',
                    cached: true,
                });
            }
        }

        // Split name into first/last for Flutterwave's required fields
        const nameParts = (name || 'KRides User').trim().split(/\s+/);
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'User';
        const txRef = `krides_va_${userId}`;

        console.log(`🏦 Creating virtual account for user ${userId} (${email})`);

        const response = await fetch('https://api.flutterwave.com/v3/virtual-account-numbers', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                is_permanent: true,
                tx_ref: txRef,
                firstname: firstName,
                lastname: lastName,
                narration: `KRides Wallet - ${name || email}`,
            }),
        });

        const result = await response.json();

        if (result.status !== 'success') {
            console.error('❌ Flutterwave VA creation failed:', result.message);
            return res.status(400).json({
                success: false,
                error: result.message || 'Could not create virtual account',
            });
        }

        const { account_number, bank_name } = result.data;
        const accountName = `${firstName} ${lastName}`.trim();

        // Persist to Firestore via Admin SDK (bypasses client-side rules)
        await userRef.set({
            virtualAccountNumber: account_number,
            virtualAccountBank: bank_name,
            virtualAccountRef: txRef,
            virtualAccountName: accountName,
            virtualAccountCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
            walletBalance: 0,
        }, { merge: true });

        console.log(`✅ Virtual account created for ${userId}: ${account_number} (${bank_name})`);

        return res.json({
            success: true,
            accountNumber: account_number,
            bankName: bank_name,
            accountName,
        });

    } catch (error) {
        console.error('❌ Virtual account creation error:', error);
        return res.status(500).json({
            success: false,
            error: 'Could not create virtual account. Please try again.',
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

    // tx_ref format: krides_va_{userId}
    if (!txRef.startsWith('krides_va_')) {
        console.log(`ℹ️ Ignoring unrelated tx_ref: ${txRef}`);
        return;
    }

    const userId = txRef.replace('krides_va_', '');
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
                customerName: rideData.customerName || 'Customer',
                customerPhone: rideData.customerPhone || '',
                pickupLocation: rideData.pickupLocation,
                pickupCoords: rideData.pickupCoords || null,
                destination: rideData.destination,
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

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'KRides Notification Server' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Notification server running on port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
});

