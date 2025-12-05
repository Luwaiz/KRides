import axios from 'axios';

// Notification server URL
// Use your computer's local IP address so devices on the same network can reach it
// Detected IP: 192.168.35.60
const NOTIFICATION_SERVER_URL = __DEV__
    ? 'http://192.168.35.60:3001/api/notifications'
    : 'https://your-production-server.com/api/notifications'; // Update with your production URL

/**
 * Send ride booked notification with payment confirmation
 * @param {string} customerId - Customer user ID
 * @param {object} rideData - Ride data object
 */
export async function notifyRideBooked(customerId, rideData) {
    try {
        console.log('📤 Sending ride booked notification...');

        const response = await axios.post(`${NOTIFICATION_SERVER_URL}/ride-booked`, {
            customerId,
            rideId: rideData.id || rideData.rideId,
            amount: rideData.price || rideData.amount,
            pickupLocation: rideData.pickupLocation || rideData.pickup,
            destination: rideData.destination || rideData.dest,
        }, {
            timeout: 5000, // 5 second timeout
        });

        console.log('✅ Ride booked notification sent:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Failed to send ride booked notification:', error.message);
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

        const response = await axios.post(`${NOTIFICATION_SERVER_URL}/ride-accepted`, {
            customerId,
            rideId,
            driverName: driverData.name || driverData.fullname || 'Your driver',
            driverPhone: driverData.phone || '',
        }, {
            timeout: 5000,
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

        const response = await axios.post(`${NOTIFICATION_SERVER_URL}/driver-arrived`, {
            customerId,
            rideId,
            driverName: driverName || 'Your driver',
        }, {
            timeout: 5000,
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

        const response = await axios.post(`${NOTIFICATION_SERVER_URL}/ride-started`, {
            customerId,
            rideId,
            destination: destination || 'your destination',
        }, {
            timeout: 5000,
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

        const response = await axios.post(`${NOTIFICATION_SERVER_URL}/ride-completed`, {
            customerId,
            rideId,
            amount,
        }, {
            timeout: 5000,
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

        const response = await axios.post(`${NOTIFICATION_SERVER_URL}/ride-cancelled`, {
            customerId,
            rideId,
            refundAmount,
            reason: reason || 'Ride cancelled',
        }, {
            timeout: 5000,
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

        const response = await axios.post(`${NOTIFICATION_SERVER_URL}/send-custom`, {
            userId,
            title,
            body,
            data,
        }, {
            timeout: 5000,
        });

        console.log('✅ Custom notification sent:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Failed to send custom notification:', error.message);
        return null;
    }
}
