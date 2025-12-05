const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Environment Configuration...\n');

// Check .env file
const envPath = path.join(__dirname, '..', '.env');
const hasEnvFile = fs.existsSync(envPath);

// Check eas.json
const easPath = path.join(__dirname, '..', 'eas.json');
let easConfig = null;

try {
    const easContent = fs.readFileSync(easPath, 'utf8');
    easConfig = JSON.parse(easContent);
} catch (error) {
    console.log('❌ Could not read eas.json');
}

const requiredEnvVars = [
    'FIREBASE_API_KEY',
    'FIREBASE_AUTH_DOMAIN',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_STORAGE_BUCKET',
    'FIREBASE_MESSAGING_SENDER_ID',
    'FIREBASE_APP_ID',
    'GOOGLE_MAPS_API_KEY',
];

let allConfigured = true;

console.log('📋 Checking configuration sources:\n');
if (hasEnvFile) {
    console.log('✅ .env file exists');
} else {
    console.log('⚠️  .env file not found (this is OK if using eas.json)');
}

// Check eas.json
if (easConfig) {
    console.log('✅ eas.json found\n');

    // Check development build config
    if (easConfig.build && easConfig.build.development && easConfig.build.development.env) {
        console.log('📦 Development Build Environment:');
        const devEnv = easConfig.build.development.env;

        requiredEnvVars.forEach((varName) => {
            if (devEnv[varName]) {
                console.log(`  ✅ ${varName}`);
            } else {
                console.log(`  ❌ Missing: ${varName}`);
                allConfigured = false;
            }
        });
    }

    console.log('');

    // Check preview build config
    if (easConfig.build && easConfig.build.preview && easConfig.build.preview.env) {
        console.log('📦 Preview Build Environment:');
        const previewEnv = easConfig.build.preview.env;

        requiredEnvVars.forEach((varName) => {
            if (previewEnv[varName]) {
                console.log(`  ✅ ${varName}`);
            } else {
                console.log(`  ❌ Missing: ${varName}`);
                allConfigured = false;
            }
        });
    }
} else {
    console.log('❌ eas.json not found\n');
    allConfigured = false;
}

console.log('');

if (allConfigured) {
    console.log('✅ All environment variables are configured!');
    console.log('\n💡 Note: Environment variables are configured in eas.json for builds.');
    process.exit(0);
} else {
    console.log('⚠️  Some environment variables may be missing.');
    console.log('\n💡 For EAS builds, configure variables in eas.json');
    console.log('💡 For local development, create a .env file');
    process.exit(1);
}
