import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import Toolbar from '../components/Toolbar';

const FILTER_OPTIONS = [
    { value: 'all', label: 'All drivers' },
    { value: 'ready', label: 'Ready to pay' },
    { value: 'no_bank', label: 'Awaiting bank details' },
];

const PAYMENT_LABELS = { flutterwave: 'Card', wallet: 'Wallet', cash: 'Cash' };
const paymentLabel = (method) => PAYMENT_LABELS[method] || method || 'Unknown method';

export default function Payouts() {
    const [drivers, setDrivers] = useState(null);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState(null);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');

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

    const filtered = useMemo(() => {
        if (!drivers) return null;
        const q = search.trim().toLowerCase();
        return drivers.filter((d) => {
            const hasBank = !!(d.bankName && d.accountNumber);
            if (filter === 'ready' && !hasBank) return false;
            if (filter === 'no_bank' && hasBank) return false;
            if (!q) return true;
            const haystack = [
                d.name, d.bankName, d.accountNumber, d.accountName,
                ...d.rides.flatMap((r) => [
                    r.rideId, r.customerName, r.pickupLocation, r.destination, r.transactionId,
                ]),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(q);
        });
    }, [drivers, search, filter]);

    if (!drivers) return <p className="loading">Loading…</p>;

    const grandTotal = drivers.reduce((sum, d) => sum + d.total, 0);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Pending Driver Payouts</h2>
                    <p className="hint">
                        Pay each driver their total below via the Flutterwave dashboard or your bank app, then click
                        "Mark Paid" — this is what keeps a ride from being paid twice.
                    </p>
                </div>
                {drivers.length > 0 && <p className="total">Total owed: ₦{grandTotal.toLocaleString('en-NG')}</p>}
            </div>

            {drivers.length > 0 && (
                <Toolbar
                    search={search}
                    onSearchChange={setSearch}
                    searchPlaceholder="Search by driver, bank, account number, ride ID…"
                    filter={{ value: filter, onChange: setFilter, options: FILTER_OPTIONS }}
                />
            )}

            {error && <p className="error">{error}</p>}

            {drivers.length === 0 ? (
                <p className="empty">Nothing owed — all caught up.</p>
            ) : filtered.length === 0 ? (
                <p className="empty">No drivers match your search.</p>
            ) : (
                filtered.map((driver) => (
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
                        <div className="ride-list">
                            {driver.rides.map((r) => (
                                <div key={r.rideId} className="ride-row">
                                    <div className="ride-row-main">
                                        <span className="mono">{r.rideId}</span>
                                        <span className="amount">₦{r.amount.toLocaleString('en-NG')}</span>
                                    </div>
                                    <div className="ride-row-line muted">
                                        {r.customerName || 'Unknown customer'}
                                        {r.numberOfPassengers ? ` · ${r.numberOfPassengers} passenger${r.numberOfPassengers > 1 ? 's' : ''}` : ''}
                                    </div>
                                    {(r.pickupLocation || r.destination) && (
                                        <div className="ride-row-line muted">
                                            {r.pickupLocation || 'Unknown pickup'} → {r.destination || 'Unknown destination'}
                                        </div>
                                    )}
                                    <div className="ride-row-line muted">
                                        {paymentLabel(r.paymentMethod)}
                                        {r.transactionId && <> · txn <span className="mono">{r.transactionId}</span></>}
                                        {' · '}{r.completedAt ? new Date(r.completedAt).toLocaleDateString('en-NG') : 'unknown date'}
                                        {' · '}{r.status}
                                    </div>
                                    {r.payoutError && <div className="ride-row-error">⚠️ {r.payoutError}</div>}
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
