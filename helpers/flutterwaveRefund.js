// Refund calls go through our server so the Flutterwave secret key
// never touches the client bundle.
import { NOTIFICATION_API_KEY } from "@env";
import { FIREBASE_AUTH } from "../firebaseConfig";

const PAYMENTS_SERVER_URL = 'https://krides.onrender.com/api/payments';
const FETCH_TIMEOUT_MS = 10000;

function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/**
 * Process refund via server → Flutterwave
 * @param {string} transactionId - Flutterwave transaction ID
 * @param {number|null} amount - Amount to refund (null = full refund)
 * @param {string} comments - Reason for refund
 */
export const processRefund = async (transactionId, amount = null, comments = 'Ride cancelled by customer') => {
    console.log('💰 Processing refund for transaction:', transactionId);

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
        body: JSON.stringify({ transactionId, amount, comments }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
        throw new Error(result.error || 'Refund failed');
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

/**
 * Check refund status via server → Flutterwave
 * @param {string} refundId - Flutterwave refund ID
 */
export const checkRefundStatus = async (refundId) => {
    console.log('🔍 Checking refund status for:', refundId);

    const user = FIREBASE_AUTH.currentUser;
    if (!user) throw new Error('Not authenticated — cannot check refund status');
    const idToken = await user.getIdToken();

    const response = await fetchWithTimeout(`${PAYMENTS_SERVER_URL}/refund/${refundId}`, {
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
