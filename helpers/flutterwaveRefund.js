import axios from 'axios';
import { FLUTTERWAVE_SECRET_KEY } from '@env';

/**
 * Process refund via Flutterwave API
 * @param {string} transactionId - Flutterwave transaction ID
 * @param {number} amount - Amount to refund (optional, defaults to full refund)
 * @param {string} comments - Reason for refund
 * @returns {Promise<Object>} Refund response
 */
export const processRefund = async (transactionId, amount = null, comments = "Ride cancelled by customer") => {
    try {
        console.log("💰 Processing refund for transaction:", transactionId);
        console.log("   Amount:", amount || "Full refund");
        console.log("   Reason:", comments);

        const url = `https://api.flutterwave.com/v3/transactions/${transactionId}/refund`;

        const payload = {
            ...(amount && { amount }), // Include amount only if specified (partial refund)
            comments,
        };

        console.log("📤 Sending refund request to Flutterwave...");

        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY || 'FLWSECK_TEST-f3c5c2ad9a10329d839b64ba46d167bd-X'}`,
                'Content-Type': 'application/json',
            },
        });

        console.log("✅ Refund response:", response.data);

        if (response.data.status === "success") {
            return {
                success: true,
                refundId: response.data.data.id,
                status: response.data.data.status,
                message: response.data.message,
                data: response.data.data,
            };
        } else {
            throw new Error(response.data.message || "Refund failed");
        }
    } catch (error) {
        console.error("❌ Refund error:", error.response?.data || error.message);

        // Extract meaningful error message
        const errorMessage = error.response?.data?.message
            || error.response?.data?.error
            || error.message
            || "Failed to process refund";

        throw new Error(errorMessage);
    }
};

/**
 * Check refund status
 * @param {string} refundId - Flutterwave refund ID
 * @returns {Promise<Object>} Refund status
 */
export const checkRefundStatus = async (refundId) => {
    try {
        console.log("🔍 Checking refund status for ID:", refundId);

        const url = `https://api.flutterwave.com/v3/refunds/${refundId}`;

        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY || 'FLWSECK_TEST-f3c5c2ad9a10329d839b64ba46d167bd-X'}`,
                'Content-Type': 'application/json',
            },
        });

        console.log("✅ Refund status:", response.data.data.status);

        return {
            success: true,
            status: response.data.data.status,
            data: response.data.data,
        };
    } catch (error) {
        console.error("❌ Error checking refund status:", error.response?.data || error.message);
        throw new Error(error.response?.data?.message || "Failed to check refund status");
    }
};
