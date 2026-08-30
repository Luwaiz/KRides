const API_BASE = import.meta.env.VITE_API_BASE_URL;
const STORAGE_KEY = 'krides_admin_key';

function getKey() {
    return localStorage.getItem(STORAGE_KEY) || '';
}

function setKey(key) {
    localStorage.setItem(STORAGE_KEY, key);
}

function clearKey() {
    localStorage.removeItem(STORAGE_KEY);
}

async function request(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'x-admin-key': getKey(),
            ...(options.headers || {}),
        },
    });

    if (res.status === 401) {
        clearKey();
        throw new Error('Session expired — please log in again.');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
}

async function login(password) {
    const res = await fetch(`${API_BASE}/admin-api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Login failed');
    setKey(password);
    return data;
}

export const api = {
    login,
    getKey,
    setKey,
    clearKey,
    getPendingPayouts: () => request('/admin-api/payouts/pending'),
    markPaid: (rideIds) =>
        request('/admin-api/payouts/mark-paid', {
            method: 'POST',
            body: JSON.stringify({ rideIds }),
        }),
    getRefundReview: () => request('/admin-api/refunds/review'),
    resolveRefund: (rideId, note) =>
        request('/admin-api/refunds/resolve', {
            method: 'POST',
            body: JSON.stringify({ rideId, note }),
        }),
    getOrphanedCharges: () => request('/admin-api/orphaned-charges'),
    resolveOrphanedCharge: (chargeId, note) =>
        request('/admin-api/orphaned-charges/resolve', {
            method: 'POST',
            body: JSON.stringify({ chargeId, note }),
        }),
    getReports: () => request('/admin-api/reports'),
    resolveReport: (reportId, note) =>
        request('/admin-api/reports/resolve', {
            method: 'POST',
            body: JSON.stringify({ reportId, note }),
        }),
    reopenReport: (reportId) =>
        request('/admin-api/reports/reopen', {
            method: 'POST',
            body: JSON.stringify({ reportId }),
        }),
    getDrivers: () => request('/admin-api/drivers'),
    createDriver: (driver) =>
        request('/admin-api/drivers/create', {
            method: 'POST',
            body: JSON.stringify(driver),
        }),
    resendDriverWelcomeEmail: (driverId) =>
        request('/admin-api/drivers/resend-welcome-email', {
            method: 'POST',
            body: JSON.stringify({ driverId }),
        }),
};
