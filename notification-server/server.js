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
            return res.json({ success: true, payout: null, reason: 'no_bank_details' });
        }

        // Initiate Flutterwave transfer
        const reference = `krides_payout_${rideId}`;
        console.log(`💸 Transferring ₦${driverEarnings} to driver ${driverId} (${driver.accountNumber})`);

        const transferResponse = await fetch('https://api.flutterwave.com/v3/transfers', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                account_bank: driver.bankCode,
                account_number: driver.accountNumber,
                amount: driverEarnings,
                narration: `KRides ride payment - ${rideId.slice(0, 8)}`,
                currency: 'NGN',
                reference,
            }),
        });

        const transferResult = await transferResponse.json();

        if (transferResult.status === 'success' || transferResult.status === 'NEW') {
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
        } else {
            console.error(`❌ Payout failed for driver ${driverId}:`, transferResult.message);
            await rideRef.update({ payoutStatus: 'failed', payoutError: transferResult.message });
            // Ride is still completed — payout failure is non-blocking
            return res.json({
                success: true,
                payout: null,
                reason: 'transfer_failed',
                error: transferResult.message,
            });
        }

    } catch (error) {
        console.error('❌ complete-ride error:', error);
        return res.status(500).json({ error: 'Could not complete ride. Please try again.' });
    }
});

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
        await db.runTransaction(async (txn) => {
            const userSnap = await txn.get(userRef);
            if (!userSnap.exists) throw new Error('Customer not found');

            const currentBalance = Number(userSnap.data().walletBalance) || 0;
            txn.update(userRef, { walletBalance: currentBalance + amount });

            const txRef = db.collection('walletTransactions').doc();
            txn.set(txRef, {
                userId: customerId,
                type: 'refund',
                amount,
                description: 'Ride cancellation refund',
                rideId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Idempotency guard — prevent a second refund if this endpoint is called twice
            txn.update(rideRef, { walletRefunded: true });
        });

        console.log(`✅ Wallet refund of ₦${amount} credited to customer ${customerId} (ride ${rideId})`);
        return res.json({ success: true, refundedAmount: amount });

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

        // TODO: enable email notifications when ready
        // Set GMAIL_USER, GMAIL_APP_PASSWORD, and ADMIN_EMAIL (kampusrides24@gmail.com) on Render
        console.log(`📋 Report saved for ride ${rideId} — email notifications disabled`);

        return res.json({ success: true });

    } catch (error) {
        console.error('❌ driver report error:', error);
        return res.status(500).json({ error: 'Could not submit report. Please try again.' });
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

