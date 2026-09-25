import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { doc, updateDoc, setDoc, getDoc, deleteField } from 'firebase/firestore';
import { FIREBASE_DB } from '../firebaseConfig';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

class NotificationManager {
    constructor() {
        this.notificationListener = null;
        this.responseListener = null;
        this.currentToken = null;
    }

    async initialize(uid, role) {
        if (!uid || !role) {
            console.warn('⚠️ NotificationManager: uid and role required');
            return;
        }

        console.log(`🔔 Initializing notifications for ${role}: ${uid}`);

        try {
            const token = await this.registerForPushNotifications();

            if (token) {
                this.currentToken = token;
                await this.clearStaleTokenIfNeeded(uid, token, role);
                await this.saveTokenToFirestore(uid, token, role);
            }

            this.setupListeners();

        } catch (error) {
            console.error('❌ Error initializing notifications:', error);
        }
    }

    async registerForPushNotifications() {
        let token = null;

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

    async clearStaleTokenIfNeeded(uid, newToken, role) {
        try {
            const collectionName = role === 'driver' ? 'drivers' : 'users';
            const userRef = doc(FIREBASE_DB, collectionName, uid);
            const snap = await getDoc(userRef);
            if (!snap.exists()) return;
            const data = snap.data();
            const existingToken = data?.fcmToken;
            const updates = {};
            if (existingToken && existingToken !== newToken) {
                updates.fcmToken = null;
            }
            if (data?.fcmTokens !== undefined) {
                updates.fcmTokens = deleteField();
            }
            if (Object.keys(updates).length > 0) {
                await updateDoc(userRef, updates);
                console.log('🔄 Cleared stale token fields');
            }
        } catch (error) {
            console.warn('⚠️ Could not clear stale token:', error.message);
        }
    }

    async saveTokenToFirestore(uid, token, role) {
        if (!uid || !token) {
            console.warn('⚠️ Cannot save token: missing uid or token');
            return;
        }

        try {
            const collectionName = role === 'driver' ? 'drivers' : 'users';
            const userRef = doc(FIREBASE_DB, collectionName, uid);

            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                if (userSnap.data()?.fcmToken === token) {
                    console.log(`✅ FCM token unchanged, skipping write for ${collectionName}/${uid}`);
                    return;
                }
                await updateDoc(userRef, {
                    fcmToken: token,
                    fcmTokenUpdatedAt: new Date().toISOString(),
                });
                console.log(`✅ FCM token saved to ${collectionName}/${uid}`);
            } else {
                await setDoc(userRef, {
                    uid,
                    fcmToken: token,
                    fcmTokenUpdatedAt: new Date().toISOString(),
                }, { merge: true });
                console.log(`✅ FCM token saved to new ${collectionName}/${uid}`);
            }
        } catch (error) {
            console.error('❌ Error saving push token to Firestore:', error);
        }
    }

    setupListeners() {
        this.removeListeners();

        this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
            console.log('🔔 Notification received (foreground):', notification);
        });

        this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
            console.log('👆 Notification tapped:', response);
            const data = response.notification.request.content.data;

            if (data?.type === 'ride_booked' || data?.type === 'ride_accepted' || data?.type === 'ride_completed') {
                console.log('Navigate to ride:', data.rideId);
            }
        });

        console.log('✅ Notification listeners set up');
    }

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

    async cleanup(uid, role) {
        console.log('🧹 Cleaning up notifications');

        if (uid && role) {
            try {
                const collectionName = role === 'driver' ? 'drivers' : 'users';
                const userRef = doc(FIREBASE_DB, collectionName, uid);
                await updateDoc(userRef, {
                    fcmToken: null,
                });
                console.log('✅ FCM token removed from Firestore');
            } catch (error) {
                if (error.code === 'permission-denied') {
                    console.log('ℹ️ Could not remove push token (permission denied) - will be overwritten on next login');
                } else {
                    console.error('❌ Error removing push token:', error.message);
                }
            }
        }

        this.removeListeners();
        this.currentToken = null;
    }

    getToken() {
        return this.currentToken;
    }
}

const notificationManager = new NotificationManager();
export default notificationManager;
