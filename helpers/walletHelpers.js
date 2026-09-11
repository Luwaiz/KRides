import axios from 'axios';
import { FIREBASE_AUTH } from '../firebaseConfig';
import { NOTIFICATION_API_KEY } from '@env';

const SERVER_URL = 'https://krides.onrender.com/api';

const api = axios.create({
    headers: { 'x-api-key': NOTIFICATION_API_KEY || '' },
    timeout: 15000,
});

// Attach a fresh Firebase ID token to every outgoing request.
api.interceptors.request.use(async (config) => {
    const user = FIREBASE_AUTH.currentUser;
    if (user) {
        try {
            const token = await user.getIdToken();
            config.headers['Authorization'] = `Bearer ${token}`;
        } catch {
            // Non-fatal
        }
    }
    return config;
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
 * Backs the Wallet screen's "I've Sent The Money" button. Asks the server to
 * check this top-up's reference directly against Flutterwave and credit the
 * wallet immediately if it already succeeded there — instead of the customer
 * just waiting on the webhook (which the live Firestore listener on the
 * Wallet screen will also pick up automatically the moment it lands).
 *
 * @param {string} txRef - the tx_ref returned by createTopupAccount
 * @returns {{ success: true, credited: boolean, amount?: number, status?: string }}
 */
export const verifyTopup = async (txRef) => {
    const user = FIREBASE_AUTH.currentUser;
    if (!user) throw new Error('Not authenticated');

    const idToken = await user.getIdToken();

    const response = await api.post(`${SERVER_URL}/wallet/verify-topup`, { idToken, txRef });
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
