import axios from 'axios';
import { FIREBASE_AUTH } from '../firebaseConfig';
import { NOTIFICATION_API_KEY } from '@env';

const SERVER_URL = 'https://krides.onrender.com/api';

const api = axios.create({
    headers: { 'x-api-key': NOTIFICATION_API_KEY || '' },
    timeout: 15000,
});

/**
 * Fetches (or creates) the permanent virtual account for a customer.
 * The server returns cached details if the account already exists.
 */
export const createOrGetVirtualAccount = async (userId, email, name) => {
    const response = await api.post(`${SERVER_URL}/wallet/create-virtual-account`, {
        userId,
        email,
        name,
    });
    return response.data;
};

/**
 * Pays for a ride using the customer's wallet balance.
 * The server verifies the Firebase ID token, checks the balance, and
 * atomically deducts it while creating the ride — all in one transaction.
 *
 * @param {object} rideData - { customerName, customerPhone, pickupLocation,
 *                             pickupCoords, destination, destinationCoords,
 *                             numberOfPassengers, amount }
 * @returns {{ success: true, rideId: string }}
 * @throws On insufficient balance the error has shape { error: 'insufficient_balance', balance, shortfall }
 */
export const payWithWallet = async (rideData) => {
    const user = FIREBASE_AUTH.currentUser;
    if (!user) throw new Error('Not authenticated');

    const idToken = await user.getIdToken();

    const response = await api.post(`${SERVER_URL}/wallet/pay-ride`, {
        idToken,
        rideData,
    });
    return response.data;
};
