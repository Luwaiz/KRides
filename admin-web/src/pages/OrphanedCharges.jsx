import { useEffect, useState } from 'react';
import { api } from '../api';

export default function OrphanedCharges() {
    const [charges, setCharges] = useState(null);
    const [error, setError] = useState('');
    const [notes, setNotes] = useState({});
    const [busyId, setBusyId] = useState(null);

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

    if (!charges) return <p className="loading">Loading…</p>;

    return (
        <div>
            <h2>Orphaned Charges</h2>
            <p className="hint">
                A customer's card was charged but the ride and the automatic refund both failed — nothing else
                retries these. Check Flutterwave's dashboard for the transaction and refund it manually if the
                customer never got their ride, then note what you did and mark resolved.
            </p>
            {error && <p className="error">{error}</p>}
            {charges.length === 0 ? (
                <p className="empty">Nothing unresolved.</p>
            ) : (
                charges.map((charge) => (
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
