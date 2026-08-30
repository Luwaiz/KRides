import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Login() {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await api.login(password);
            navigate('/payouts');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-screen">
            <form onSubmit={submit} className="login-card">
                <h1>KRides Admin</h1>
                <input
                    type="password"
                    placeholder="Admin password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                />
                {error && <p className="error">{error}</p>}
                <button type="submit" disabled={loading || !password}>
                    {loading ? 'Checking…' : 'Log in'}
                </button>
            </form>
        </div>
    );
}
