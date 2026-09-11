import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import Toolbar from '../components/Toolbar';

export default function OrphanedTopups() {
    const [topups, setTopups] = useState(null);
    const [error, setError] = useState('');
    const [notes, setNotes] = useState({});
    const [busyId, setBusyId] = useState(null);
    const [search, setSearch] = useState('');

    const load = async () => {
        setError('');
        try {
            const data = await api.getOrphanedTopups();
            setTopups(data.topups);
        } catch (err) {
            setError(err.message);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const credit = async (topupId) => {
        setBusyId(topupId);
        setError('');
        try {
            await api.creditOrphanedTopup(topupId);
            await load();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const resolve = async (topupId) => {
        setBusyId(topupId);
        setError('');
        try {
            await api.resolveOrphanedTopup(topupId, notes[topupId] || '');
            await load();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const filtered = useMemo(() => {
        if (!topups) return null;
        const q = search.trim().toLowerCase();
        if (!q) return topups;
        return topups.filter((t) => {
            const haystack = [t.flwTxId, t.txRef, t.userId, t.error].filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(q);
        });
    }, [topups, search]);

    if (!topups) return <p className="loading">Loading…</p>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Orphaned Top-ups</h2>
                    <p className="hint">
                        Flutterwave confirmed a wallet top-up (signature verified) but crediting it failed — e.g. a
                        Firestore hiccup, or the user doc wasn't found. Nothing else retries these once Flutterwave's own
                        retries are exhausted. "Credit Wallet" applies the exact same credit the webhook would have —
                        safe to click even if it turns out to have already landed. Use "Mark Resolved" only when there's
                        no user ID to credit, or you've already fixed it another way.
                    </p>
                </div>
            </div>

            {topups.length > 0 && (
                <Toolbar
                    search={search}
                    onSearchChange={setSearch}
                    searchPlaceholder="Search by transaction ID, tx_ref, user ID…"
                />
            )}

            {error && <p className="error">{error}</p>}

            {topups.length === 0 ? (
                <p className="empty">Nothing unresolved.</p>
            ) : filtered.length === 0 ? (
                <p className="empty">No top-ups match your search.</p>
            ) : (
                filtered.map((t) => (
                    <div key={t.topupId} className="card">
                        <div className="card-header">
                            <div>
                                <strong className="mono">{t.flwTxId}</strong>
                                <div className="muted mono">user: {t.userId || '⚠️ could not be parsed'}</div>
                            </div>
                            <span className="amount">₦{t.amount.toLocaleString('en-NG')}</span>
                        </div>
                        {t.txRef && <p className="muted mono">tx_ref: {t.txRef}</p>}
                        {t.error && <p className="muted">Error: {t.error}</p>}
                        <p className="muted">
                            {t.attempts} attempt{t.attempts === 1 ? '' : 's'}
                            {t.lastAttemptAt ? ` · last ${new Date(t.lastAttemptAt).toLocaleString('en-NG')}` : ''}
                            {t.createdAt ? ` · first seen ${new Date(t.createdAt).toLocaleString('en-NG')}` : ''}
                        </p>
                        <textarea
                            placeholder="Note (only needed for Mark Resolved)"
                            value={notes[t.topupId] || ''}
                            onChange={(e) => setNotes({ ...notes, [t.topupId]: e.target.value })}
                        />
                        <div className="card-actions">
                            <button disabled={busyId === t.topupId || !t.userId} onClick={() => credit(t.topupId)}>
                                {busyId === t.topupId ? 'Working…' : 'Credit Wallet'}
                            </button>
                            <button disabled={busyId === t.topupId} onClick={() => resolve(t.topupId)}>
                                {busyId === t.topupId ? 'Working…' : 'Mark Resolved'}
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
