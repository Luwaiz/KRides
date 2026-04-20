import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

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
 * Register for push notifications and get FCM Token
 * @returns {Promise<string|null>} FCM Token or null if failed
 */
export async function registerForPushNotificationsAsync() {
    let token = null;

    // Configure Android notification channel
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
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
            console.warn('⚠️ Error getting FCM token (non-critical):', error);
        }
    } else {
        console.log('⚠️ Must use physical device for push notifications');
    }

    return token;
}

/**
 * Send a push notification via Expo Push API
 * @param {string} expoPushToken - Recipient's Expo Push Token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Optional data payload
 * @returns {Promise<object|null>} Response from Expo Push API
 */
export async function sendPushNotification(expoPushToken, title, body, data = {}) {
    if (!expoPushToken) {
        console.log('❌ No push token provided');
        return null;
    }

    const message = {
        to: expoPushToken,
        sound: 'default',
        title,
        body,
        data,
    };

    try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });

        const result = await response.json();
        console.log('✅ Notification sent:', result);
        return result;
    } catch (error) {
        console.warn('⚠️ Error sending notification:', error);
        return null;
    }
}

/**
 * Send notification to multiple tokens
 * @param {string[]} tokens - Array of Expo Push Tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Optional data payload
 */
export async function sendBulkNotifications(tokens, title, body, data = {}) {
    const messages = tokens.map(token => ({
        to: token,
        sound: 'default',
        title,
        body,
        data,
    }));

    try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages),
        });

        const result = await response.json();
        console.log(`✅ Bulk notifications sent to ${tokens.length} recipients`);
        return result;
    } catch (error) {
        console.warn('⚠️ Error sending bulk notifications:', error);
        return null;
    }
}

/**
 * Schedule a local notification
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {number} seconds - Seconds to wait before showing
 * @param {object} data - Optional data payload
 */
export async function scheduleLocalNotification(title, body, seconds, data = {}) {
    await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            data,
            sound: true,
        },
        trigger: { seconds },
    });
    console.log(`⏰ Local notification scheduled in ${seconds}s`);
}

/**
 * Add notification received listener
 * @param {Function} callback - Called when notification is received
 * @returns {Subscription} Subscription object
 */
export function addNotificationReceivedListener(callback) {
    return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add notification response listener (when user taps notification)
 * @param {Function} callback - Called when user interacts with notification
 * @returns {Subscription} Subscription object
 */
export function addNotificationResponseListener(callback) {
    return Notifications.addNotificationResponseReceivedListener(callback);
}
