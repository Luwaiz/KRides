import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import Toolbar from '../components/Toolbar';

const FILTER_OPTIONS = [
    { value: 'owed', label: 'Owed money' },
    { value: 'all', label: 'All drivers' },
    { value: 'no_bank', label: 'No bank details' },
];

const PAYMENT_LABELS = { flutterwave: 'Card', wallet: 'Wallet', cash: 'Cash' };
const paymentLabel = (method) => PAYMENT_LABELS[method] || method || 'Unknown method';
const naira = (n) => `₦${Number(n || 0).toLocaleString('en-NG')}`;

// A ride stays on screen once paid instead of disappearing — this is what
// tells the two states apart. 'needs_review' covers both the automatic-retry
// sweep giving up and a couple of other stuck states, so it's worth its own
// label rather than showing the raw status string.
const STATUS_BADGES = {
    paid_manually: { label: 'Paid', className: 'badge-resolved' },
    pending_manual: { label: 'Pending', className: 'badge-pending' },
    awaiting_bank_details: { label: 'Awaiting Bank Details', className: 'badge-open' },
    failed: { label: 'Failed', className: 'badge-open' },
    needs_review: { label: 'Needs Review', className: 'badge-open' },
};
const statusBadge = (status) => STATUS_BADGES[status] || { label: status || 'Unknown', className: 'badge-pending' };

// Each driver gets their own tab (the list on the left selects it) instead
// of one long scroll of every driver's card — "To Be Paid" and "Paid Total"
// sit at the top of whichever driver is selected. "Mark All As Paid" settles
// everything owed as of that moment; anything that completes afterward
// starts a fresh "To Be Paid" total while "Paid Total" keeps its running
// lifetime sum (see totalPaidOut on the driver doc, server-side).
export default function Payouts() {
    const [drivers, setDrivers] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('owed');
    const [selectedDriverId, setSelectedDriverId] = useState(null);

    const load = async (keepSelection) => {
        setError('');
        try {
            const data = await api.getPayoutsOverview();
            setDrivers(data.drivers);
            if (!keepSelection || !data.drivers.some((d) => d.driverId === selectedDriverId)) {
                setSelectedDriverId(data.drivers[0]?.driverId || null);
            }
        } catch (err) {
            setError(err.message);
        }
    };

    useEffect(() => {
        load(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filtered = useMemo(() => {
        if (!drivers) return null;
        const q = search.trim().toLowerCase();
        return drivers.filter((d) => {
            const hasBank = !!(d.bankName && d.accountNumber);
            if (filter === 'owed' && d.toBePaid <= 0) return false;
            if (filter === 'no_bank' && hasBank) return false;
            if (!q) return true;
            const haystack = [d.name, d.bankName, d.accountNumber, d.accountName].filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(q);
        });
    }, [drivers, search, filter]);

    const selectedDriver = drivers?.find((d) => d.driverId === selectedDriverId) || null;

    const markAllPaid = async () => {
        if (!selectedDriver || selectedDriver.rides.length === 0) return;
        const confirmed = window.confirm(
            `Mark all ${selectedDriver.rides.length} ride(s) for ${selectedDriver.name} (${naira(selectedDriver.toBePaid)}) as paid?\n\nOnly confirm after you've actually sent the money — this cannot be automatically undone.`
        );
        if (!confirmed) return;

        setBusy(true);
        setError('');
        try {
            await api.markPaid(selectedDriver.rides.map((r) => r.rideId));
            await load(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    if (!drivers) return <p className="loading">Loading…</p>;

    return (
        <div className="payouts-page">
            <div className="page-header">
                <div>
                    <h2>Driver Payouts</h2>
                    <p className="hint">
                        Pick a driver on the left to see what they're owed right now and their all-time paid total.
                        "Mark All As Paid" settles everything owed as of this moment — any ride that completes after
                        that starts a fresh "To Be Paid" total for next time.
                    </p>
                </div>
            </div>

            {error && <p className="error">{error}</p>}

            <div className="payout-layout">
                <div className="payout-driver-list-wrap">
                    <Toolbar
                        search={search}
                        onSearchChange={setSearch}
                        searchPlaceholder="Search drivers…"
                        filter={{ value: filter, onChange: setFilter, options: FILTER_OPTIONS }}
                    />
                    <div className="payout-driver-list">
                        {filtered.length === 0 ? (
                            <p className="empty">No drivers match.</p>
                        ) : (
                            filtered.map((d) => (
                                <button
                                    key={d.driverId}
                                    type="button"
                                    className={`payout-driver-item${d.driverId === selectedDriverId ? ' active' : ''}`}
                                    onClick={() => setSelectedDriverId(d.driverId)}
                                >
                                    <span className="payout-driver-name">{d.name}</span>
                                    <span className={`payout-driver-owed${d.toBePaid > 0 ? ' owed' : ''}`}>
                                        {naira(d.toBePaid)}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="payout-detail">
                    {!selectedDriver ? (
                        <p className="empty">Select a driver.</p>
                    ) : (
                        <>
                            <div className="card">
                                <div className="card-header">
                                    <div>
                                        <strong>{selectedDriver.name}</strong>
                                        <div className="muted">
                                            {selectedDriver.bankName && selectedDriver.accountNumber
                                                ? `${selectedDriver.bankName} — ${selectedDriver.accountNumber} (${selectedDriver.accountName || 'name not on file'})`
                                                : '⚠️ No bank details on file'}
                                        </div>
                                    </div>
                                </div>

                                <div className="stat-row">
                                    <div className="stat-tile">
                                        <div className="stat-label">To Be Paid</div>
                                        <div className="stat-value stat-owed">{naira(selectedDriver.toBePaid)}</div>
                                    </div>
                                    <div className="stat-tile">
                                        <div className="stat-label">Paid Total</div>
                                        <div className="stat-value stat-paid">{naira(selectedDriver.paidTotal)}</div>
                                    </div>
                                </div>

                                <div className="card-actions">
                                    <button
                                        disabled={busy || selectedDriver.rides.length === 0}
                                        onClick={markAllPaid}
                                    >
                                        {busy ? 'Marking…' : 'Mark All As Paid'}
                                    </button>
                                </div>
                            </div>

                            <div className="ride-list">
                                {selectedDriver.rides.length === 0 ? (
                                    <p className="empty">Nothing owed, and no payouts in the last 30 days.</p>
                                ) : (
                                    selectedDriver.rides.map((r) => (
                                        <div key={r.rideId} className={`card${r.status === 'paid_manually' ? ' card-paid' : ''}`}>
                                            <div className="ride-row-main">
                                                <span className="mono">{r.rideId}</span>
                                                <div className="card-actions">
                                                    <span className={`badge ${statusBadge(r.status).className}`}>
                                                        {statusBadge(r.status).label}
                                                    </span>
                                                    <span className="amount">{naira(r.amount)}</span>
                                                </div>
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
                                                {r.status === 'paid_manually' && r.paidAt && <> · paid {new Date(r.paidAt).toLocaleDateString('en-NG')}</>}
                                            </div>
                                            {r.payoutError && <div className="ride-row-error">⚠️ {r.payoutError}</div>}
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
