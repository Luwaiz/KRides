# APK Crash Troubleshooting Guide

## Common Causes of App Crashes After Installation

### ✅ Fixes Already Applied:
1. **Added comprehensive ProGuard rules** for React Native, Firebase, and all dependencies
2. **Enabled MultiDex** support for large app size
3. **Added Kotlin version configuration** to prevent version conflicts

---

## 🔍 Debugging Steps

### Step 1: Connect Device and View Logs

**Using ADB (Android Debug Bridge):**

```bash
# Connect your Android device via USB (with USB debugging enabled)

# Check if device is connected
adb devices

# View live crash logs
adb logcat | grep -i "fatal\|exception\|crash\|error"

# Or on Windows PowerShell:
adb logcat | Select-String -Pattern "FATAL|Exception|crash|ERROR"

# Save logs to file
adb logcat > crash_log.txt
```

**Look for lines containing:**
- `FATAL EXCEPTION`
- `AndroidRuntime`
- `Process: com.eluwaiz.KRides`

---

### Step 2: Common Crash Causes & Solutions

#### 1️⃣ **Firebase Configuration Missing**

**Symptom:** App crashes immediately on launch
**Cause:** `google-services.json` file missing or invalid

**Solution:**
```bash
# Check if file exists
ls android/app/google-services.json

# If missing, download from Firebase Console:
# 1. Go to Firebase Console → Project Settings
# 2. Click "Add app" or select your Android app
# 3. Download google-services.json
# 4. Place in: android/app/google-services.json
```

#### 2️⃣ **Network Security Configuration**

**Symptom:** App crashes when trying to connect to Firebase/API
**Cause:** Android blocks cleartext HTTP traffic by default

**Solution:** Already configured in `AndroidManifest.xml`

#### 3️⃣ **Missing Permissions**

**Symptom:** Crash when accessing location, camera, etc.

**Current Permissions:**
- ✅ INTERNET
- ✅ READ_EXTERNAL_STORAGE
- ✅ WRITE_EXTERNAL_STORAGE
- ⚠️ Missing: Location permissions (if using maps)

**Add to `android/app/src/main/AndroidManifest.xml`:**
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

#### 4️⃣ **ProGuard/R8 Issues**

**Symptom:** Works in debug, crashes in release
**Cause:** Code obfuscation removing needed classes

**Solution:** ✅ Already added comprehensive ProGuard rules

**To disable ProGuard completely (for testing):**
```gradle
// In android/app/build.gradle
buildTypes {
    release {
        minifyEnabled false  // Change to false
    }
}
```

#### 5️⃣ **Hermes Engine Issues**

**Symptom:** App crashes on JavaScript execution

**Check current setting:**
```properties
# In android/gradle.properties
hermesEnabled=true
```

**Try disabling Hermes (for testing):**
```properties
hermesEnabled=false
```

Then rebuild:
```bash
cd android
./gradlew clean
cd ..
eas build -p android --profile preview
```

#### 6️⃣ **MultiDex Issues**

**Symptom:** "NoClassDefFoundError" or "ClassNotFoundException"
**Cause:** App exceeds 64K method limit

**Solution:** ✅ Already enabled `multiDexEnabled true`

**Verify in `android/app/build.gradle`:**
```gradle
defaultConfig {
    multiDexEnabled true
}
```

#### 7️⃣ **Native Module Issues**

**Symptom:** Crash with "could not find native module"

**Solution:** Rebuild native modules
```bash
cd android
./gradlew clean
cd ..
npx expo prebuild --clean
eas build -p android --profile preview
```

#### 8️⃣ **Wrong Build Variant**

**Symptom:** Debug features causing crashes in release

**Check EAS build profile:**
```json
// eas.json
{
  "preview": {
    "android": {
      "buildType": "apk",
      "gradleCommand": ":app:assembleRelease"
    }
  }
}
```

---

### Step 3: Test Different Build Configurations

#### Option A: Development Build (Easier to Debug)
```bash
eas build -p android --profile development
```

#### Option B: Local Build (Fastest for Testing)
```bash
# Debug build (no minification)
cd android
./gradlew assembleDebug

# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

#### Option C: Release Build with Logs
```bash
# Build release but keep debug symbols
cd android
./gradlew assembleRelease --stacktrace --info
```

---

### Step 4: Check Firebase Configuration

**Verify google-services.json:**
```bash
# File should exist at:
android/app/google-services.json

# Check package name matches:
# In google-services.json: "package_name": "com.eluwaiz.KRides"
# In AndroidManifest.xml: package="com.eluwaiz.KRides"
```

**Verify Firebase dependencies in `android/app/build.gradle`:**
Should have:
```gradle
dependencies {
    implementation platform('com.google.firebase:firebase-bom:32.x.x')
    implementation 'com.google.firebase:firebase-analytics'
    implementation 'com.google.firebase:firebase-auth'
    implementation 'com.google.firebase:firebase-firestore'
}
```

---

### Step 5: Environment Variables

**Check if environment variables are properly configured:**

```bash
# In .env or eas.json
MAPBOX_DOWNLOADS_TOKEN=your_token
FIREBASE_API_KEY=your_key
```

**Update `eas.json`:**
```json
{
  "build": {
    "preview": {
      "android": {
        "env": {
          "MAPBOX_DOWNLOADS_TOKEN": "your_token_here"
        }
      }
    }
  }
}
```

---

### Step 6: Check App Size

**Symptom:** Installation fails or crashes
**Cause:** APK too large

```bash
# Check APK size
ls -lh *.apk

# If > 100MB, reduce by:
# 1. Enable ProGuard
# 2. Remove unused resources
# 3. Use Android App Bundle (.aab) instead of APK
```

---

## 🛠️ Quick Fix Checklist

Run through this checklist:

- [ ] **google-services.json** exists in `android/app/`
- [ ] Package name matches in all files
- [ ] **MultiDex** enabled ✅
- [ ] **ProGuard rules** added ✅
- [ ] USB debugging enabled on device
- [ ] Device has enough storage space
- [ ] Android version is compatible (minSdkVersion 24+)
- [ ] **Kotlin version** is 1.9.25 ✅
- [ ] Clean build attempted
- [ ] Checked ADB logs for specific error

---

## 🔧 Emergency Fixes

### Fix 1: Complete Clean Build
```bash
# Clean everything
cd android
./gradlew clean
cd ..
rm -rf node_modules
rm -rf android/build
rm -rf android/app/build
npm install
npx expo prebuild --clean
eas build -p android --profile preview
```

### Fix 2: Disable All Optimizations
```gradle
// android/app/build.gradle
buildTypes {
    release {
        minifyEnabled false
        shrinkResources false
        debuggable true  // Temporarily for debugging
    }
}
```

### Fix 3: Use Debug Build
```bash
cd android
./gradlew assembleDebug
# Install: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 📱 Device-Specific Issues

### Samsung Devices
- Disable "Optimize app" in settings
- Clear cache: Settings → Apps → KRides → Clear Cache

### Xiaomi/MIUI
- Disable "MIUI optimization"
- Give all permissions manually

### Huawei
- May need HMS instead of GMS for Firebase

---

## 📊 Log Analysis

**Common Error Patterns:**

1. **"ClassNotFoundException"** → Missing dependency or ProGuard issue
2. **"NoClassDefFoundError"** → MultiDex issue
3. **"UnsatisfiedLinkError"** → Native library issue
4. **"NullPointerException in MainActivity"** → Initialization issue
5. **"Firebase app not initialized"** → google-services.json issue
6. **"Network error"** → Internet permission or Firebase config

---

## 🎯 Most Likely Cause

Based on your setup, the most likely causes are:

1. **Missing google-services.json** (Firebase)
2. **ProGuard removing needed classes** (already fixed)
3. **Hermes engine issue** (try disabling)
4. **Network security config** (check Firebase connectivity)

---

## 📞 Next Steps

1. **Connect device via USB**
2. **Enable USB debugging**
3. **Run:** `adb logcat > crash_log.txt`
4. **Install APK and open app**
5. **Check crash_log.txt for errors**
6. **Share the error message for specific fix**

---

## 🔗 Useful Commands

```bash
# View connected devices
adb devices

# View app logs
adb logcat | grep KRides

# Clear app data
adb shell pm clear com.eluwaiz.KRides

# Uninstall app
adb uninstall com.eluwaiz.KRides

# Install APK
adb install app.apk

# View installed packages
adb shell pm list packages | grep krides
```

---

**Last Updated:** November 16, 2025
