import { Platform } from 'react-native';

// Try to import native modules, but provide fallbacks if they're not available
let Device, Notifications, Constants;
let modulesAvailable = false;

try {
    Device = require('expo-device');
    Notifications = require('expo-notifications');
    Constants = require('expo-constants');
    modulesAvailable = true;

    // Configure how notifications behave when the app is in foreground
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        }),
    });
} catch (error) {
    console.log('⚠️ Notification modules not available:', error.message);
    console.log('📱 Push notifications will be disabled until app is rebuilt with native modules');
}

/**
 * Register for Push Notifications and get the token
 * @returns {Promise<string|null>} The Expo Push Token or null if failed
 */
export async function registerForPushNotificationsAsync() {
    if (!modulesAvailable) {
        console.log('⚠️ Notification modules not available - skipping token registration');
        return null;
    }

    let token;

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
            console.log('Failed to get push token for push notification!');
            return null;
        }

        // Get the token
        try {
            const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
            token = (await Notifications.getExpoPushTokenAsync({
                projectId,
            })).data;
            console.log('✅ Push Token:', token);
        } catch (e) {
            console.error('Error getting push token:', e);
        }
    } else {
        console.log('Must use physical device for Push Notifications');
    }

    return token;
}

/**
 * Send a Push Notification to a specific token
 * @param {string} expoPushToken - The recipient's Expo Push Token
 * @param {string} title - Notification Title
 * @param {string} body - Notification Body
 * @param {object} data - Optional data payload
 */
export async function sendPushNotification(expoPushToken, title, body, data = {}) {
    if (!modulesAvailable) {
        console.log('⚠️ Notification modules not available - skipping notification send');
        return null;
    }

    if (!expoPushToken) {
        console.log('❌ No token provided for notification');
        return;
    }

    console.log(`📤 Sending notification to ${expoPushToken}: ${title}`);

    const message = {
        to: expoPushToken,
        sound: 'default',
        title: title,
        body: body,
        data: data,
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
        console.error('❌ Error sending notification:', error);
    }
}

/**
 * Schedule a local notification
 * @param {string} title - Notification Title
 * @param {string} body - Notification Body
 * @param {number} seconds - Seconds to wait before showing
 * @param {object} data - Optional data payload
 */
export async function scheduleLocalNotification(title, body, seconds, data = {}) {
    if (!modulesAvailable) {
        console.log('⚠️ Notification modules not available - skipping local notification');
        return null;
    }

    console.log(`⏰ Scheduling local notification in ${seconds}s: ${title}`);

    await Notifications.scheduleNotificationAsync({
        content: {
            title: title,
            body: body,
            data: data,
            sound: true,
        },
        trigger: { seconds: seconds },
    });
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllScheduledNotifications() {
    if (!modulesAvailable) {
        console.log('⚠️ Notification modules not available - skipping notification cancellation');
        return null;
    }

    console.log('🚫 Cancelling all scheduled notifications');
    await Notifications.cancelAllScheduledNotificationsAsync();
}
