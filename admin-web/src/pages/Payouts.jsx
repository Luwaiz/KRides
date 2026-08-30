import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Payouts() {
    const [drivers, setDrivers] = useState(null);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState(null);

    const load = async () => {
        setError('');
        try {
            const data = await api.getPendingPayouts();
            setDrivers(data.drivers);
        } catch (err) {
            setError(err.message);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const markDriverPaid = async (driver) => {
        const confirmed = window.confirm(
            `Mark all ${driver.rides.length} ride(s) for ${driver.name} (₦${driver.total.toLocaleString('en-NG')}) as paid?\n\nOnly confirm after you've actually sent the money — this cannot be automatically undone.`
        );
        if (!confirmed) return;

        setBusyId(driver.driverId);
        setError('');
        try {
            await api.markPaid(driver.rides.map((r) => r.rideId));
            await load();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusyId(null);
        }
    };

    if (!drivers) return <p className="loading">Loading…</p>;

    const grandTotal = drivers.reduce((sum, d) => sum + d.total, 0);

    return (
        <div>
            <h2>Pending Driver Payouts</h2>
            <p className="hint">
                Pay each driver their total below via the Flutterwave dashboard or your bank app, then click
                "Mark Paid" — this is what keeps a ride from being paid twice.
            </p>
            {error && <p className="error">{error}</p>}
            {drivers.length === 0 ? (
                <p className="empty">Nothing owed — all caught up.</p>
            ) : (
                <>
                    <p className="total">Total owed: ₦{grandTotal.toLocaleString('en-NG')}</p>
                    {drivers.map((driver) => (
                        <div key={driver.driverId} className="card">
                            <div className="card-header">
                                <div>
                                    <strong>{driver.name}</strong>
                                    <div className="muted">
                                        {driver.bankName && driver.accountNumber
                                            ? `${driver.bankName} — ${driver.accountNumber} (${driver.accountName || 'name not on file'})`
                                            : '⚠️ No bank details on file'}
                                    </div>
                                </div>
                                <div className="card-actions">
                                    <span className="amount">₦{driver.total.toLocaleString('en-NG')}</span>
                                    <button
                                        disabled={busyId === driver.driverId}
                                        onClick={() => markDriverPaid(driver)}
                                    >
                                        {busyId === driver.driverId ? 'Marking…' : 'Mark Paid'}
                                    </button>
                                </div>
                            </div>
                            <table>
                                <tbody>
                                    {driver.rides.map((r) => (
                                        <tr key={r.rideId}>
                                            <td className="mono">{r.rideId}</td>
                                            <td>₦{r.amount.toLocaleString('en-NG')}</td>
                                            <td className="muted">
                                                {r.completedAt ? new Date(r.completedAt).toLocaleDateString('en-NG') : '—'}
                                            </td>
                                            <td className="muted">{r.status}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}
