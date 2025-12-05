const admin = require('firebase-admin');

/**
 * Get user by ID from Firestore
 * @param {string} userId - User ID
 * @returns {Promise<object|null>} User data or null
 */
async function getUserById(userId) {
    try {
        const userDoc = await admin.firestore().collection('users').doc(userId).get();

        if (!userDoc.exists) {
            console.warn(`⚠️ User not found: ${userId}`);
            return null;
        }
        const userData = userDoc.data();

        // Extract FCM token from fcmTokens object
        let fcmToken = null;
        if (userData.fcmTokens) {
            const tokens = Object.keys(userData.fcmTokens);
            if (tokens.length > 0) {
                fcmToken = tokens[0]; // Use the first token
            }
        }
        return {
            id: userDoc.id,
            ...userData,
            fcmToken: fcmToken || userData.fcmToken, // Fallback to direct fcmToken field
        };
    } catch (error) {
        console.error('❌ Error fetching user:', error.message);
        return null;
    }
}
/**
 * Get all drivers with push tokens
 * @returns {Promise<Array>} Array of driver objects
 */
async function getAllDrivers() {
    try {
        const driversSnapshot = await admin
            .firestore()
            .collection('users')
            .where('role', '==', 'driver')
            .get();

        const drivers = [];
        driversSnapshot.forEach((doc) => {
            drivers.push({ id: doc.id, ...doc.data() });
        });

        console.log(`✅ Found ${drivers.length} drivers`);
        return drivers;
    } catch (error) {
        console.error('❌ Error fetching drivers:', error.message);
        return [];
    }
}

/**
 * Save notification to Firestore history
 * @param {string} userId - User ID
 * @param {object} notificationData - Notification data
 * @returns {Promise<void>}
 */
async function saveNotificationHistory(userId, notificationData) {
    try {
        await admin
            .firestore()
            .collection('notifications')
            .doc(userId)
            .collection('items')
            .add({
                ...notificationData,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false,
            });

        console.log(`✅ Saved notification history for user: ${userId}`);
    } catch (error) {
        console.error('❌ Error saving notification history:', error.message);
    }
}

/**
 * Check if user has notification preferences enabled
 * @param {object} user - User object
 * @param {string} notificationType - Type of notification
 * @returns {boolean} Whether notification is enabled
 */
function isNotificationEnabled(user, notificationType) {
    // Default to true if no preferences set
    if (!user.notificationPreferences) {
        return true;
    }

    // Check specific preference
    const preference = user.notificationPreferences[notificationType];
    return preference !== false; // Allow if undefined or true
}

module.exports = {
    getUserById,
    getAllDrivers,
    saveNotificationHistory,
    isNotificationEnabled,
};
