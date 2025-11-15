# Firestore Setup Guide

## ✅ Changes Made

Your app now uses **100% Firebase Firestore** for ride bookings instead of API/Socket.

### What Changed:

- ❌ No more API calls for creating/accepting rides
- ❌ No more Socket.io for real-time updates
- ✅ Pure Firestore real-time listeners
- ✅ Client-side sorting (no complex indexes needed)

---

## 🔥 Firestore Security Rules

Add these rules to your Firebase Console → Firestore Database → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // Drivers collection
    match /drivers/{driverId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == driverId;
    }

    // Locations collection
    match /locations/{locationId} {
      allow read: if true; // Public read
      allow write: if false; // Admin only (via Firebase Console)
    }

    // Rides collection (NEW)
    match /rides/{rideId} {
      // Anyone authenticated can read rides
      allow read: if request.auth != null;

      // Customers can create rides
      allow create: if request.auth != null &&
                      request.resource.data.customerId == request.auth.uid;

      // Customers can update their own rides (cancel)
      // Drivers can update rides they're assigned to (accept, complete)
      allow update: if request.auth != null && (
        request.resource.data.customerId == request.auth.uid ||
        request.resource.data.driverId == request.auth.uid ||
        resource.data.status == 'pending'
      );

      // Only the customer who created the ride can delete it
      allow delete: if request.auth != null &&
                      resource.data.customerId == request.auth.uid;
    }
  }
}
```

---

## 📊 Firestore Structure

### `rides` Collection

Each ride document contains:

```javascript
{
  id: "auto-generated",
  customerId: "user-uid",
  customerName: "John Doe",
  customerPhone: "1234567890",
  pickupLocation: "SAT Building",
  pickupCoords: {
    latitude: 6.8887163,
    longitude: 3.7225462,
    address: "Babcock University..."
  },
  destination: "Cafeteria",
  destinationCoords: {
    latitude: 6.8926805,
    longitude: 3.7236058,
    address: "Babcock University..."
  },
  numberOfPassengers: 2,
  amount: 400,
  status: "pending", // "accepted", "in_progress", "completed", "cancelled"
  driverId: null, // Set when accepted
  driverName: null,
  driverPhone: null,
  vehicleId: null,
  paymentMethod: "cash",
  createdAt: Timestamp,
  acceptedAt: null,
  completedAt: null
}
```

---

## 🚀 How It Works

### Customer Books Ride:

1. Customer selects pickup/destination
2. `createRide()` creates Firestore document with status: "pending"
3. All drivers' listeners get notified instantly

### Driver Sees Rides:

1. `listenToPendingRides()` real-time listener shows all pending rides
2. No API polling needed
3. Updates automatically when new rides come in

### Driver Accepts:

1. Driver taps "Accept"
2. `acceptRide()` updates Firestore document:
   - status: "accepted"
   - driverId: driver's ID
   - acceptedAt: timestamp
3. Customer's `listenToRide()` listener detects change
4. Customer sees "Ride Accepted" instantly

### Real-Time Updates:

- All changes sync automatically via Firestore
- No socket reconnection issues
- Works offline (Firestore caches data)

---

## 🐛 Troubleshooting

### "Query requires an index" Error

**Fixed!** We removed `orderBy()` clauses that required indexes. Sorting now happens client-side.

### Rides Not Showing

1. Check Firebase Console → Firestore Database
2. Look for `rides` collection
3. Verify documents exist with status: "pending"
4. Check browser console for errors

### Authentication Issues

1. Ensure user is logged in (check `request.auth.uid`)
2. Verify Firestore rules allow read/write
3. Check Firebase Console → Authentication

---

## 📝 Testing

1. **Customer Side:**

   - Book a ride → Check Firestore Console
   - Document should appear in `rides` collection
   - Status should be "pending"

2. **Driver Side:**

   - Open driver app → Should see pending rides
   - Accept ride → Status changes to "accepted"
   - Customer should see acceptance immediately

3. **Real-Time:**
   - Open customer and driver on separate devices
   - Book ride on customer → Appears on driver instantly
   - Accept on driver → Customer sees it instantly

---

## 🎯 Benefits

✅ **No backend API needed** for bookings  
✅ **Real-time by default** (Firestore listeners)  
✅ **More reliable** (no socket disconnections)  
✅ **Offline support** (Firestore caching)  
✅ **Simpler code** (no API/socket complexity)  
✅ **Better performance** (direct Firebase connection)  
✅ **Scalable** (Firebase handles load automatically)

---

## 🔄 Migration Summary

| Before                      | After                               |
| --------------------------- | ----------------------------------- |
| API: `/auth/trips/create`   | Firestore: `createRide()`           |
| API: `/auth/driver/trips`   | Firestore: `listenToPendingRides()` |
| API: `/trips/{id}/accept`   | Firestore: `acceptRide()`           |
| Socket: `ride_booked` event | Firestore: Real-time listener       |
| Socket: `accept_ride` event | Firestore: Real-time listener       |
| Polling for updates         | Automatic Firestore sync            |

Your app is now fully Firebase-powered! 🚀
