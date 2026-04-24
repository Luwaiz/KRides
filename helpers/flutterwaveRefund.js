// Refund calls go through our server so the Flutterwave secret key
// never touches the client bundle.
const PAYMENTS_SERVER_URL = 'https://krides.onrender.com/api/payments';

/**
 * Process refund via server → Flutterwave
 * @param {string} transactionId - Flutterwave transaction ID
 * @param {number|null} amount - Amount to refund (null = full refund)
 * @param {string} comments - Reason for refund
 */
export const processRefund = async (transactionId, amount = null, comments = 'Ride cancelled by customer') => {
    console.log('💰 Processing refund for transaction:', transactionId);

    const response = await fetch(`${PAYMENTS_SERVER_URL}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

    const response = await fetch(`${PAYMENTS_SERVER_URL}/refund/${refundId}`, {
        headers: { 'Content-Type': 'application/json' },
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to check refund status');
    }

    return { success: true, status: result.status, data: result.data };
};
