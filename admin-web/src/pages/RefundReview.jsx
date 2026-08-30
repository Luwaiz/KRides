import { useEffect, useState } from 'react';
import { api } from '../api';

export default function RefundReview() {
    const [rides, setRides] = useState(null);
    const [error, setError] = useState('');
    const [notes, setNotes] = useState({});
    const [busyId, setBusyId] = useState(null);

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

    if (!rides) return <p className="loading">Loading…</p>;

    return (
        <div>
            <h2>Refund Manual Review</h2>
            <p className="hint">
                Rides where the automatic refund retry gave up after 3 attempts. Check Flutterwave's dashboard for
                the transaction, refund it manually if needed, then note what you did and mark resolved.
            </p>
            {error && <p className="error">{error}</p>}
            {rides.length === 0 ? (
                <p className="empty">Nothing needs review.</p>
            ) : (
                rides.map((ride) => (
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
