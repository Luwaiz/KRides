import AsyncStorage from '@react-native-async-storage/async-storage';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;
const KEY_PREFIX = 'rate_limit_';

async function getEntry(identifier) {
    try {
        const raw = await AsyncStorage.getItem(KEY_PREFIX + identifier);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

async function setEntry(identifier, entry) {
    try {
        await AsyncStorage.setItem(KEY_PREFIX + identifier, JSON.stringify(entry));
    } catch {
        // Non-fatal — fail open so a storage error never locks the user out
    }
}

export async function checkRateLimit(identifier) {
    const now = Date.now();
    const entry = await getEntry(identifier);

    if (!entry) return { blocked: false };

    if (now - entry.windowStart > WINDOW_MS) {
        // Window expired — remove stale key
        AsyncStorage.removeItem(KEY_PREFIX + identifier).catch(() => {});
        return { blocked: false };
    }

    if (entry.count >= MAX_ATTEMPTS) {
        const minutesRemaining = Math.ceil((WINDOW_MS - (now - entry.windowStart)) / 60000);
        return { blocked: true, minutesRemaining };
    }

    return { blocked: false };
}

export async function recordAttempt(identifier) {
    const now = Date.now();
    const entry = await getEntry(identifier);

    if (!entry || now - entry.windowStart > WINDOW_MS) {
        await setEntry(identifier, { count: 1, windowStart: now });
    } else {
        await setEntry(identifier, { count: entry.count + 1, windowStart: entry.windowStart });
    }
}

export async function clearAttempts(identifier) {
    try {
        await AsyncStorage.removeItem(KEY_PREFIX + identifier);
    } catch {
        // Non-fatal
    }
}
