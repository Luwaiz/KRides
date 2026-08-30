import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import Toolbar from '../components/Toolbar';

const FILTER_OPTIONS = [
    { value: 'open', label: 'Open' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'all', label: 'All reports' },
];

export default function Reports() {
    const [reports, setReports] = useState(null);
    const [error, setError] = useState('');
    const [notes, setNotes] = useState({});
    const [busyId, setBusyId] = useState(null);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('open');

    const load = async () => {
        setError('');
        try {
            const data = await api.getReports();
            setReports(data.reports);
        } catch (err) {
            setError(err.message);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const resolve = async (reportId) => {
        setBusyId(reportId);
        setError('');
        try {
            await api.resolveReport(reportId, notes[reportId] || '');
            await load();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const reopen = async (reportId) => {
        setBusyId(reportId);
        setError('');
        try {
            await api.reopenReport(reportId);
            await load();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const filtered = useMemo(() => {
        if (!reports) return null;
        const q = search.trim().toLowerCase();
        return reports.filter((r) => {
            if (filter !== 'all' && r.status !== filter) return false;
            if (!q) return true;
            const haystack = [
                r.driverName, r.customerName, r.rideId, r.reason, r.description, r.driverPhone, r.driverEmail,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(q);
        });
    }, [reports, search, filter]);

    if (!reports) return <p className="loading">Loading…</p>;

    const openCount = reports.filter((r) => r.status === 'open').length;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Driver Complaints</h2>
                    <p className="hint">
                        Reports riders submit against a driver after a ride. Follow up with the driver directly,
                        then note what happened and mark resolved.
                    </p>
                </div>
                {reports.length > 0 && <p className="total">{openCount} open</p>}
            </div>

            {reports.length > 0 && (
                <Toolbar
                    search={search}
                    onSearchChange={setSearch}
                    searchPlaceholder="Search by driver, customer, ride ID, reason…"
                    filter={{ value: filter, onChange: setFilter, options: FILTER_OPTIONS }}
                />
            )}

            {error && <p className="error">{error}</p>}

            {reports.length === 0 ? (
                <p className="empty">No reports yet.</p>
            ) : filtered.length === 0 ? (
                <p className="empty">No reports match your search.</p>
            ) : (
                filtered.map((r) => (
                    <div key={r.reportId} className="card">
                        <div className="card-header">
                            <div>
                                <strong>{r.driverName || 'Unknown driver'}</strong>
                                <div className="muted">
                                    reported by {r.customerName || 'Unknown customer'}
                                    {r.createdAt && ` · ${new Date(r.createdAt).toLocaleString('en-NG')}`}
                                </div>
                            </div>
                            <span className={r.status === 'open' ? 'badge badge-open' : 'badge badge-resolved'}>
                                {r.status === 'open' ? 'Open' : 'Resolved'}
                            </span>
                        </div>

                        <p><strong>Reason:</strong> {r.reason || '—'}</p>
                        {r.description && <p className="muted">"{r.description}"</p>}

                        <p className="muted">
                            {r.driverPhone && <>Driver: {r.driverPhone}{r.driverEmail && ` · ${r.driverEmail}`}<br /></>}
                            {(r.pickupLocation || r.destination) && <>{r.pickupLocation || '—'} → {r.destination || '—'}<br /></>}
                            {r.rideId && <>Ride <span className="mono">{r.rideId}</span>{r.rideAmount ? ` · ₦${r.rideAmount.toLocaleString('en-NG')}` : ''}</>}
                        </p>

                        {r.status === 'resolved' ? (
                            <>
                                {r.resolutionNote && <p className="muted">Resolution: {r.resolutionNote}</p>}
                                <button disabled={busyId === r.reportId} onClick={() => reopen(r.reportId)}>
                                    {busyId === r.reportId ? 'Reopening…' : 'Reopen'}
                                </button>
                            </>
                        ) : (
                            <>
                                <textarea
                                    placeholder="What did you do about this? (e.g. spoke to the driver, issued a warning)"
                                    value={notes[r.reportId] || ''}
                                    onChange={(e) => setNotes({ ...notes, [r.reportId]: e.target.value })}
                                />
                                <button disabled={busyId === r.reportId} onClick={() => resolve(r.reportId)}>
                                    {busyId === r.reportId ? 'Saving…' : 'Mark Resolved'}
                                </button>
                            </>
                        )}
                    </div>
                ))
            )}
        </div>
    );
}
