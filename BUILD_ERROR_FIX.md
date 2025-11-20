# 🔧 Build Error Fix - Mapbox Plugin Configuration

**Date:** November 20, 2025  
**Error:** `Cannot destructure property 'RNMapboxMapsImpl' of 'undefined' as it is undefined`  
**Status:** ✅ FIXED

---

## ❌ The Problem

When we removed the hardcoded Mapbox download token from `app.json`, we accidentally removed the entire plugin configuration object:

**What we did (too aggressive):**
```json
"plugins": [
  "expo-font",
  "@rnmapbox/maps"  // ❌ Missing required configuration
]
```

**Error message:**
```
Cannot destructure property 'RNMapboxMapsImpl' of 'undefined' as it is undefined.
Error: build command failed.
```

**Why it failed:**
- The `@rnmapbox/maps` plugin requires a configuration object
- It expects `RNMapboxMapsImpl` to be defined
- Without this, the plugin can't initialize properly

---

## ✅ The Fix

**Updated `app.json`:**
```json
"plugins": [
  "expo-font",
  [
    "@rnmapbox/maps",
    {
      "RNMapboxMapsImpl": "mapbox"
    }
  ]
]
```

**What this does:**
- ✅ Provides required `RNMapboxMapsImpl` configuration
- ✅ Sets implementation to "mapbox" (standard value)
- ✅ Does NOT include the download token (still secure!)
- ✅ Download token is provided via `MAPBOX_DOWNLOADS_TOKEN` in `eas.json`

---

## 🔐 Security Status

**Still Secure:** ✅
- Download token (`sk.eyJ...`) is NOT in `app.json`
- Token is only in `eas.json` environment variables
- Only the implementation type is specified in `app.json`

**Before (insecure):**
```json
{
  "RNMapboxMapsDownloadToken": "sk.eyJ...",  // ❌ Secret exposed
  "RNMapboxMapsImpl": "mapbox"
}
```

**After (secure):**
```json
{
  "RNMapboxMapsImpl": "mapbox"  // ✅ Only config, no secrets
}
```

---

## ✅ Verification

**Config validation passed:**
```bash
$ npx expo config --json
# Exit code: 0 ✅
```

**Plugin loaded successfully:**
```json
"pluginHistory": {
  "@rnmapbox/maps": {
    "name": "@rnmapbox/maps",
    "version": "10.1.38"
  }
}
```

---

## 🚀 Ready to Build

You can now run the build command again:

```bash
eas build -p android --profile preview
```

**Expected result:**
- ✅ Config reads successfully
- ✅ Mapbox plugin initializes
- ✅ Download token loaded from environment
- ✅ Build proceeds normally

---

## 📝 Summary

| Item | Status |
|------|--------|
| Mapbox plugin config | ✅ Fixed |
| Security maintained | ✅ No secrets in app.json |
| Config validation | ✅ Passed |
| Ready to build | ✅ Yes |

---

**Next Step:** Run `eas build -p android --profile preview` again! 🚀
