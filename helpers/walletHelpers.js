import axios from 'axios';
import { FIREBASE_AUTH } from '../firebaseConfig';
import { NOTIFICATION_API_KEY } from '@env';

const SERVER_URL = 'https://krides.onrender.com/api';

const api = axios.create({
    headers: { 'x-api-key': NOTIFICATION_API_KEY || '' },
    timeout: 15000,
});

/**
 * Creates a one-time virtual account for a specific top-up amount.
 * No BVN/NIN required (non-permanent Flutterwave accounts are exempt).
 */
export const createTopupAccount = async (userId, email, name, amount) => {
    const response = await api.post(`${SERVER_URL}/wallet/create-topup-account`, {
        userId,
        email,
        name,
        amount,
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
