const admin = require('firebase-admin');
const axios = require('axios');

/**
 * Send FCM notification to a user
 * @param {string} fcmToken - Firebase Cloud Messaging token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Custom data payload
 * @returns {Promise<object>} FCM response
 */
async function sendFCMNotification(fcmToken, title, body, data = {}) {
    if (!fcmToken) {
        console.warn('⚠️ No FCM token provided');
        return null;
    }

    const message = {
        token: fcmToken,
        notification: {
            title: title,
            body: body,
        },
        data: {
            ...data,
            // Convert all data values to strings (FCM requirement)
            ...Object.keys(data).reduce((acc, key) => {
                acc[key] = String(data[key]);
                return acc;
            }, {}),
        },
        android: {
            priority: 'high',
            notification: {
                sound: 'default',
                channelId: 'default',
                // Add app icon to notification
                icon: 'ic_notification', // Uses the notification icon from Android resources
                color: '#4CAF50', // KRides brand color (green)
            },
        },
        apns: {
            payload: {
                aps: {
                    sound: 'default',
                    badge: 1,
                },
            },
        },
    };

    try {
        console.log(`📤 Sending FCM notification to ${fcmToken.substring(0, 20)}...`);
        const response = await admin.messaging().send(message);
        console.log('✅ FCM notification sent successfully:', response);
        return { success: true, messageId: response };
    } catch (error) {
        console.error('❌ Error sending FCM notification:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Send Expo push notification
 * @param {string} expoPushToken - Expo push token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Custom data payload
 * @returns {Promise<object>} Expo response
 */
async function sendExpoPushNotification(expoPushToken, title, body, data = {}) {
    if (!expoPushToken) {
        console.warn('⚠️ No Expo push token provided');
        return null;
    }

    // Validate Expo token format
    if (!expoPushToken.startsWith('ExponentPushToken[')) {
        console.warn('⚠️ Invalid Expo token format:', expoPushToken);
        return null;
    }

    const message = {
        to: expoPushToken,
        sound: 'default',
        title: title,
        body: body,
        data: data,
        priority: 'high',
    };

    try {
        console.log(`📤 Sending Expo notification to ${expoPushToken.substring(0, 30)}...`);
        const response = await axios.post(
            'https://exp.host/--/api/v2/push/send',
            message,
            {
                headers: {
                    Accept: 'application/json',
                    'Accept-encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
            }
        );

        console.log('✅ Expo notification sent successfully:', response.data);
        return { success: true, data: response.data };
    } catch (error) {
        console.error('❌ Error sending Expo notification:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Send notification using both FCM and Expo (dual delivery)
 * @param {object} user - User object with tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Custom data payload
 * @returns {Promise<object>} Combined results
 */
async function sendDualNotification(user, title, body, data = {}) {
    const results = {
        fcm: null,
        expo: null,
        success: false,
    };

    // Send FCM notification if token exists
    if (user.fcmToken) {
        results.fcm = await sendFCMNotification(user.fcmToken, title, body, data);
    }

    // Send Expo notification if token exists
    if (user.pushToken) {
        results.expo = await sendExpoPushNotification(user.pushToken, title, body, data);
    }

    // Mark as success if at least one notification was sent
    results.success = (results.fcm?.success || results.expo?.success) || false;

    return results;
}

module.exports = {
    sendFCMNotification,
    sendExpoPushNotification,
    sendDualNotification,
};
