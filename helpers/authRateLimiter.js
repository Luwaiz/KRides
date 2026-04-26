const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

// identifier (email or phone) → { count, windowStart }
const attempts = new Map();

export function checkRateLimit(identifier) {
    const now = Date.now();
    const entry = attempts.get(identifier);

    if (!entry || now - entry.windowStart > WINDOW_MS) {
        return { blocked: false };
    }

    if (entry.count >= MAX_ATTEMPTS) {
        const minutesRemaining = Math.ceil((WINDOW_MS - (now - entry.windowStart)) / 60000);
        return { blocked: true, minutesRemaining };
    }

    return { blocked: false };
}

export function recordAttempt(identifier) {
    const now = Date.now();
    const entry = attempts.get(identifier);

    if (!entry || now - entry.windowStart > WINDOW_MS) {
        attempts.set(identifier, { count: 1, windowStart: now });
    } else {
        attempts.set(identifier, { count: entry.count + 1, windowStart: entry.windowStart });
    }
}

export function clearAttempts(identifier) {
    attempts.delete(identifier);
}
