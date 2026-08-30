import { useState } from 'react';
import { api } from '../api';

const EMPTY_FORM = { fullName: '', phone: '', email: '', vehicleId: '' };

export default function AddDriver() {
    const [form, setForm] = useState(EMPTY_FORM);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null); // { driverId, emailSent, emailFailReason }
    const [resending, setResending] = useState(false);
    const [resendMessage, setResendMessage] = useState('');

    const setField = (field) => (e) => setForm({ ...form, [field]: e.target.value });

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await api.createDriver(form);
            setResult(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const addAnother = () => {
        setForm(EMPTY_FORM);
        setResult(null);
        setResendMessage('');
    };

    const resend = async () => {
        setResending(true);
        setResendMessage('');
        try {
            const data = await api.resendDriverWelcomeEmail(result.driverId);
            setResendMessage(data.emailSent ? 'Sent.' : `Still failed (${data.emailFailReason}).`);
            setResult({ ...result, emailSent: data.emailSent, emailFailReason: data.emailFailReason });
        } catch (err) {
            setResendMessage(err.message);
        } finally {
            setResending(false);
        }
    };

    if (result) {
        return (
            <div>
                <h2>Add Driver</h2>
                <div className="card">
                    <p>
                        <strong>{form.fullName}</strong>'s account has been created.
                    </p>
                    {result.emailSent ? (
                        <p className="muted">
                            A "set your password" email was sent to {form.email}. They'll be able to log in with
                            their phone number once they've set a password.
                        </p>
                    ) : (
                        <>
                            <p className="error">
                                Account created, but the welcome email failed to send ({result.emailFailReason}).
                                The driver has no way to set a password yet.
                            </p>
                            <button disabled={resending} onClick={resend}>
                                {resending ? 'Resending…' : 'Resend Welcome Email'}
                            </button>
                            {resendMessage && <p className="muted" style={{ marginTop: 8 }}>{resendMessage}</p>}
                        </>
                    )}
                    <div style={{ marginTop: 16 }}>
                        <button onClick={addAnother}>Add Another Driver</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Add Driver</h2>
                    <p className="hint">
                        Creates the account the same way the app's own driver signup does. The driver gets an email
                        to set their own password — nobody, including you, ever sees it — then logs in through the
                        app as normal.
                    </p>
                </div>
            </div>

            {error && <p className="error">{error}</p>}

            <form onSubmit={submit} className="card form-card">
                <label>
                    Full Name
                    <input type="text" value={form.fullName} onChange={setField('fullName')} required />
                </label>
                <label>
                    Phone Number
                    <input type="tel" placeholder="08012345678" value={form.phone} onChange={setField('phone')} required />
                </label>
                <label>
                    Email
                    <input type="email" value={form.email} onChange={setField('email')} required />
                </label>
                <label>
                    Vehicle ID
                    <input type="text" value={form.vehicleId} onChange={setField('vehicleId')} required />
                </label>
                <button type="submit" disabled={loading}>
                    {loading ? 'Creating…' : 'Create Driver Account'}
                </button>
            </form>
        </div>
    );
}
