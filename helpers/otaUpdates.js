import * as Updates from 'expo-updates';

export async function checkAndFetchUpdate() {
    if (__DEV__ || !Updates.isEnabled) return false;

    try {
        const { isAvailable } = await Updates.checkForUpdateAsync();
        if (!isAvailable) return false;

        await Updates.fetchUpdateAsync();
        return true;
    } catch (err) {
        console.warn('⚠️ OTA update check failed:', err.message);
        return false;
    }
}

export function applyFetchedUpdate() {
    return Updates.reloadAsync();
}
