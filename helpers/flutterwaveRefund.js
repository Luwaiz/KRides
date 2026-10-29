import { NOTIFICATION_API_KEY } from "@env";
import { FIREBASE_AUTH } from "../firebaseConfig";

const SERVER_URL = 'https://krides.onrender.com/api';
const PAYMENTS_SERVER_URL = `${SERVER_URL}/payments`;
const FETCH_TIMEOUT_MS = 10000;
const BOOKING_TIMEOUT_MS = 30000;

function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function postWithAuth(url, body, timeoutMs) {
    const user = FIREBASE_AUTH.currentUser;
    if (!user) throw new Error('Not authenticated — please log in again');
    const idToken = await user.getIdToken();

    const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': NOTIFICATION_API_KEY || '',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(body),
    }, timeoutMs);

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
        const error = new Error(result.error || `Request failed (${response.status})`);
        error.status = response.status;
        error.data = result;
        throw error;
    }
    return result;
}

// The server verifies the Flutterwave charge, computes the fare itself, and creates
// the ride in one step — the app can no longer create paid rides directly.
export const createCardRide = async (transactionId, ride) => {
    const result = await postWithAuth(`${SERVER_URL}/rides/create`, { transactionId, ride }, BOOKING_TIMEOUT_MS);
    return { rideId: result.rideId, amount: result.amount };
};

export const cancelRideOnServer = async (rideId, reason = '') => {
    return postWithAuth(`${SERVER_URL}/rides/cancel`, { rideId, reason }, BOOKING_TIMEOUT_MS);
};

export const processRefund = async (transactionId, amount = null, comments = 'Ride cancelled', rideId = null) => {
    console.log('💰 Processing refund for transaction:', transactionId, rideId ? `(ride ${rideId})` : '');

    const user = FIREBASE_AUTH.currentUser;
    if (!user) throw new Error('Not authenticated — cannot process refund');
    const idToken = await user.getIdToken();

    const response = await fetchWithTimeout(`${PAYMENTS_SERVER_URL}/refund`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': NOTIFICATION_API_KEY || '',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ transactionId, amount, comments, rideId }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
        const error = new Error(result.error || 'Refund failed');
        error.status = response.status;
        throw error;
    }

    console.log('✅ Refund processed:', result.refundId);
    return {
        success: true,
        refundId: result.refundId,
        status: result.status,
        message: result.message,
        data: result.data,
    };
};

export const checkRefundStatus = async (refundId, rideId) => {
    console.log('🔍 Checking refund status for:', refundId);

    const user = FIREBASE_AUTH.currentUser;
    if (!user) throw new Error('Not authenticated — cannot check refund status');
    const idToken = await user.getIdToken();

    const rideQuery = rideId ? `?rideId=${encodeURIComponent(rideId)}` : '';
    const response = await fetchWithTimeout(`${PAYMENTS_SERVER_URL}/refund/${encodeURIComponent(refundId)}${rideQuery}`, {
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': NOTIFICATION_API_KEY || '',
            'Authorization': `Bearer ${idToken}`,
        },
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to check refund status');
    }

    return { success: true, status: result.status, data: result.data };
};
