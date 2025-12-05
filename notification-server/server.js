require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize Firebase Admin SDK
try {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
    console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
    console.error('❌ Error initializing Firebase Admin:', error.message);
    process.exit(1);
}

// Import routes
const notificationRoutes = require('./routes/notifications');

// Use routes
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'KRides Notification Server',
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'KRides Notification Server',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            customerNotifications: {
                rideBooked: 'POST /api/notifications/ride-booked',
                rideAccepted: 'POST /api/notifications/ride-accepted',
                driverArrived: 'POST /api/notifications/driver-arrived',
                rideStarted: 'POST /api/notifications/ride-started',
                rideCompleted: 'POST /api/notifications/ride-completed',
                rideCancelled: 'POST /api/notifications/ride-cancelled',
            },
            driverNotifications: {
                newRideRequest: 'POST /api/notifications/new-ride-request',
                rideCancelledByCustomer: 'POST /api/notifications/ride-cancelled-by-customer',
                paymentReceived: 'POST /api/notifications/payment-received',
            },
            admin: {
                custom: 'POST /api/notifications/send-custom',
            },
        },
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message,
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Notification server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`📍 API docs: http://localhost:${PORT}/`);
});

module.exports = app;
