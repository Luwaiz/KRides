import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

const PREVIEW_PASSENGER_COUNTS = [1, 2, 3, 4];

export default function Pricing() {
    const [form, setForm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const load = async () => {
        setError('');
        try {
            const data = await api.getPricing();
            setForm({
                baseFarePerPassenger: String(data.pricing.baseFarePerPassenger),
                platformFeeStandard: String(data.pricing.platformFeeStandard),
                platformFeeGroup: String(data.pricing.platformFeeGroup),
                groupThreshold: String(data.pricing.groupThreshold),
            });
        } catch (err) {
            setError(err.message);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const setField = (field) => (e) => {
        setForm({ ...form, [field]: e.target.value.replace(/[^0-9]/g, '') });
        setSuccess('');
    };

    const numbers = useMemo(() => {
        if (!form) return null;
        return {
            baseFarePerPassenger: Number(form.baseFarePerPassenger) || 0,
            platformFeeStandard: Number(form.platformFeeStandard) || 0,
            platformFeeGroup: Number(form.platformFeeGroup) || 0,
            groupThreshold: Number(form.groupThreshold) || 0,
        };
    }, [form]);

    const preview = useMemo(() => {
        if (!numbers) return [];
        return PREVIEW_PASSENGER_COUNTS.map((passengers) => {
            const fee = passengers >= numbers.groupThreshold ? numbers.platformFeeGroup : numbers.platformFeeStandard;
            const fare = numbers.baseFarePerPassenger * passengers + fee;
            const driverEarnings = numbers.baseFarePerPassenger * passengers;
            return { passengers, fee, fare, driverEarnings };
        });
    }, [numbers]);

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setSaving(true);
        try {
            await api.updatePricing(numbers);
            setSuccess('Pricing updated — takes effect immediately for every ride booked or completed from now on.');
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (!form) return <p className="loading">Loading…</p>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Pricing</h2>
                    <p className="hint">
                        Fares are flat-rate per passenger, not distance-based. Changes here apply immediately —
                        no app update or redeploy needed.
                    </p>
                </div>
            </div>

            {error && <p className="error">{error}</p>}
            {success && <p className="success">{success}</p>}

            <form onSubmit={submit} className="card form-card">
                <label>
                    Base Fare (₦ per passenger)
                    <input type="text" inputMode="numeric" value={form.baseFarePerPassenger} onChange={setField('baseFarePerPassenger')} required />
                </label>
                <label>
                    Platform Fee — Standard (₦, added on top of base fare)
                    <input type="text" inputMode="numeric" value={form.platformFeeStandard} onChange={setField('platformFeeStandard')} required />
                </label>
                <label>
                    Platform Fee — Group Rides (₦, added on top of base fare)
                    <input type="text" inputMode="numeric" value={form.platformFeeGroup} onChange={setField('platformFeeGroup')} required />
                </label>
                <label>
                    Group Ride Threshold (passengers)
                    <input type="text" inputMode="numeric" value={form.groupThreshold} onChange={setField('groupThreshold')} required />
                </label>
                <button type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Save Pricing'}
                </button>
            </form>

            <div className="card" style={{ marginTop: 18 }}>
                <strong>Preview</strong>
                <p className="muted" style={{ marginTop: 4, marginBottom: 10 }}>
                    What a customer pays and what the driver earns, by passenger count.
                </p>
                <table>
                    <thead>
                        <tr>
                            <td className="muted">Passengers</td>
                            <td className="muted">Platform Fee</td>
                            <td className="muted">Customer Pays</td>
                            <td className="muted">Driver Earns</td>
                        </tr>
                    </thead>
                    <tbody>
                        {preview.map((row) => (
                            <tr key={row.passengers}>
                                <td>{row.passengers}</td>
                                <td>₦{row.fee.toLocaleString('en-NG')}</td>
                                <td>₦{row.fare.toLocaleString('en-NG')}</td>
                                <td>₦{row.driverEarnings.toLocaleString('en-NG')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
