import * as Updates from 'expo-updates';

/**
 * expo-updates already checks for and downloads a new update automatically
 * on every cold start (the default `checkAutomatically: ON_LOAD` behavior
 * configured via app.json's "updates" block) — but it only *applies* that
 * update on the *next* cold start after this one. For an app people tend to
 * leave open for a long time (a ride in progress, a driver waiting for
 * requests), that could mean a fix sits downloaded but inactive for days.
 *
 * This lets the app actively ask "is there something newer?" (e.g. when it
 * comes back to the foreground) and surface it immediately via
 * components/UpdateBanner.js instead of waiting on a cold start nobody
 * triggers.
 *
 * No-ops safely in Expo Go / dev client / local dev builds, where
 * Updates.isEnabled is false and calling these would throw.
 *
 * @returns {Promise<boolean>} true if a new update was downloaded and is
 *   ready to apply via Updates.reloadAsync()
 */
export async function checkAndFetchUpdate() {
    if (__DEV__ || !Updates.isEnabled) return false;

    try {
        const { isAvailable } = await Updates.checkForUpdateAsync();
        if (!isAvailable) return false;

        await Updates.fetchUpdateAsync();
        return true;
    } catch (err) {
        // Network hiccup, no channel configured yet, etc. — never worth
        // interrupting the app over; it'll get picked up next launch anyway.
        console.warn('⚠️ OTA update check failed:', err.message);
        return false;
    }
}

/** Restarts the app with whatever update was just fetched applied. */
export function applyFetchedUpdate() {
    return Updates.reloadAsync();
}
