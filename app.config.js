const appJson = require('./app.json');

// app.config.js overrides app.json so we can inject env vars at build time.
// The Google Maps API key is NOT stored in app.json (which is committed).
// It is injected from process.env.GOOGLE_MAPS_API_KEY, which comes from:
//   - Local dev: .env file (gitignored)
//   - EAS builds: eas.json env section or EAS Secrets (preferred for production)

module.exports = {
    ...appJson.expo,
    android: {
        ...appJson.expo.android,
        config: {
            googleMaps: {
                apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
            },
        },
    },
};
