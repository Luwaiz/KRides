import axios from 'axios';

// Production server (Render.com)
const NOTIFICATION_SERVER_URL = 'https://krides.onrender.com/api/notifications';

// For local testing: Use your computer's IP address (not localhost)
// To find your IP: Run 'ipconfig' on Windows or 'ifconfig' on Mac/Linux
// const NOTIFICATION_SERVER_URL = 'http://172.20.10.3:3001/api/notifications';


/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} Result of the function
 */
async function retryWithBackoff(fn, options = {}) {
    const {
        maxRetries = 3,
        initialDelay = 1000,
        maxDelay = 10000,
        backoffMultiplier = 2,
        onRetry = () => { },
        shouldRetry = () => true,
    } = options;

    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Check if we should retry this error
            if (!shouldRetry(error)) {
                console.log('🚫 Error is not retryable, failing immediately');
                throw error;
            }

            // If this was the last attempt, throw the error
            if (attempt === maxRetries) {
                console.log(`❌ Max retries (${maxRetries}) reached, giving up`);
                throw error;
            }

            // Calculate delay with exponential backoff
            const delay = Math.min(
                initialDelay * Math.pow(backoffMultiplier, attempt),
                maxDelay
            );

            // Call the retry callback
            onRetry(attempt + 1, delay, error);

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

/**
 * Determine if an error should be retried
 * @param {Error} error - The error to check
 * @returns {boolean} True if should retry
 */
function shouldRetryError(error) {
    // Don't retry if it's a client error (4xx)
    if (error.response && error.response.status >= 400 && error.response.status < 500) {
        // Except for 429 (rate limit) and 408 (timeout)
        if (error.response.status === 429 || error.response.status === 408) {
            return true;
        }
        return false;
    }

    // Retry network errors and server errors (5xx)
    return true;
}

/**
 * Send notification when a new ride is created
 * @param {string} rideId - Ride ID
 * @param {string} customerName - Customer name
 * @param {string} pickupLocation - Pickup location address
 * @param {string} destination - Destination address
 */
export async function notifyDriversAboutNewRide(rideId, customerName, pickupLocation, destination) {
    try {
        return await retryWithBackoff(
            async () => {
                const response = await axios.post(`${NOTIFICATION_SERVER_URL}/notify-drivers`, {
                    rideId,
                    customerName,
                    pickupLocation,
                    destination,
                });
                console.log('✅ Drivers notified about new ride:', response.data);
                return response.data;
            },
            {
                maxRetries: 3,
                initialDelay: 1000,
                shouldRetry: shouldRetryError,
                onRetry: (attempt, delay, error) => {
                    console.log(`⚠️ Retry attempt ${attempt}/3 for notifyDriversAboutNewRide after ${delay}ms`);
                    console.log(`   Error: ${error.message}`);
                }
            }
        );
    } catch (error) {
        console.error('❌ Error notifying drivers (all retries failed):', error.message);
        return null;
    }
}

/**
 * Send notification when a ride is accepted
 * @param {string} customerId - Customer ID
 * @param {string} rideId - Ride ID
 * @param {string} driverName - Driver name
 */
export async function notifyCustomerRideAccepted(customerId, rideId, driverName) {
    try {
        return await retryWithBackoff(
            async () => {
                const response = await axios.post(`${NOTIFICATION_SERVER_URL}/ride-accepted`, {
                    customerId,
                    rideId,
                    driverName,
                });
                console.log('✅ Customer notified about ride acceptance:', response.data);
                return response.data;
            },
            {
                maxRetries: 3,
                initialDelay: 1000,
                shouldRetry: shouldRetryError,
                onRetry: (attempt, delay, error) => {
                    console.log(`⚠️ Retry attempt ${attempt}/3 for notifyCustomerRideAccepted after ${delay}ms`);
                    console.log(`   Error: ${error.message}`);
                }
            }
        );
    } catch (error) {
        console.error('❌ Error notifying customer (all retries failed):', error.message);
        return null;
    }
}

/**
 * Send notification when a ride is completed
 * @param {string} customerId - Customer ID
 * @param {string} rideId - Ride ID
 */
export async function notifyCustomerRideCompleted(customerId, rideId) {
    try {
        return await retryWithBackoff(
            async () => {
                const response = await axios.post(`${NOTIFICATION_SERVER_URL}/ride-completed`, {
                    customerId,
                    rideId,
                });
                console.log('✅ Customer notified about ride completion:', response.data);
                return response.data;
            },
            {
                maxRetries: 3,
                initialDelay: 1000,
                shouldRetry: shouldRetryError,
                onRetry: (attempt, delay, error) => {
                    console.log(`⚠️ Retry attempt ${attempt}/3 for notifyCustomerRideCompleted after ${delay}ms`);
                    console.log(`   Error: ${error.message}`);
                }
            }
        );
    } catch (error) {
        console.error('❌ Error notifying customer (all retries failed):', error.message);
        return null;
    }
}

/**
 * Send notification when customer cancels a ride
 * @param {string} driverId - Driver ID
 * @param {string} rideId - Ride ID
 * @param {string} customerName - Customer name
 */
export async function notifyDriverRideCancelled(driverId, rideId, customerName) {
    try {
        return await retryWithBackoff(
            async () => {
                const response = await axios.post(`${NOTIFICATION_SERVER_URL}/send`, {
                    userId: driverId,
                    role: 'driver',
                    title: 'Ride Cancelled ❌',
                    body: `${customerName || 'Customer'} cancelled the ride`,
                    data: {
                        type: 'ride_cancelled',
                        rideId: String(rideId),
                    },
                });
                console.log('✅ Driver notified about ride cancellation:', response.data);
                return response.data;
            },
            {
                maxRetries: 3,
                initialDelay: 1000,
                shouldRetry: shouldRetryError,
                onRetry: (attempt, delay, error) => {
                    console.log(`⚠️ Retry attempt ${attempt}/3 for notifyDriverRideCancelled after ${delay}ms`);
                    console.log(`   Error: ${error.message}`);
                }
            }
        );
    } catch (error) {
        console.error('❌ Error notifying driver (all retries failed):', error.message);
        return null;
    }
}

/**
 * Send custom notification to a user
 * @param {string} userId - User ID
 * @param {string} role - User role ('customer' or 'driver')
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Optional data payload
 */
export async function sendNotificationToUser(userId, role, title, body, data = {}) {
    try {
        return await retryWithBackoff(
            async () => {
                const response = await axios.post(`${NOTIFICATION_SERVER_URL}/send`, {
                    userId,
                    role,
                    title,
                    body,
                    data,
                });
                console.log('✅ Notification sent to user:', response.data);
                return response.data;
            },
            {
                maxRetries: 3,
                initialDelay: 1000,
                shouldRetry: shouldRetryError,
                onRetry: (attempt, delay, error) => {
                    console.log(`⚠️ Retry attempt ${attempt}/3 for sendNotificationToUser after ${delay}ms`);
                    console.log(`   Error: ${error.message}`);
                }
            }
        );
    } catch (error) {
        console.error('❌ Error sending notification (all retries failed):', error.message);
        return null;
    }
}

/**
 * Notify customer that driver has arrived at pickup location
 * @param {string} customerId - Customer's user ID
 * @param {string} driverName - Driver's name
 * @returns {Promise} Response from notification server
 */
export const notifyCustomerDriverArrived = async (customerId, driverName) => {
    console.log('📍 Notifying customer of driver arrival:', { customerId, driverName });

    try {
        return await retryWithBackoff(
            async () => {
                const response = await axios.post(`${NOTIFICATION_SERVER_URL}/notify-driver-arrived`, {
                    customerId,
                    driverName,
                });
                console.log('✅ Customer notified of driver arrival:', response.data);
                return response.data;
            },
            {
                maxRetries: 3,
                initialDelay: 1000,
                shouldRetry: shouldRetryError,
                onRetry: (attempt, delay, error) => {
                    console.log(`⚠️ Retry attempt ${attempt}/3 for notifyCustomerDriverArrived after ${delay}ms`);
                    console.log(`   Error: ${error.message}`);
                }
            }
        );
    } catch (error) {
        console.error('❌ Error notifying customer of arrival (all retries failed):', error.message);
        throw error;
    }
};
