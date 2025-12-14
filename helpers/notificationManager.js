import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { FIREBASE_DB } from '../firebaseConfig';

/**
 * Configure notification handler for foreground notifications
 */
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

/**
 * Notification Manager - Centralized notification handling
 */
class NotificationManager {
    constructor() {
        this.notificationListener = null;
        this.responseListener = null;
        this.currentToken = null;
    }

    /**
     * Initialize notifications for authenticated user
     * @param {string} uid - User ID
     * @param {string} role - User role ('customer' or 'driver')
     */
    async initialize(uid, role) {
        if (!uid || !role) {
            console.warn('⚠️ NotificationManager: uid and role required');
            return;
        }

        console.log(`🔔 Initializing notifications for ${role}: ${uid}`);

        try {
            // Register for push notifications and get token
            const token = await this.registerForPushNotifications();

            if (token) {
                this.currentToken = token;
                // Save token to Firestore
                await this.saveTokenToFirestore(uid, token, role);
            }

            // Set up notification listeners
            this.setupListeners();

        } catch (error) {
            console.error('❌ Error initializing notifications:', error);
        }
    }

    /**
     * Register for push notifications and get FCM Token
     * @returns {Promise<string|null>} FCM Token or null if failed
     */
    async registerForPushNotifications() {
        let token = null;

        // Configure Android notification channel
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
                sound: 'default',
                enableVibrate: true,
            });
        }

        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('❌ Permission not granted for push notifications');
                return null;
            }

            try {
                // Get FCM token directly (instead of Expo push token)
                const fcmTokenData = await Notifications.getDevicePushTokenAsync();
                token = fcmTokenData.data;
                console.log('✅ FCM token obtained:', token.substring(0, 30) + '...');
            } catch (error) {
                console.error('❌ Error getting FCM token:', error);
            }
        } else {
            console.log('⚠️ Must use physical device for push notifications');
        }

        return token;
    }

    /**
     * Save push token to Firestore
     * @param {string} uid - User ID
     * @param {string} token - FCM Token
     * @param {string} role - User role ('customer' or 'driver')
     */
    async saveTokenToFirestore(uid, token, role) {
        if (!uid || !token) {
            console.warn('⚠️ Cannot save token: missing uid or token');
            return;
        }

        try {
            const collectionName = role === 'driver' ? 'drivers' : 'users';
            const userRef = doc(FIREBASE_DB, collectionName, uid);

            // Check if document exists
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                // Update existing document
                await updateDoc(userRef, {
                    pushToken: token,
                    pushTokenUpdatedAt: new Date().toISOString(),
                });
                console.log(`✅ Push token saved to ${collectionName}/${uid}`);
            } else {
                // Create document if it doesn't exist (shouldn't happen, but safety check)
                await setDoc(userRef, {
                    uid,
                    pushToken: token,
                    pushTokenUpdatedAt: new Date().toISOString(),
                }, { merge: true });
                console.log(`✅ Push token saved to new ${collectionName}/${uid}`);
            }
        } catch (error) {
            console.error('❌ Error saving push token to Firestore:', error);
        }
    }

    /**
     * Set up notification listeners
     */
    setupListeners() {
        // Remove existing listeners if any
        this.removeListeners();

        // Listener for notifications received while app is in foreground
        this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
            console.log('🔔 Notification received (foreground):', notification);
            // You can add custom handling here (e.g., show in-app banner)
        });

        // Listener for when user taps on notification
        this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
            console.log('👆 Notification tapped:', response);
            const data = response.notification.request.content.data;

            // Handle notification tap based on type
            if (data?.type === 'ride_booked' || data?.type === 'ride_accepted' || data?.type === 'ride_completed') {
                // You can navigate to specific screen here
                // Example: navigation.navigate('RideDetails', { rideId: data.rideId });
                console.log('Navigate to ride:', data.rideId);
            }
        });

        console.log('✅ Notification listeners set up');
    }

    /**
     * Remove notification listeners
     */
    removeListeners() {
        if (this.notificationListener) {
            this.notificationListener.remove();
            this.notificationListener = null;
        }
        if (this.responseListener) {
            this.responseListener.remove();
            this.responseListener = null;
        }
    }

    /**
     * Clean up on logout
     * @param {string} uid - User ID
     * @param {string} role - User role
     */
    async cleanup(uid, role) {
        console.log('🧹 Cleaning up notifications');

        // Remove token from Firestore
        if (uid && role) {
            try {
                const collectionName = role === 'driver' ? 'drivers' : 'users';
                const userRef = doc(FIREBASE_DB, collectionName, uid);
                await updateDoc(userRef, {
                    pushToken: null,
                });
                console.log('✅ Push token removed from Firestore');
            } catch (error) {
                // Silently handle permission errors during logout
                // The token will be overwritten on next login anyway
                if (error.code === 'permission-denied') {
                    console.log('ℹ️ Could not remove push token (permission denied) - will be overwritten on next login');
                } else {
                    console.error('❌ Error removing push token:', error.message);
                }
            }
        }

        // Remove listeners
        this.removeListeners();
        this.currentToken = null;
    }

    /**
     * Get current push token
     */
    getToken() {
        return this.currentToken;
    }
}

// Export singleton instance
const notificationManager = new NotificationManager();
export default notificationManager;
