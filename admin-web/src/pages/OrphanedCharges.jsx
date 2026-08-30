import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import Toolbar from '../components/Toolbar';

export default function OrphanedCharges() {
    const [charges, setCharges] = useState(null);
    const [error, setError] = useState('');
    const [notes, setNotes] = useState({});
    const [busyId, setBusyId] = useState(null);
    const [search, setSearch] = useState('');

    const load = async () => {
        setError('');
        try {
            const data = await api.getOrphanedCharges();
            setCharges(data.charges);
        } catch (err) {
            setError(err.message);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const resolve = async (chargeId) => {
        setBusyId(chargeId);
        setError('');
        try {
            await api.resolveOrphanedCharge(chargeId, notes[chargeId] || '');
            await load();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const filtered = useMemo(() => {
        if (!charges) return null;
        const q = search.trim().toLowerCase();
        if (!q) return charges;
        return charges.filter((c) => {
            const haystack = [c.transactionId, c.customerId, c.rideCreationError, c.refundError]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(q);
        });
    }, [charges, search]);

    if (!charges) return <p className="loading">Loading…</p>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Orphaned Charges</h2>
                    <p className="hint">
                        A customer's card was charged but the ride and the automatic refund both failed — nothing else
                        retries these. Check Flutterwave's dashboard for the transaction and refund it manually if the
                        customer never got their ride, then note what you did and mark resolved.
                    </p>
                </div>
            </div>

            {charges.length > 0 && (
                <Toolbar
                    search={search}
                    onSearchChange={setSearch}
                    searchPlaceholder="Search by transaction ID, customer ID…"
                />
            )}

            {error && <p className="error">{error}</p>}

            {charges.length === 0 ? (
                <p className="empty">Nothing unresolved.</p>
            ) : filtered.length === 0 ? (
                <p className="empty">No charges match your search.</p>
            ) : (
                filtered.map((charge) => (
                    <div key={charge.chargeId} className="card">
                        <div className="card-header">
                            <div>
                                <strong className="mono">{charge.transactionId || 'No transaction ID'}</strong>
                                <div className="muted mono">customer: {charge.customerId || '—'}</div>
                            </div>
                            <span className="amount">₦{charge.amount.toLocaleString('en-NG')}</span>
                        </div>
                        {charge.rideCreationError && (
                            <p className="muted">Ride creation error: {charge.rideCreationError}</p>
                        )}
                        {charge.refundError && (
                            <p className="muted">Refund error: {charge.refundError}</p>
                        )}
                        <p className="muted">
                            {charge.createdAt ? new Date(charge.createdAt).toLocaleString('en-NG') : ''}
                        </p>
                        <textarea
                            placeholder="What did you do to resolve this?"
                            value={notes[charge.chargeId] || ''}
                            onChange={(e) => setNotes({ ...notes, [charge.chargeId]: e.target.value })}
                        />
                        <button disabled={busyId === charge.chargeId} onClick={() => resolve(charge.chargeId)}>
                            {busyId === charge.chargeId ? 'Saving…' : 'Mark Resolved'}
                        </button>
                    </div>
                ))
            )}
        </div>
    );
}
