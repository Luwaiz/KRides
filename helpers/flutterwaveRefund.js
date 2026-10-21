import { NOTIFICATION_API_KEY } from "@env";
import { FIREBASE_AUTH } from "../firebaseConfig";

const PAYMENTS_SERVER_URL = 'https://krides.onrender.com/api/payments';
const FETCH_TIMEOUT_MS = 10000;

function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// rideId authorizes the caller server-side (that ride's customer OR its
// assigned driver — see POST /api/payments/refund) and, when given, the
// server refunds that ride's own stored transactionId rather than trusting
// whatever's passed here. Omit it only for the orphaned-charge bootstrap
// case, where no ride document exists yet to check ownership against.
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
