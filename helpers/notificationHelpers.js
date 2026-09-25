import axios from 'axios';
import { NOTIFICATION_API_KEY } from '@env';
import { FIREBASE_AUTH } from '../firebaseConfig';

const NOTIFICATION_SERVER_URL = 'https://krides.onrender.com/api/notifications';

const api = axios.create({
    headers: { 'x-api-key': NOTIFICATION_API_KEY || '' },
    timeout: 10000,
});

api.interceptors.request.use(async (config) => {
    const user = FIREBASE_AUTH.currentUser;
    if (user) {
        try {
            const token = await user.getIdToken();
            config.headers['Authorization'] = `Bearer ${token}`;
        } catch {
        }
    }
    return config;
});


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

            if (!shouldRetry(error)) {
                console.log('🚫 Error is not retryable, failing immediately');
                throw error;
            }

            if (attempt === maxRetries) {
                console.log(`❌ Max retries (${maxRetries}) reached, giving up`);
                throw error;
            }

            const delay = Math.min(
                initialDelay * Math.pow(backoffMultiplier, attempt),
                maxDelay
            );

            onRetry(attempt + 1, delay, error);

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

function shouldRetryError(error) {
    if (error.response && error.response.status >= 400 && error.response.status < 500) {
        if (error.response.status === 429 || error.response.status === 408) {
            return true;
        }
        return false;
    }

    return true;
}

export async function notifyDriversAboutNewRide(rideId, customerName, pickupLocation, destination) {
    try {
        return await retryWithBackoff(
            async () => {
                const response = await api.post(`${NOTIFICATION_SERVER_URL}/notify-drivers`, {
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

export async function notifyCustomerRideAccepted(customerId, rideId, driverName) {
    try {
        return await retryWithBackoff(
            async () => {
                const response = await api.post(`${NOTIFICATION_SERVER_URL}/ride-accepted`, {
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

export async function notifyCustomerRideCompleted(customerId, rideId) {
    try {
        return await retryWithBackoff(
            async () => {
                const response = await api.post(`${NOTIFICATION_SERVER_URL}/ride-completed`, {
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

export async function notifyDriverRideCancelled(driverId, rideId, customerName) {
    try {
        return await retryWithBackoff(
            async () => {
                const response = await api.post(`${NOTIFICATION_SERVER_URL}/send`, {
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

export async function sendNotificationToUser(userId, role, title, body, data = {}) {
    try {
        return await retryWithBackoff(
            async () => {
                const response = await api.post(`${NOTIFICATION_SERVER_URL}/send`, {
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

export const notifyCustomerDriverArrived = async (customerId, driverName) => {
    console.log('📍 Notifying customer of driver arrival:', { customerId, driverName });

    try {
        return await retryWithBackoff(
            async () => {
                const response = await api.post(`${NOTIFICATION_SERVER_URL}/notify-driver-arrived`, {
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
