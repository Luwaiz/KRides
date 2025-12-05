const express = require('express');
const router = express.Router();
const { sendDualNotification } = require('../helpers/notificationHelper');
const {
    getUserById,
    getAllDrivers,
    saveNotificationHistory,
    isNotificationEnabled,
} = require('../helpers/firestoreHelper');

/**
 * POST /api/notifications/ride-booked
 * Notify customer about successful ride booking with payment confirmation
 * Body: { customerId, rideId, amount, pickupLocation, destination }
 */
router.post('/ride-booked', async (req, res) => {
    try {
        const { customerId, rideId, amount, pickupLocation, destination } = req.body;

        if (!customerId || !rideId || !amount) {
            return res.status(400).json({
                error: 'Missing required fields: customerId, rideId, amount',
            });
        }

        // Get customer data
        const customer = await getUserById(customerId);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Check notification preferences
        if (!isNotificationEnabled(customer, 'rideUpdates')) {
            return res.json({ message: 'Notification disabled by user preferences' });
        }

        // Send notification
        const title = 'Ride Booked Successfully! 🚗';
        const body = `Payment of ₦${amount} confirmed. Your ride from ${pickupLocation || 'pickup location'} to ${destination || 'destination'} is booked!`;
        const data = {
            type: 'ride_booked',
            rideId: String(rideId),
            amount: String(amount),
        };

        const result = await sendDualNotification(customer, title, body, data);

        // Save to notification history
        await saveNotificationHistory(customerId, {
            type: 'ride_booked',
            rideId,
            title,
            body,
        });

        res.json({
            success: true,
            message: 'Ride booking notification sent',
            result,
        });
    } catch (error) {
        console.error('Error in ride-booked notification:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/notifications/ride-accepted
 * Notify customer that driver accepted the ride
 * Body: { customerId, rideId, driverName, driverPhone }
 */
router.post('/ride-accepted', async (req, res) => {
    try {
        const { customerId, rideId, driverName, driverPhone } = req.body;

        if (!customerId || !rideId) {
            return res.status(400).json({
                error: 'Missing required fields: customerId, rideId',
            });
        }

        const customer = await getUserById(customerId);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        if (!isNotificationEnabled(customer, 'rideUpdates')) {
            return res.json({ message: 'Notification disabled by user preferences' });
        }

        const title = 'Ride Accepted! 🚗';
        const body = `${driverName || 'Your driver'} is on the way to pick you up!`;
        const data = {
            type: 'ride_accepted',
            rideId: String(rideId),
            driverName: driverName || '',
            driverPhone: driverPhone || '',
        };

        const result = await sendDualNotification(customer, title, body, data);

        await saveNotificationHistory(customerId, {
            type: 'ride_accepted',
            rideId,
            title,
            body,
        });

        res.json({
            success: true,
            message: 'Ride accepted notification sent',
            result,
        });
    } catch (error) {
        console.error('Error in ride-accepted notification:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/notifications/driver-arrived
 * Notify customer that driver has arrived at pickup location
 * Body: { customerId, rideId, driverName }
 */
router.post('/driver-arrived', async (req, res) => {
    try {
        const { customerId, rideId, driverName } = req.body;

        if (!customerId || !rideId) {
            return res.status(400).json({
                error: 'Missing required fields: customerId, rideId',
            });
        }

        const customer = await getUserById(customerId);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        if (!isNotificationEnabled(customer, 'rideUpdates')) {
            return res.json({ message: 'Notification disabled by user preferences' });
        }

        const title = 'Driver Arrived! 📍';
        const body = `${driverName || 'Your driver'} is waiting at the pickup location`;
        const data = {
            type: 'driver_arrived',
            rideId: String(rideId),
        };

        const result = await sendDualNotification(customer, title, body, data);

        await saveNotificationHistory(customerId, {
            type: 'driver_arrived',
            rideId,
            title,
            body,
        });

        res.json({
            success: true,
            message: 'Driver arrived notification sent',
            result,
        });
    } catch (error) {
        console.error('Error in driver-arrived notification:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/notifications/ride-started
 * Notify customer that the ride has started
 * Body: { customerId, rideId, destination }
 */
router.post('/ride-started', async (req, res) => {
    try {
        const { customerId, rideId, destination } = req.body;

        if (!customerId || !rideId) {
            return res.status(400).json({
                error: 'Missing required fields: customerId, rideId',
            });
        }

        const customer = await getUserById(customerId);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        if (!isNotificationEnabled(customer, 'rideUpdates')) {
            return res.json({ message: 'Notification disabled by user preferences' });
        }

        const title = 'Ride Started! 🚀';
        const body = `Enjoy your ride to ${destination || 'your destination'}`;
        const data = {
            type: 'ride_started',
            rideId: String(rideId),
        };

        const result = await sendDualNotification(customer, title, body, data);

        await saveNotificationHistory(customerId, {
            type: 'ride_started',
            rideId,
            title,
            body,
        });

        res.json({
            success: true,
            message: 'Ride started notification sent',
            result,
        });
    } catch (error) {
        console.error('Error in ride-started notification:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/notifications/ride-completed
 * Notify customer that the ride has been completed
 * Body: { customerId, rideId, amount }
 */
router.post('/ride-completed', async (req, res) => {
    try {
        const { customerId, rideId, amount } = req.body;

        if (!customerId || !rideId) {
            return res.status(400).json({
                error: 'Missing required fields: customerId, rideId',
            });
        }

        const customer = await getUserById(customerId);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        if (!isNotificationEnabled(customer, 'rideUpdates')) {
            return res.json({ message: 'Notification disabled by user preferences' });
        }

        const title = 'Ride Completed! ✅';
        const body = amount
            ? `Your ride has been completed. Total: ₦${amount}. How was your experience?`
            : 'Your ride has been completed. How was your experience?';
        const data = {
            type: 'ride_completed',
            rideId: String(rideId),
            amount: amount ? String(amount) : '',
        };

        const result = await sendDualNotification(customer, title, body, data);

        await saveNotificationHistory(customerId, {
            type: 'ride_completed',
            rideId,
            title,
            body,
        });

        res.json({
            success: true,
            message: 'Ride completed notification sent',
            result,
        });
    } catch (error) {
        console.error('Error in ride-completed notification:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/notifications/ride-cancelled
 * Notify customer that the ride has been cancelled with refund confirmation
 * Body: { customerId, rideId, refundAmount, reason }
 */
router.post('/ride-cancelled', async (req, res) => {
    try {
        const { customerId, rideId, refundAmount, reason } = req.body;

        if (!customerId || !rideId) {
            return res.status(400).json({
                error: 'Missing required fields: customerId, rideId',
            });
        }

        const customer = await getUserById(customerId);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        if (!isNotificationEnabled(customer, 'rideUpdates')) {
            return res.json({ message: 'Notification disabled by user preferences' });
        }

        const title = 'Ride Cancelled ❌';
        const body = refundAmount
            ? `Your ride has been cancelled. Refund of ₦${refundAmount} will be processed within 24 hours.`
            : `Your ride has been cancelled${reason ? `: ${reason}` : ''}`;
        const data = {
            type: 'ride_cancelled',
            rideId: String(rideId),
            refundAmount: refundAmount ? String(refundAmount) : '',
            reason: reason || '',
        };

        const result = await sendDualNotification(customer, title, body, data);

        await saveNotificationHistory(customerId, {
            type: 'ride_cancelled',
            rideId,
            title,
            body,
        });

        res.json({
            success: true,
            message: 'Ride cancelled notification sent',
            result,
        });
    } catch (error) {
        console.error('Error in ride-cancelled notification:', error);
        res.status(500).json({ error: error.message });
    }
});


/**
 * POST /api/notifications/send-custom
 * Send custom notification to a user (admin use)
 * Body: { userId, title, body, data }
 */
router.post('/send-custom', async (req, res) => {
    try {
        const { userId, title, body, data } = req.body;

        if (!userId || !title || !body) {
            return res.status(400).json({
                error: 'Missing required fields: userId, title, body',
            });
        }

        const user = await getUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const result = await sendDualNotification(user, title, body, data || {});

        await saveNotificationHistory(userId, {
            type: 'custom',
            title,
            body,
        });

        res.json({
            success: true,
            message: 'Custom notification sent',
            result,
        });
    } catch (error) {
        console.error('Error in send-custom notification:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== DRIVER NOTIFICATIONS ====================

/**
 * POST /api/notifications/new-ride-request
 * Notify all available drivers about a new ride request
 * Body: { rideId, pickupLocation, destination, amount, customerName }
 */
router.post('/new-ride-request', async (req, res) => {
    try {
        const { rideId, pickupLocation, destination, amount, customerName } = req.body;

        if (!rideId || !pickupLocation || !destination) {
            return res.status(400).json({
                error: 'Missing required fields: rideId, pickupLocation, destination',
            });
        }

        // Get all available drivers
        const drivers = await getAllDrivers();

        if (!drivers || drivers.length === 0) {
            return res.json({
                success: true,
                message: 'No drivers available',
                notificationsSent: 0,
            });
        }

        const title = 'New Ride Request! 🚗';
        const body = `Pickup: ${pickupLocation} → ${destination}${amount ? ` | ₦${amount}` : ''}`;
        const data = {
            type: 'new_ride_request',
            rideId: String(rideId),
            pickupLocation,
            destination,
            amount: amount ? String(amount) : '',
            customerName: customerName || '',
        };

        // Send notifications to all drivers
        const results = [];
        for (const driver of drivers) {
            if (isNotificationEnabled(driver, 'rideUpdates')) {
                const result = await sendDualNotification(driver, title, body, data);
                results.push(result);

                // Save to driver's notification history
                await saveNotificationHistory(driver.uid, {
                    type: 'new_ride_request',
                    rideId,
                    title,
                    body,
                });
            }
        }

        res.json({
            success: true,
            message: 'New ride request notifications sent',
            notificationsSent: results.length,
            results,
        });
    } catch (error) {
        console.error('Error in new-ride-request notification:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/notifications/ride-cancelled-by-customer
 * Notify driver that customer cancelled the ride
 * Body: { driverId, rideId, pickupLocation, destination, cancellationReason }
 */
router.post('/ride-cancelled-by-customer', async (req, res) => {
    try {
        const { driverId, rideId, pickupLocation, destination, cancellationReason } = req.body;

        if (!driverId || !rideId) {
            return res.status(400).json({
                error: 'Missing required fields: driverId, rideId',
            });
        }

        const driver = await getUserById(driverId);
        if (!driver) {
            return res.status(404).json({ error: 'Driver not found' });
        }

        if (!isNotificationEnabled(driver, 'rideUpdates')) {
            return res.json({ message: 'Notification disabled by user preferences' });
        }

        const title = 'Ride Cancelled ❌';
        const body = cancellationReason
            ? `Customer cancelled the ride. Reason: ${cancellationReason}`
            : `Customer cancelled the ride from ${pickupLocation || 'pickup'} to ${destination || 'destination'}`;
        const data = {
            type: 'ride_cancelled_by_customer',
            rideId: String(rideId),
            pickupLocation: pickupLocation || '',
            destination: destination || '',
            cancellationReason: cancellationReason || '',
        };

        const result = await sendDualNotification(driver, title, body, data);

        await saveNotificationHistory(driverId, {
            type: 'ride_cancelled_by_customer',
            rideId,
            title,
            body,
        });

        res.json({
            success: true,
            message: 'Ride cancellation notification sent to driver',
            result,
        });
    } catch (error) {
        console.error('Error in ride-cancelled-by-customer notification:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/notifications/payment-received
 * Notify driver about payment received for completed ride
 * Body: { driverId, rideId, amount, netAmount, rideDate }
 */
router.post('/payment-received', async (req, res) => {
    try {
        const { driverId, rideId, amount, netAmount, rideDate } = req.body;

        if (!driverId || !rideId || !netAmount) {
            return res.status(400).json({
                error: 'Missing required fields: driverId, rideId, netAmount',
            });
        }

        const driver = await getUserById(driverId);
        if (!driver) {
            return res.status(404).json({ error: 'Driver not found' });
        }

        if (!isNotificationEnabled(driver, 'rideUpdates')) {
            return res.json({ message: 'Notification disabled by user preferences' });
        }

        const title = 'Payment Received! 💰';
        const body = `You earned ₦${netAmount} from your completed ride${rideDate ? ` on ${rideDate}` : ''}`;
        const data = {
            type: 'payment_received',
            rideId: String(rideId),
            amount: amount ? String(amount) : '',
            netAmount: String(netAmount),
            rideDate: rideDate || '',
        };

        const result = await sendDualNotification(driver, title, body, data);

        await saveNotificationHistory(driverId, {
            type: 'payment_received',
            rideId,
            title,
            body,
        });

        res.json({
            success: true,
            message: 'Payment notification sent to driver',
            result,
        });
    } catch (error) {
        console.error('Error in payment-received notification:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

