const appJson = require('./app.json');


const mapsKey = process.env.GOOGLE_MAPS_API_KEY || '';

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
