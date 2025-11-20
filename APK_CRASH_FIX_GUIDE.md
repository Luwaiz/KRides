# APK Crash After Login - Quick Fix Guide

## 🎯 Most Likely Cause: Firestore Security Rules

**90% of post-login crashes are caused by Firestore permission denied errors.**

### ✅ CRITICAL FIX - Update Firestore Rules:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your KRides project
3. Click **Firestore Database** in left sidebar
4. Click **Rules** tab
5. Replace the rules with this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create: if request.auth != null;
      allow update: if request.auth != null && request.auth.uid == userId;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
    
    // Drivers collection
    match /drivers/{driverId} {
      allow read: if request.auth != null && request.auth.uid == driverId;
      allow create: if request.auth != null;
      allow update: if request.auth != null && request.auth.uid == driverId;
      allow delete: if request.auth != null && request.auth.uid == driverId;
    }
    
    // Rides collection
    match /rides/{rideId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && 
                      request.resource.data.customerId == request.auth.uid;
      allow update: if request.auth != null && (
        resource.data.customerId == request.auth.uid ||
        resource.data.driverId == request.auth.uid
      );
      allow delete: if request.auth != null && 
                      resource.data.customerId == request.auth.uid;
    }
    
    // Locations collection (for tracking)
    match /locations/{locationId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Driver locations
    match /driver_locations/{driverId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == driverId;
    }
  }
}
```

6. Click **Publish**
7. Wait 30 seconds for rules to propagate

---

## 📱 Other Fixes Applied in Code:

### ✅ 1. Added Location Permissions
- `ACCESS_FINE_LOCATION` - For GPS/Maps
- `ACCESS_COARSE_LOCATION` - For network-based location

### ✅ 2. Added Error Boundary
- Catches React component crashes
- Shows user-friendly error screen
- Allows app recovery without restart

### ✅ 3. Enhanced Navigation Error Handling
- Added detailed logging
- Prevents crashes if user profile not found
- Falls back to default customer role
- Handles cleanup on unmount

### ✅ 4. Added Global Error Handler
- Catches and logs all console errors
- Shows alerts for critical Firebase/Network errors
- Prevents silent crashes

### ✅ 5. Comprehensive ProGuard Rules
- Prevents code minification issues
- Keeps all Firebase classes
- Protects React Native bridge

---

## 🔍 How to Debug Crashes:

### Method 1: Use Development Build
```bash
npx eas build -p android --profile development
```
This build includes dev tools and better error messages.

### Method 2: Check Logs via ADB
```bash
# Install Android SDK Platform Tools first
# Then connect your phone via USB with USB Debugging enabled

adb logcat | grep -i "fatal\|crash\|exception"
```

### Method 3: Test Specific Scenarios

**Test 1: Login with existing account**
- If it crashes → Check Firestore Rules (user document read permission)

**Test 2: Login with new account**
- If it crashes → Check if user document is created properly

**Test 3: After login, check which screen crashes**
- Home screen → Likely map/location issue
- Profile → User data issue
- Settings → Store issue

---

## 🛠️ Quick Temporary Fix (For Testing Only)

If you want to test if it's a Firestore rules issue, temporarily use open rules:

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

**⚠️ WARNING:** This allows any authenticated user to read/write ANY document. Only use for testing, then switch back to secure rules!

---

## 📋 Post-Build Checklist:

Before testing the new APK:

- [ ] google-services.json is named correctly (not `google-services (13).json`)
- [ ] google-services.json package name matches: `com.eluwaiz.KRides`
- [ ] Firestore security rules are published
- [ ] Test user exists in Firestore `users` collection
- [ ] Location permissions granted on device
- [ ] Internet connection available
- [ ] Device has enough storage space

---

## 🎯 Step-by-Step Testing Process:

1. **Uninstall old APK** completely
2. **Install new APK** from this build
3. **Grant all permissions** when prompted
4. **Try login** with existing account
5. **If crashes:**
   - Connect via USB
   - Run: `adb logcat > crash.txt`
   - Open app and trigger crash
   - Stop logcat (Ctrl+C)
   - Search crash.txt for "FATAL" or "Exception"
   - Share the error message

---

## 🔥 Most Common Crash Causes & Solutions:

### 1. "FirebaseError: Missing or insufficient permissions"
**Fix:** Update Firestore rules (see above)

### 2. "Cannot read property 'navigate' of undefined"
**Fix:** Navigation state issue - already added error boundary

### 3. "Mapbox/Maps crash"
**Fix:** Check MAPBOX_DOWNLOADS_TOKEN in gradle.properties

### 4. "Network request failed"
**Fix:** Check internet connection, verify Firebase config

### 5. "ClassNotFoundException"
**Fix:** Already added comprehensive ProGuard rules

---

## 🚀 Build New APK Now:

```bash
npx eas build -p android --profile preview
```

**Changes in this build:**
- ✅ Location permissions added
- ✅ Error boundary wrapping entire app
- ✅ Better error handling in navigation
- ✅ Detailed logging for debugging
- ✅ Crash recovery mechanisms

---

## 📞 If Still Crashing:

1. Run this command after installing APK:
```bash
adb logcat -c  # Clear logs
adb logcat > app_crash.txt  # Start recording
# Now open app and trigger crash
# Press Ctrl+C when crashed
# Open app_crash.txt and find the FATAL EXCEPTION
```

2. Look for these patterns:
   - `FATAL EXCEPTION: main`
   - `Caused by:`
   - `at com.eluwaiz.KRides`

3. The error message will tell us exactly what's wrong!

---

**Last Updated:** November 16, 2025
**Build:** With ErrorBoundary + Enhanced Error Handling
