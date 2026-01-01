# Google Sign-In Troubleshooting Guide

## 🔴 Problem: Google Login Not Working

This guide will help you fix Google Sign-In issues in KRides.

---

## ✅ Quick Diagnosis Checklist

Run through this checklist to identify the issue:

- [ ] Is this happening on **development build** or **EAS preview/production build**?
- [ ] What error message do you see? (Check console logs)
- [ ] Did this work before? When did it stop working?
- [ ] Did you recently create a new build or change signing keys?

---

## 🔧 Common Issues & Solutions

### Issue 1: SHA-1 Certificate Hash Mismatch (Most Common)

**Symptoms:**
- Google Sign-In button does nothing
- Error: "Developer Error" or "API not enabled"
- Error: "Sign-in failed"

**Cause:** Your app's signing certificate doesn't match what's registered in Firebase.

**Solution:**

#### For Development Builds:

1. **Get your debug SHA-1:**

```powershell
# Navigate to your project
cd c:\Users\Administrator\Documents\REACTNATIVE\KRides

# Get debug SHA-1
keytool -list -v -keystore android\app\debug.keystore -alias androiddebugkey -storepass android -keypass android
```

2. **Get your EAS Build SHA-1 (if using EAS):**

```powershell
# Download your keystore from EAS
eas credentials

# Then get SHA-1 from the downloaded keystore
keytool -list -v -keystore @uwaiz__krides.jks -alias @uwaiz__krides
```

3. **Add SHA-1 to Firebase:**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Select your project: `kampusride`
   - Go to **Project Settings** (gear icon)
   - Scroll to **Your apps** section
   - Click on your Android app (`com.eluwaiz.KRides`)
   - Scroll to **SHA certificate fingerprints**
   - Click **Add fingerprint**
   - Paste your SHA-1 hash
   - Click **Save**

4. **Download new google-services.json:**
   - In Firebase Console, click **Download google-services.json**
   - Replace the file in your project root
   - **Important:** Also update `android/app/google-services.json` if building locally

---

### Issue 2: Web Client ID Not Configured

**Symptoms:**
- Error: "No ID token received from Google"
- Sign-in completes but Firebase auth fails

**Solution:**

1. **Verify Web Client ID exists:**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Select project: `kampusride`
   - Go to **APIs & Services** → **Credentials**
   - Look for **OAuth 2.0 Client IDs**
   - Find the **Web client** (Type: Web application)
   - Copy the Client ID

2. **Update App.js with correct Web Client ID:**

```javascript
GoogleSignin.configure({
  webClientId: 'YOUR_WEB_CLIENT_ID_HERE.apps.googleusercontent.com',
  offlineAccess: true,
  forceCodeForRefreshToken: true,
});
```

3. **Current Web Client ID in your app:**
   ```
   1054058095059-6j788gaiqicduqgt1jo322hsvb7ums7b.apps.googleusercontent.com
   ```
   
   Verify this matches your Firebase Console → Project Settings → Web API Key

---

### Issue 3: Google Play Services Not Available

**Symptoms:**
- Error: "Google Play Services not available"
- Happens on emulators or old Android devices

**Solution:**

1. **For Emulators:**
   - Use an emulator with Google Play Store
   - Update Google Play Services in the emulator

2. **For Physical Devices:**
   - Update Google Play Services from Play Store
   - Ensure device has Google Play Services installed

3. **Add fallback in code** (already implemented in `useGoogleAuth.js`):
   ```javascript
   await GoogleSignin.hasPlayServices({
     showPlayServicesUpdateDialog: true,
   });
   ```

---

### Issue 4: Package Name Mismatch

**Symptoms:**
- Error: "Developer Error"
- Google Sign-In doesn't open

**Solution:**

1. **Verify package name consistency:**

   **In app.json:**
   ```json
   "android": {
     "package": "com.eluwaiz.KRides"
   }
   ```

   **In google-services.json:**
   ```json
   "package_name": "com.eluwaiz.KRides"
   ```

   **In Firebase Console:**
   - Go to Project Settings
   - Check Android app package name: `com.eluwaiz.KRides`

2. **If they don't match:**
   - Update Firebase Console to match your app.json
   - OR update app.json to match Firebase (requires rebuild)
   - Download new google-services.json

---

### Issue 5: OAuth Consent Screen Not Configured

**Symptoms:**
- Error: "Access blocked: This app's request is invalid"
- OAuth consent screen error

**Solution:**

1. **Configure OAuth Consent Screen:**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Select project: `kampusride`
   - Go to **APIs & Services** → **OAuth consent screen**
   - Set **User Type**: External (or Internal if G Suite)
   - Fill in required fields:
     - App name: KRides
     - User support email: minatoventuresinc@gmail.com
     - Developer contact: minatoventuresinc@gmail.com
   - Add scopes:
     - `email`
     - `profile`
     - `openid`
   - Save and continue

2. **Add test users (if in testing mode):**
   - Add your test email addresses
   - Save

---

### Issue 6: Google Sign-In API Not Enabled

**Symptoms:**
- Error: "API not enabled"
- Sign-in fails silently

**Solution:**

1. **Enable Google Sign-In API:**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Select project: `kampusride`
   - Go to **APIs & Services** → **Library**
   - Search for "Google Sign-In API"
   - Click **Enable**

2. **Also enable:**
   - Google+ API (legacy, but sometimes needed)
   - Identity Toolkit API

---

### Issue 7: Expo/React Native Google Sign-In Version Issues

**Symptoms:**
- Build errors
- TypeScript errors
- Sign-in doesn't work after update

**Solution:**

1. **Check current version:**
   ```json
   "@react-native-google-signin/google-signin": "^16.0.0"
   ```

2. **Reinstall if needed:**
   ```powershell
   npm uninstall @react-native-google-signin/google-signin
   npm install @react-native-google-signin/google-signin@16.0.0
   ```

3. **Rebuild the app:**
   ```powershell
   # For development
   npx expo run:android

   # For EAS Build
   eas build --platform android --profile preview
   ```

---

## 🧪 Testing & Debugging

### Step 1: Check Console Logs

Add detailed logging to `useGoogleAuth.js` (already present):

```javascript
console.log('🔐 Starting Google Sign-In...');
console.log('📦 Google Sign-In response:', JSON.stringify(userInfo, null, 2));
console.log('✅ Google Sign-In successful:', email);
```

### Step 2: Test Sign-In Flow

1. Open the app
2. Navigate to Login screen
3. Tap "Continue with Google"
4. Check console for errors:
   - `❌ Google Sign-In Error:` - Main error
   - Look for specific error codes

### Step 3: Common Error Codes

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `SIGN_IN_CANCELLED` | User cancelled | Normal behavior |
| `IN_PROGRESS` | Already signing in | Wait or restart app |
| `PLAY_SERVICES_NOT_AVAILABLE` | No Play Services | Update Play Services |
| `DEVELOPER_ERROR` | Configuration issue | Check SHA-1 and package name |
| `NETWORK_ERROR` | No internet | Check connection |

---

## 🚀 Step-by-Step Fix (Recommended)

Follow these steps in order:

### Step 1: Get Your SHA-1 Fingerprint

```powershell
# For EAS Build (most likely what you need)
cd c:\Users\Administrator\Documents\REACTNATIVE\KRides
keytool -list -v -keystore @uwaiz__krides.jks -alias @uwaiz__krides
```

**Copy the SHA-1 fingerprint** (looks like: `7B:BD:36:87:F1:41:08:3B:D0:19:09:E7:4B:FE:3D:B6:5E:47:0C:CD`)

### Step 2: Add SHA-1 to Firebase

1. Go to https://console.firebase.google.com
2. Select `kampusride` project
3. Click gear icon → **Project Settings**
4. Scroll to **Your apps**
5. Click on Android app (`com.eluwaiz.KRides`)
6. Under **SHA certificate fingerprints**, click **Add fingerprint**
7. Paste your SHA-1
8. Click **Save**

### Step 3: Download New google-services.json

1. In same screen, click **Download google-services.json**
2. Replace file in project root: `c:\Users\Administrator\Documents\REACTNATIVE\KRides\google-services.json`

### Step 4: Verify Web Client ID

1. In Firebase Console, go to **Project Settings**
2. Scroll to **Web API Key**
3. Copy the Web Client ID (should start with your project number)
4. Verify it matches the one in `App.js` line 54:
   ```javascript
   webClientId: '1054058095059-6j788gaiqicduqgt1jo322hsvb7ums7b.apps.googleusercontent.com'
   ```

### Step 5: Rebuild Your App

```powershell
# If using EAS Build
eas build --platform android --profile preview

# If running locally
npx expo run:android
```

### Step 6: Test

1. Install the new build
2. Try Google Sign-In
3. Check console logs for errors

---

## 🔍 Advanced Debugging

### Check Google Sign-In Configuration

Add this to your Login.js to debug:

```javascript
const debugGoogleConfig = async () => {
  try {
    const config = await GoogleSignin.getTokens();
    console.log('Google Config:', config);
  } catch (error) {
    console.log('Config Error:', error);
  }
};
```

### Check Firebase Auth State

```javascript
import { FIREBASE_AUTH } from '../../firebaseConfig';

FIREBASE_AUTH.onAuthStateChanged((user) => {
  console.log('Firebase Auth State:', user ? user.email : 'Not signed in');
});
```

---

## 📱 Platform-Specific Issues

### Android

**Issue:** Google Sign-In works in development but not in production build

**Solution:**
- Add **both** debug and release SHA-1 to Firebase
- Ensure google-services.json is up to date
- Check that package name matches everywhere

### iOS (Future)

**Requirements:**
- GoogleService-Info.plist
- URL Schemes configured
- Reverse Client ID

---

## ✅ Verification Checklist

After applying fixes, verify:

- [ ] SHA-1 fingerprint added to Firebase Console
- [ ] google-services.json downloaded and replaced
- [ ] Web Client ID matches in App.js
- [ ] Package name is `com.eluwaiz.KRides` everywhere
- [ ] OAuth consent screen configured
- [ ] Google Sign-In API enabled
- [ ] App rebuilt with new configuration
- [ ] Google Sign-In works on test device

---

## 🆘 Still Not Working?

### Check These:

1. **Firebase Authentication Enabled:**
   - Firebase Console → Authentication → Sign-in method
   - Ensure "Google" is **Enabled**

2. **Authorized Domains:**
   - Firebase Console → Authentication → Settings → Authorized domains
   - Add any custom domains if needed

3. **API Quotas:**
   - Google Cloud Console → APIs & Services → Quotas
   - Check if you've hit any limits

4. **Billing:**
   - Some Google APIs require billing enabled
   - Check Google Cloud Console → Billing

---

## 📞 Get Help

If you're still stuck, provide these details:

1. **Error message** from console
2. **Platform** (Android/iOS)
3. **Build type** (development/preview/production)
4. **When it stopped working**
5. **What you changed recently**

---

## 🔗 Useful Links

- [Firebase Console](https://console.firebase.google.com)
- [Google Cloud Console](https://console.cloud.google.com)
- [React Native Google Sign-In Docs](https://github.com/react-native-google-signin/google-signin)
- [Firebase Auth Docs](https://firebase.google.com/docs/auth)

---

**Last Updated:** December 18, 2025  
**Status:** Active Troubleshooting Guide
