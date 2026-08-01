const appJson = require('./app.json');

// app.config.js overrides app.json so we can inject env vars at build time.
// The Google Maps API key is NOT stored in app.json (which is committed).
// It is injected from process.env.GOOGLE_MAPS_API_KEY, which comes from:
//   - Local dev: .env file (gitignored)
//   - EAS builds: eas.json env section or EAS Secrets (preferred for production)

const mapsKey = process.env.GOOGLE_MAPS_API_KEY || '';

// google-services.json / GoogleService-Info.plist are gitignored (they carry
// live Firebase project credentials) — EAS Build only uploads git-tracked
// files, so it can't see them at the paths app.json points to. Locally they
// still exist on disk, so the appJson fallback path works for local builds.
// For EAS Build, set GOOGLE_SERVICES_JSON / GOOGLE_SERVICE_INFO_PLIST as
// "file" type environment variables (eas env:create --type file) — EAS
// writes the uploaded file to disk at build time and sets the env var to
// that local path, which is exactly what googleServicesFile expects.
const googleServicesJson = process.env.GOOGLE_SERVICES_JSON || appJson.expo.android.googleServicesFile;
const googleServiceInfoPlist = process.env.GOOGLE_SERVICE_INFO_PLIST || appJson.expo.ios.googleServicesFile;

module.exports = {
    ...appJson.expo,
    android: {
        ...appJson.expo.android,
        googleServicesFile: googleServicesJson,
        config: {
            googleMaps: {
                apiKey: mapsKey,
            },
        },
    },
    ios: {
        ...appJson.expo.ios,
        googleServicesFile: googleServiceInfoPlist,
        config: {
            googleMapsApiKey: mapsKey,
        },
    },
};
