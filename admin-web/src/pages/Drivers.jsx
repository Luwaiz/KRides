import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import Toolbar from '../components/Toolbar';

const EMPTY_FORM = { fullName: '', phone: '', email: '', vehicleId: '' };

const FILTER_OPTIONS = [
    { value: 'all', label: 'All drivers' },
    { value: 'verified', label: 'Bank verified' },
    { value: 'not_verified', label: 'Bank not set up' },
];

export default function Drivers() {
    const [drivers, setDrivers] = useState(null);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');

    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const [resendingId, setResendingId] = useState(null);
    const [resendMessage, setResendMessage] = useState({});

    const load = async () => {
        setError('');
        try {
            const data = await api.getDrivers();
            setDrivers(data.drivers);
        } catch (err) {
            setError(err.message);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const setField = (field) => (e) => setForm({ ...form, [field]: e.target.value });

    const submit = async (e) => {
        e.preventDefault();
        setCreateError('');
        setCreating(true);
        try {
            const data = await api.createDriver(form);
            setSuccessMessage(
                data.emailSent
                    ? `${form.fullName} was added — a set-password email was sent to ${form.email}.`
                    : `${form.fullName} was added, but the welcome email failed to send (${data.emailFailReason}). Use "Send Password Reset Email" below once you're ready to retry.`
            );
            setForm(EMPTY_FORM);
            setShowForm(false);
            await load();
        } catch (err) {
            setCreateError(err.message);
        } finally {
            setCreating(false);
        }
    };

    const resend = async (driverId) => {
        setResendingId(driverId);
        setResendMessage((m) => ({ ...m, [driverId]: '' }));
        try {
            const data = await api.resendDriverWelcomeEmail(driverId);
            setResendMessage((m) => ({
                ...m,
                [driverId]: data.emailSent ? 'Sent.' : `Failed (${data.emailFailReason}).`,
            }));
        } catch (err) {
            setResendMessage((m) => ({ ...m, [driverId]: err.message }));
        } finally {
            setResendingId(null);
        }
    };

    const filtered = useMemo(() => {
        if (!drivers) return null;
        const q = search.trim().toLowerCase();
        return drivers.filter((d) => {
            if (filter === 'verified' && !d.bankDetailsVerified) return false;
            if (filter === 'not_verified' && d.bankDetailsVerified) return false;
            if (!q) return true;
            const haystack = [d.fullName, d.phone, d.email, d.vehicleId].filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(q);
        });
    }, [drivers, search, filter]);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Drivers</h2>
                    <p className="hint">
                        Everyone who's ever signed up to drive, self-registered through the app or added here.
                        Creating an account here works the same way — the driver sets their own password by email,
                        then logs in through the app as normal.
                    </p>
                </div>
                <button
                    onClick={() => {
                        setShowForm((s) => !s);
                        setCreateError('');
                        setSuccessMessage('');
                    }}
                >
                    {showForm ? 'Cancel' : 'Add Driver'}
                </button>
            </div>

            {successMessage && <p className="success">{successMessage}</p>}

            {showForm && (
                <form onSubmit={submit} className="card form-card">
                    {createError && <p className="error">{createError}</p>}
                    <label>
                        Full Name
                        <input type="text" value={form.fullName} onChange={setField('fullName')} required />
                    </label>
                    <label>
                        Phone Number
                        <input type="tel" placeholder="08012345678" value={form.phone} onChange={setField('phone')} required />
                    </label>
                    <label>
                        Email
                        <input type="email" value={form.email} onChange={setField('email')} required />
                    </label>
                    <label>
                        Vehicle ID
                        <input type="text" value={form.vehicleId} onChange={setField('vehicleId')} required />
                    </label>
                    <button type="submit" disabled={creating}>
                        {creating ? 'Creating…' : 'Create Driver Account'}
                    </button>
                </form>
            )}

            {drivers === null ? (
                <p className="loading">Loading…</p>
            ) : (
                <>
                    {drivers.length > 0 && (
                        <Toolbar
                            search={search}
                            onSearchChange={setSearch}
                            searchPlaceholder="Search by name, phone, email, vehicle ID…"
                            filter={{ value: filter, onChange: setFilter, options: FILTER_OPTIONS }}
                        />
                    )}

                    {error && <p className="error">{error}</p>}

                    {drivers.length === 0 ? (
                        <p className="empty">No drivers yet.</p>
                    ) : filtered.length === 0 ? (
                        <p className="empty">No drivers match your search.</p>
                    ) : (
                        filtered.map((d) => (
                            <div key={d.driverId} className="card">
                                <div className="card-header">
                                    <div>
                                        <strong>{d.fullName || 'Unknown name'}</strong>
                                        <div className="muted">
                                            {d.phone || 'no phone'} · {d.email || 'no email'} · {d.vehicleId || 'no vehicle ID'}
                                        </div>
                                    </div>
                                    <span className={d.bankDetailsVerified ? 'badge badge-resolved' : 'badge badge-open'}>
                                        {d.bankDetailsVerified ? 'Bank verified' : 'Bank not set up'}
                                    </span>
                                </div>
                                <p className="muted">
                                    {d.createdByAdmin ? 'Added by admin' : 'Self-registered'}
                                    {d.createdAt && ` · ${new Date(d.createdAt).toLocaleDateString('en-NG')}`}
                                </p>
                                <div className="card-actions" style={{ justifyContent: 'flex-start', gap: 10 }}>
                                    <button disabled={resendingId === d.driverId} onClick={() => resend(d.driverId)}>
                                        {resendingId === d.driverId ? 'Sending…' : 'Send Password Reset Email'}
                                    </button>
                                    {resendMessage[d.driverId] && <span className="muted">{resendMessage[d.driverId]}</span>}
                                </div>
                            </div>
                        ))
                    )}
                </>
            )}
        </div>
    );
}
