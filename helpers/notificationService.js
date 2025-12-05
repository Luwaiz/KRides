import axios from 'axios';

// Notification server URL from environment variables
// Falls back to Render URL if not set
const NOTIFICATION_SERVER_URL = process.env.NOTIFICATION_SERVER_URL || 'https://krides.onrender.com/api/notifications';

// Increased timeout for Render cold starts (free tier spins down after 15 min)
const REQUEST_TIMEOUT = 15000; // 15 seconds

/**
 * Helper function to make API request with retry logic
 * Handles Render's cold start delays on free tier
 */
async function makeRequestWithRetry(url, data, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await axios.post(url, data, {
                timeout: REQUEST_TIMEOUT,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            return response;
        } catch (error) {
            const isLastAttempt = attempt === maxRetries;

            // Log detailed error info
            if (error.code === 'ECONNABORTED') {
                console.warn(`⏱️ Request timeout (attempt ${attempt}/${maxRetries})`);
            } else if (error.response) {
                console.warn(`❌ Server error ${error.response.status} (attempt ${attempt}/${maxRetries})`);
            } else if (error.request) {
                console.warn(`🌐 Network error - no response received (attempt ${attempt}/${maxRetries})`);
            } else {
                console.warn(`❌ Request setup error: ${error.message} (attempt ${attempt}/${maxRetries})`);
            }

            if (isLastAttempt) {
                throw error;
            }

            // Wait before retry (exponential backoff)
            const delay = attempt * 2000; // 2s, 4s, etc.
            console.log(`⏳ Retrying in ${delay / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

/**
 * Send ride booked notification with payment confirmation
 * @param {string} customerId - Customer user ID
 * @param {object} rideData - Ride data object
 */
export async function notifyRideBooked(customerId, rideData) {
    try {
        console.log('📤 Sending ride booked notification...');

        const response = await makeRequestWithRetry(`${NOTIFICATION_SERVER_URL}/ride-booked`, {
            customerId,
            rideId: rideData.id || rideData.rideId,
            amount: rideData.price || rideData.amount,
            pickupLocation: rideData.pickupLocation || rideData.pickup,
            destination: rideData.destination || rideData.dest,
        });

        console.log('✅ Ride booked notification sent:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Failed to send ride booked notification:', error.message);
        if (error.response) {
            console.error('   Server response:', error.response.data);
        }
        // Don't throw - notification failure shouldn't block ride booking
        return null;
    }
}

/**
 * Send ride accepted notification
 * @param {string} customerId - Customer user ID
 * @param {string} rideId - Ride ID
 * @param {object} driverData - Driver data object
 */
export async function notifyRideAccepted(customerId, rideId, driverData) {
    try {
        console.log('📤 Sending ride accepted notification...');

        const response = await makeRequestWithRetry(`${NOTIFICATION_SERVER_URL}/ride-accepted`, {
            customerId,
            rideId,
            driverName: driverData.name || driverData.fullname || 'Your driver',
            driverPhone: driverData.phone || '',
        });

        console.log('✅ Ride accepted notification sent:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Failed to send ride accepted notification:', error.message);
        return null;
    }
}

/**
 * Send driver arrived notification
 * @param {string} customerId - Customer user ID
 * @param {string} rideId - Ride ID
 * @param {string} driverName - Driver name
 */
export async function notifyDriverArrived(customerId, rideId, driverName) {
    try {
        console.log('📤 Sending driver arrived notification...');

        const response = await makeRequestWithRetry(`${NOTIFICATION_SERVER_URL}/driver-arrived`, {
            customerId,
            rideId,
            driverName: driverName || 'Your driver',
        });

        console.log('✅ Driver arrived notification sent:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Failed to send driver arrived notification:', error.message);
        return null;
    }
}

/**
 * Send ride started notification
 * @param {string} customerId - Customer user ID
 * @param {string} rideId - Ride ID
 * @param {string} destination - Destination location
 */
export async function notifyRideStarted(customerId, rideId, destination) {
    try {
        console.log('📤 Sending ride started notification...');

        const response = await makeRequestWithRetry(`${NOTIFICATION_SERVER_URL}/ride-started`, {
            customerId,
            rideId,
            destination: destination || 'your destination',
        });

        console.log('✅ Ride started notification sent:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Failed to send ride started notification:', error.message);
        return null;
    }
}

/**
 * Send ride completed notification
 * @param {string} customerId - Customer user ID
 * @param {string} rideId - Ride ID
 * @param {number} amount - Ride amount
 */
export async function notifyRideCompleted(customerId, rideId, amount) {
    try {
        console.log('📤 Sending ride completed notification...');

        const response = await makeRequestWithRetry(`${NOTIFICATION_SERVER_URL}/ride-completed`, {
            customerId,
            rideId,
            amount,
        });

        console.log('✅ Ride completed notification sent:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Failed to send ride completed notification:', error.message);
        return null;
    }
}

/**
 * Send ride cancelled notification with refund confirmation
 * @param {string} customerId - Customer user ID
 * @param {string} rideId - Ride ID
 * @param {number} refundAmount - Refund amount
 * @param {string} reason - Cancellation reason
 */
export async function notifyRideCancelled(customerId, rideId, refundAmount, reason) {
    try {
        console.log('📤 Sending ride cancelled notification...');

        const response = await makeRequestWithRetry(`${NOTIFICATION_SERVER_URL}/ride-cancelled`, {
            customerId,
            rideId,
            refundAmount,
            reason: reason || 'Ride cancelled',
        });

        console.log('✅ Ride cancelled notification sent:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Failed to send ride cancelled notification:', error.message);
        return null;
    }
}

/**
 * Send custom notification (admin use)
 * @param {string} userId - User ID
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Custom data
 */
export async function sendCustomNotification(userId, title, body, data = {}) {
    try {
        console.log('📤 Sending custom notification...');

        const response = await makeRequestWithRetry(`${NOTIFICATION_SERVER_URL}/send-custom`, {
            userId,
            title,
            body,
            data,
        });

        console.log('✅ Custom notification sent:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Failed to send custom notification:', error.message);
        return null;
    }
}

// ==================== DRIVER NOTIFICATIONS ====================

/**
 * Notify all available drivers about a new ride request
 * @param {string} rideId - Ride ID
 * @param {string} pickupLocation - Pickup location
 * @param {string} destination - Destination
 * @param {number} amount - Ride amount (optional)
 * @param {string} customerName - Customer name (optional)
 */
export async function notifyNewRideRequest(rideId, pickupLocation, destination, amount = null, customerName = null) {
    try {
        console.log('📤 Sending new ride request notification to all drivers...');

        const response = await makeRequestWithRetry(`${NOTIFICATION_SERVER_URL}/new-ride-request`, {
            rideId,
            pickupLocation,
            destination,
            amount,
            customerName,
        });

        console.log('✅ New ride request notification sent:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Failed to send new ride request notification:', error.message);
        if (error.response) {
            console.error('   Server response:', error.response.data);
        }
        // Don't throw - notification failure shouldn't block ride booking
        return null;
    }
}

/**
 * Notify driver that customer cancelled the ride
 * @param {string} driverId - Driver user ID
 * @param {string} rideId - Ride ID
 * @param {string} pickupLocation - Pickup location (optional)
 * @param {string} destination - Destination (optional)
 * @param {string} cancellationReason - Reason for cancellation (optional)
 */
export async function notifyDriverRideCancelled(driverId, rideId, pickupLocation = null, destination = null, cancellationReason = null) {
    try {
        console.log('📤 Sending ride cancellation notification to driver...');

        const response = await makeRequestWithRetry(`${NOTIFICATION_SERVER_URL}/ride-cancelled-by-customer`, {
            driverId,
            rideId,
            pickupLocation,
            destination,
            cancellationReason,
        });

        console.log('✅ Ride cancellation notification sent to driver:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Failed to send ride cancellation notification to driver:', error.message);
        if (error.response) {
            console.error('   Server response:', error.response.data);
        }
        return null;
    }
}

/**
 * Notify driver about payment received for completed ride
 * @param {string} driverId - Driver user ID
 * @param {string} rideId - Ride ID
 * @param {number} amount - Total ride amount
 * @param {number} netAmount - Driver's net earnings (after commission)
 * @param {string} rideDate - Date of the ride (optional)
 */
export async function notifyDriverPaymentReceived(driverId, rideId, amount, netAmount, rideDate = null) {
    try {
        console.log('📤 Sending payment received notification to driver...');

        const response = await makeRequestWithRetry(`${NOTIFICATION_SERVER_URL}/payment-received`, {
            driverId,
            rideId,
            amount,
            netAmount,
            rideDate,
        });

        console.log('✅ Payment received notification sent to driver:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Failed to send payment received notification to driver:', error.message);
        if (error.response) {
            console.error('   Server response:', error.response.data);
        }
        return null;
    }
}
