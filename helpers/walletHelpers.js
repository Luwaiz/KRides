import axios from 'axios';
import { FIREBASE_AUTH } from '../firebaseConfig';
import { NOTIFICATION_API_KEY } from '@env';

const SERVER_URL = 'https://krides.onrender.com/api';

const api = axios.create({
    headers: { 'x-api-key': NOTIFICATION_API_KEY || '' },
    timeout: 15000,
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

export const createTopupAccount = async (userId, email, name, amount) => {
    const response = await api.post(`${SERVER_URL}/wallet/create-topup-account`, {
        userId,
        email,
        name,
        amount,
    });
    return response.data;
};

export const verifyTopup = async (txRef) => {
    const user = FIREBASE_AUTH.currentUser;
    if (!user) throw new Error('Not authenticated');

    const idToken = await user.getIdToken();

    const response = await api.post(`${SERVER_URL}/wallet/verify-topup`, { idToken, txRef });
    return response.data;
};

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
