/**
 * Test script for KRides Notification Server
 * Run with: node test/test-notifications.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api/notifications';

// Test data
const testData = {
    customerId: 'JvsKRiFVPWasd82bUQgzTkUNE5e2', // Replace with actual user ID from your Firestore
    rideId: 'test-ride-' + Date.now(),
    amount: 1500,
    pickupLocation: 'Main Gate',
    destination: 'Library',
    driverName: 'Test Driver',
    driverPhone: '08012345678',
};

async function testNotification(endpoint, data) {
    console.log(`\n🧪 Testing: ${endpoint}`);
    console.log('📤 Sending:', JSON.stringify(data, null, 2));

    try {
        const response = await axios.post(`${BASE_URL}${endpoint}`, data);
        console.log('✅ Success:', response.data);
        return true;
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
        return false;
    }
}

async function runTests() {
    console.log('🚀 Starting Notification Server Tests\n');
    console.log('Make sure the server is running on http://localhost:3001\n');

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 1: Ride Booked
    await testNotification('/ride-booked', {
        customerId: testData.customerId,
        rideId: testData.rideId,
        amount: testData.amount,
        pickupLocation: testData.pickupLocation,
        destination: testData.destination,
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Ride Accepted
    await testNotification('/ride-accepted', {
        customerId: testData.customerId,
        rideId: testData.rideId,
        driverName: testData.driverName,
        driverPhone: testData.driverPhone,
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: Driver Arrived
    await testNotification('/driver-arrived', {
        customerId: testData.customerId,
        rideId: testData.rideId,
        driverName: testData.driverName,
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 4: Ride Started
    await testNotification('/ride-started', {
        customerId: testData.customerId,
        rideId: testData.rideId,
        destination: testData.destination,
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 5: Ride Completed
    await testNotification('/ride-completed', {
        customerId: testData.customerId,
        rideId: testData.rideId,
        amount: testData.amount,
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 6: Ride Cancelled
    await testNotification('/ride-cancelled', {
        customerId: testData.customerId,
        rideId: testData.rideId,
        refundAmount: testData.amount,
        reason: 'Test cancellation',
    });

    console.log('\n✅ All tests completed!\n');
}

// Run tests
runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
