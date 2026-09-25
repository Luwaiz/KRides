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

app.use('/api', cors({ origin: false }));
app.use(express.json());

const API_KEY = process.env.NOTIFICATION_API_KEY;

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const ADMIN_ALLOWED_ORIGINS = (process.env.ADMIN_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

app.use('/admin-api', cors({
    origin: (origin, callback) => {
        if (!origin || ADMIN_ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
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

const PAYOUT_MODE = process.env.PAYOUT_MODE || 'manual';
console.log(`💳 Payout mode: ${PAYOUT_MODE}`);

app.use('/api', (req, res, next) => {
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

if (!process.env.FIREBASE_ADMIN_SDK) {
    console.error('❌ FIREBASE_ADMIN_SDK environment variable is not set');
    process.exit(1);
}
const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_ADMIN_SDK, 'base64').toString('utf8')
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://kampusride.firebaseio.com"
});

const db = admin.firestore();

console.log('✅ Firebase Admin SDK initialized for FCM notifications');

async function sendFCMNotification(fcmToken, title, body, data = {}) {
    if (!fcmToken) {
        console.warn('No push token provided');
        return { success: false, error: 'No push token' };
    }

    const message = {
        token: fcmToken,
        notification: {
            title: title,
            body: body,
        },
        data: {
            ...data,
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

    const maxRetries = 2;
    const initialDelay = 500;
    const maxDelay = 4000;
    const backoffMultiplier = 2;
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

            if (error.message === 'FCM_SEND_TIMEOUT') {
                console.warn('⚠️ FCM send timed out — not retrying to avoid duplicate delivery');
                return { success: false, error: 'timeout', message: 'Send timed out; message may have been delivered' };
            }

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

app.post('/api/notifications/send', async (req, res) => {
    try {
        const { userId, role, title, body, data } = req.body;

        if (!userId || !role || !title || !body) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userId, role, title, body'
            });
        }

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

app.post('/api/notifications/notify-drivers', async (req, res) => {
    try {
        const { rideId, customerName, pickupLocation, destination } = req.body;

        if (!rideId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: rideId'
            });
        }

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

async function verifyFirebaseToken(req) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return null;
    try {
        return await admin.auth().verifyIdToken(auth.slice(7));
    } catch {
        return null;
    }
}

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

function normalizeNigerianPhone(phone) {
    const digits = String(phone).replace(/\D/g, '');
    if (digits.startsWith('234') && digits.length === 13) return '0' + digits.slice(3);
    if (/^0[789]\d{9}$/.test(digits)) return digits;
    return null;
}

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

const driverEmailRateLimit = new Map();
const DRIVER_EMAIL_MAX_ATTEMPTS = 5;
const DRIVER_EMAIL_WINDOW_MS = 15 * 60 * 1000;

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

    driverEmailRateLimit.set(phone, { attempts: 1, resetAt: now + DRIVER_EMAIL_WINDOW_MS });
    return { blocked: false };
}

setInterval(() => {
    const now = Date.now();
    for (const [key, val] of driverEmailRateLimit) {
        if (now >= val.resetAt) driverEmailRateLimit.delete(key);
    }
}, 30 * 60 * 1000);

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

app.post('/api/auth/check-phone', async (req, res) => {
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

app.post('/api/wallet/webhook', async (req, res) => {
    const webhookSecret = process.env.FLUTTERWAVE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error('❌ FLUTTERWAVE_WEBHOOK_SECRET is not set — rejecting webhook');
        return res.sendStatus(500);
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

    if (!txRef.startsWith('krides_topup_')) {
        console.log(`ℹ️ Ignoring unrelated tx_ref: ${txRef}`);
        return res.sendStatus(200);
    }

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
        const txnRef = userRef.collection('walletTransactions').doc(flwTxId);

        await db.runTransaction(async (txn) => {
            const txnSnap = await txn.get(txnRef);
            if (txnSnap.exists) {
                console.log(`ℹ️ Webhook already processed: flwTxId=${flwTxId}`);
                return;
            }

            const userSnap = await txn.get(userRef);
            if (!userSnap.exists) {
                throw new Error(`User not found: ${userId}`);
            }

            txn.update(userRef, {
                walletBalance: admin.firestore.FieldValue.increment(amount),
            });

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

        res.sendStatus(200);

        db.collection('orphanedTopups').doc(flwTxId).delete().catch(() => {});

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
        res.sendStatus(500);

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
                return;
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

        db.collection('orphanedTopups').doc(flwTxId).delete().catch(() => {});

        return res.json({ success: true, credited: true, amount });
    } catch (error) {
        console.error('❌ verify-topup error:', error);
        return res.status(500).json({ error: 'Could not verify payment. Please try again.' });
    }
});

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

            txn.update(userRef, {
                walletBalance: admin.firestore.FieldValue.increment(-amount),
            });

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


app.post('/api/payments/complete-ride', async (req, res) => {
    const { idToken, rideId } = req.body;

    if (!idToken || !rideId) {
        return res.status(400).json({ error: 'idToken and rideId are required' });
    }

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

        await rideRef.update({
            status: 'completed',
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`✅ Ride ${rideId} marked as completed by driver ${driverId}`);

        const totalAmount = Number(ride.amount) || 0;
        const passengers = Number(ride.numberOfPassengers) || 1;
        const pricing = await getPricingConfig();
        const platformFee = passengers >= pricing.groupThreshold ? pricing.platformFeeGroup : pricing.platformFeeStandard;
        const driverEarnings = Math.max(totalAmount - platformFee, 0);

        if (totalAmount <= 0) {
            return res.json({ success: true, payout: null, reason: 'no_amount' });
        }

        const driverSnap = await db.collection('drivers').doc(driverId).get();
        const driver = driverSnap.exists ? driverSnap.data() : null;

        if (!driver?.bankCode || !driver?.accountNumber) {
            console.warn(`⚠️ Driver ${driverId} has no bank details — skipping payout`);
            await rideRef.update({
                payoutStatus: 'awaiting_bank_details',
                payoutAmount: driverEarnings,
            });
            return res.json({ success: true, payout: null, reason: 'no_bank_details' });
        }

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

        const reference = `krides_payout_${rideId}`;
        console.log(`💸 Transferring ₦${driverEarnings} to driver ${driverId} (${driver.accountNumber})`);

        try {
            await transferToDriver(driver, driverEarnings, reference, `KRides ride payment - ${rideId.slice(0, 8)}`);
            console.log(`✅ Payout initiated for driver ${driverId}: ₦${driverEarnings}`);

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

        if (ride.refundProcessing !== true && ride.status !== 'cancelled') {
            return res.status(400).json({ error: `Cannot refund ride with status: ${ride.status}` });
        }

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
        const rideSnap = await db.collection('rides').doc(rideId).get();
        if (!rideSnap.exists) return res.status(404).json({ error: 'Ride not found' });
        const ride = rideSnap.data();

        if (ride.customerId !== customerId) {
            return res.status(403).json({ error: 'This ride does not belong to you' });
        }
        if (!ride.driverId) {
            return res.status(400).json({ error: 'No driver on this ride' });
        }

        const existing = await db.collection('driverReports')
            .where('customerId', '==', customerId)
            .where('rideId', '==', rideId)
            .limit(1)
            .get();
        if (!existing.empty) {
            return res.json({ success: true, alreadyReported: true });
        }

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

const PENDING_RIDE_TIMEOUT_MS = 10 * 60 * 1000;
const PENDING_RIDE_SWEEP_INTERVAL_MS = 2 * 60 * 1000;

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

const REFUND_RETRY_MAX_ATTEMPTS = 3;
const REFUND_RETRY_SWEEP_INTERVAL_MS = 10 * 60 * 1000;
const REFUND_RETRY_MIN_AGE_MS = 5 * 60 * 1000;

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

const PAYOUT_RETRY_MAX_ATTEMPTS = 3;
const PAYOUT_RETRY_SWEEP_INTERVAL_MS = 10 * 60 * 1000;
const PAYOUT_RETRY_MIN_AGE_MS = 5 * 60 * 1000;

async function retryFailedPayout(rideDoc) {
    const rideRef = rideDoc.ref;
    const ride = rideDoc.data();
    const attempts = ride.payoutRetryCount || 0;

    if (attempts >= PAYOUT_RETRY_MAX_ATTEMPTS) {
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


app.post('/admin-api/login', (req, res) => {
    const { password } = req.body || {};
    if (password !== ADMIN_API_KEY) {
        return res.status(401).json({ error: 'Incorrect password' });
    }
    res.json({ success: true });
});

const PAYOUTS_PAID_HISTORY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

app.get('/admin-api/payouts/overview', async (req, res) => {
    try {
        const paidSince = admin.firestore.Timestamp.fromMillis(Date.now() - PAYOUTS_PAID_HISTORY_WINDOW_MS);

        const [owedSnap, paidSnap, driversSnap] = await Promise.all([
            db.collection('rides')
                .where('payoutStatus', 'in', ['pending_manual', 'failed', 'awaiting_bank_details', 'needs_review'])
                .get(),
            db.collection('rides')
                .where('payoutStatus', '==', 'paid_manually')
                .where('payoutPaidAt', '>=', paidSince)
                .get(),
            db.collection('drivers').limit(1000).get(),
        ]);

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

        drivers.sort((a, b) => b.toBePaid - a.toBePaid);

        res.json({ success: true, drivers });
    } catch (error) {
        console.error('❌ admin payouts/overview error:', error);
        res.status(500).json({ error: 'Could not load payouts overview' });
    }
});

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
            if (txnSnap.exists) return;

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

async function sendDriverSetPasswordEmail(driverName, driverEmail) {
    const resetLink = await admin.auth().generatePasswordResetLink(driverEmail);
    return sendDriverWelcomeEmail({ driverName, driverEmail, resetLink });
}

app.get('/admin-api/pricing', async (req, res) => {
    try {
        const pricing = await getPricingConfig();
        res.json({ success: true, pricing });
    } catch (error) {
        console.error('❌ admin pricing error:', error);
        res.status(500).json({ error: 'Could not load pricing' });
    }
});

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

app.get('/admin-api/drivers', async (req, res) => {
    try {
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

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'KRides Notification Server' });
});

app.listen(PORT, () => {
    console.log(`🚀 Notification server running on port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
});

