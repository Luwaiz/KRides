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
    if (!API_KEY) {
        // Server misconfiguration — fail closed
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
const serviceAccount = require('./kampusride-firebase-adminsdk-fbsvc-c626e78acd.json');

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
        const pushToken = customerDoc.data()?.fcmToken || customerDoc.data()?.pushToken;
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
    const maxRetries = 3;
    const initialDelay = 500;
    const maxDelay = 5000;
    const backoffMultiplier = 2;

    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            console.log(`📤 Sending FCM notification to ${fcmToken.substring(0, 20)}...: ${title} (attempt ${attempt + 1}/${maxRetries + 1})`);

            // Send via Firebase Admin SDK
            const response = await admin.messaging().send(message);

            console.log('✅ FCM notification sent successfully:', response);
            return { success: true, messageId: response };

        } catch (error) {
            lastError = error;

            // Log full error for debugging
            console.log(`   ❌ FCM error:`, error.code, error.message);

            // Check for permanent errors (don't retry)
            const permanentErrors = [
                'messaging/invalid-registration-token',
                'messaging/registration-token-not-registered',
                'messaging/invalid-argument',
                'messaging/invalid-recipient',
            ];

            if (permanentErrors.includes(error.code)) {
                console.warn(`🚫 Permanent error (${error.code}), not retrying`);
                return {
                    success: false,
                    error: error.code,
                    message: error.message,
                    permanent: true
                };
            }

            // If this was the last attempt, return failure
            if (attempt === maxRetries) {
                console.error(`❌ Error sending FCM notification (all ${maxRetries + 1} attempts failed):`, error.message);
                return {
                    success: false,
                    error: error.code || 'unknown',
                    message: error.message
                };
            }

            // Calculate delay with exponential backoff
            const delay = Math.min(
                initialDelay * Math.pow(backoffMultiplier, attempt),
                maxDelay
            );

            console.log(`⚠️ Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
            console.log(`   Error: ${error.message}`);

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // This shouldn't be reached, but just in case
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
        const pushToken = userData.fcmToken || userData.pushToken;

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
                const pushToken = userData.fcmToken || userData.pushToken;

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

        // Get all drivers
        const driversSnapshot = await db.collection('drivers').get();
        const results = [];

        for (const doc of driversSnapshot.docs) {
            const driver = doc.data();
            const pushToken = driver.fcmToken || driver.pushToken; // Support both field names

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
        const pushToken = customer.fcmToken || customer.pushToken;

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
        const pushToken = customer.fcmToken || customer.pushToken;

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
        const pushToken = customer.fcmToken || customer.pushToken;

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

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'KRides Notification Server' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Notification server running on port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
});

