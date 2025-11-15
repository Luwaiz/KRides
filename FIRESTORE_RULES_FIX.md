# 🔥 FIRESTORE SECURITY RULES - URGENT FIX

## Problem

You're getting "Missing or insufficient permissions" when creating rides even though:

- ✅ User is authenticated
- ✅ CustomerId matches Firebase Auth UID
- ✅ All data is correct

## Root Cause

**Your Firestore Security Rules in Firebase Console are not set correctly or not published.**

---

## ⚡ IMMEDIATE FIX

### Step 1: Go to Firebase Console

1. Open: https://console.firebase.google.com
2. Select your project: **KRides** (or kampusride)
3. Click **"Firestore Database"** in left menu
4. Click **"Rules"** tab at the top

### Step 2: Check Current Rules

Your current rules might be too restrictive or have a syntax error.

### Step 3: Replace with Correct Rules

**Copy and paste these EXACT rules:**

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

    // Locations collection - Anyone can read, only admins can write
    match /locations/{locationId} {
      allow read: if true;
      allow write: if false;
    }

    // Rides collection - THE IMPORTANT ONE
    match /rides/{rideId} {
      // Anyone authenticated can read any ride
      allow read: if request.auth != null;

      // Customers can create rides if customerId matches their UID
      allow create: if request.auth != null &&
                      request.resource.data.customerId == request.auth.uid;

      // Customers can update their own rides OR drivers can update assigned rides
      allow update: if request.auth != null && (
        resource.data.customerId == request.auth.uid ||
        request.resource.data.driverId == request.auth.uid
      );

      // Only the customer who created the ride can delete it
      allow delete: if request.auth != null &&
                      resource.data.customerId == request.auth.uid;
    }
  }
}
```

### Step 4: Publish Rules

1. Click the **"Publish"** button at the top right
2. Wait for "Rules published successfully" message

### Step 5: Test Immediately

Try booking a ride again. It should work now!

---

## 🚨 Quick Test Rules (TEMPORARY ONLY)

If you just want to test quickly, use these **OPEN RULES** (NOT SECURE - TESTING ONLY):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**⚠️ WARNING:** These rules allow any authenticated user to read/write EVERYTHING. Only use for testing, then switch back to the secure rules above!

---

## 🔍 How to Verify Rules Are Working

After publishing rules, check the Firebase Console:

1. Go to **Firestore Database** → **Rules**
2. You should see "Last published: a few seconds ago"
3. Click **"Rules Playground"** to test
4. Set **Authenticated** to YES
5. Set **UID** to: `xqPJkZCEqyYh3m2yChottlfinW33`
6. Test path: `/rides/test123`
7. Set **customerId** field to: `xqPJkZCEqyYh3m2yChottlfinW33`
8. Should show "✅ Allowed"

---

## 📋 Checklist

- [ ] Logged into Firebase Console
- [ ] Opened Firestore Database → Rules
- [ ] Copied and pasted the correct rules
- [ ] Clicked "Publish" button
- [ ] Saw "Rules published successfully" message
- [ ] Tested ride booking in app
- [ ] Verified ride was created in Firestore

---

## 🆘 Still Not Working?

If you still get permission denied after updating rules:

1. **Check Firebase Project**: Make sure you're editing rules for the correct Firebase project
2. **Wait 30 seconds**: Sometimes rules take a moment to propagate
3. **Force Refresh**: Log out and log back in to the app
4. **Check Firestore Collection Name**: Verify you're writing to "rides" (not "Rides" or "ride")
5. **Check Firebase Auth**: Verify user is authenticated in Firebase Console → Authentication

---

## 📱 Expected Behavior After Fix

When you book a ride:

```
✅ Payment successful
✅ Creating ride...
✅ Ride created: <ride-id>
✅ Listening for ride updates
```

The ride should appear in:

- Firebase Console → Firestore → rides collection
- Driver's pending rides list
