import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import Toolbar from '../components/Toolbar';

const FILTER_OPTIONS = [
    { value: 'all', label: 'All types' },
    { value: 'card', label: 'Card refunds' },
    { value: 'wallet', label: 'Wallet refunds' },
];

export default function RefundReview() {
    const [rides, setRides] = useState(null);
    const [error, setError] = useState('');
    const [notes, setNotes] = useState({});
    const [busyId, setBusyId] = useState(null);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');

    const load = async () => {
        setError('');
        try {
            const data = await api.getRefundReview();
            setRides(data.rides);
        } catch (err) {
            setError(err.message);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const resolve = async (rideId) => {
        setBusyId(rideId);
        setError('');
        try {
            await api.resolveRefund(rideId, notes[rideId] || '');
            await load();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const filtered = useMemo(() => {
        if (!rides) return null;
        const q = search.trim().toLowerCase();
        return rides.filter((ride) => {
            const isWallet = !!ride.walletRefundStatus;
            if (filter === 'card' && isWallet) return false;
            if (filter === 'wallet' && !isWallet) return false;
            if (!q) return true;
            const haystack = [ride.customerName, ride.rideId, ride.transactionId, ride.refundReviewReason]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(q);
        });
    }, [rides, search, filter]);

    if (!rides) return <p className="loading">Loading…</p>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Refund Manual Review</h2>
                    <p className="hint">
                        Rides where the automatic refund retry gave up after 3 attempts. Check Flutterwave's dashboard for
                        the transaction, refund it manually if needed, then note what you did and mark resolved.
                    </p>
                </div>
            </div>

            {rides.length > 0 && (
                <Toolbar
                    search={search}
                    onSearchChange={setSearch}
                    searchPlaceholder="Search by customer, ride ID, transaction ID…"
                    filter={{ value: filter, onChange: setFilter, options: FILTER_OPTIONS }}
                />
            )}

            {error && <p className="error">{error}</p>}

            {rides.length === 0 ? (
                <p className="empty">Nothing needs review.</p>
            ) : filtered.length === 0 ? (
                <p className="empty">No refunds match your search.</p>
            ) : (
                filtered.map((ride) => (
                    <div key={ride.rideId} className="card">
                        <div className="card-header">
                            <div>
                                <strong>{ride.customerName || 'Unknown customer'}</strong>
                                <div className="muted mono">{ride.rideId}</div>
                            </div>
                            <span className="amount">₦{ride.amount.toLocaleString('en-NG')}</span>
                        </div>
                        <p><strong>Reason:</strong> {ride.refundReviewReason || '—'}</p>
                        <p className="muted">
                            Card refund: {ride.refundStatus || '—'} · Wallet refund: {ride.walletRefundStatus || '—'}
                            {ride.transactionId && <> · Flutterwave txn: {ride.transactionId}</>}
                        </p>
                        <textarea
                            placeholder="What did you do to resolve this? (e.g. manually refunded via Flutterwave dashboard)"
                            value={notes[ride.rideId] || ''}
                            onChange={(e) => setNotes({ ...notes, [ride.rideId]: e.target.value })}
                        />
                        <button disabled={busyId === ride.rideId} onClick={() => resolve(ride.rideId)}>
                            {busyId === ride.rideId ? 'Saving…' : 'Mark Resolved'}
                        </button>
                    </div>
                ))
            )}
        </div>
    );
}
