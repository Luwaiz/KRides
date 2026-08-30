import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { api } from './api';
import Login from './pages/Login';
import Payouts from './pages/Payouts';
import RefundReview from './pages/RefundReview';
import OrphanedCharges from './pages/OrphanedCharges';

function RequireAuth({ children }) {
    if (!api.getKey()) return <Navigate to="/login" replace />;
    return children;
}

function Layout({ children }) {
    const navigate = useNavigate();
    const logout = () => {
        api.clearKey();
        navigate('/login');
    };

    return (
        <div className="app">
            <header className="topbar">
                <h1>KRides Admin</h1>
                <nav>
                    <NavLink to="/payouts" className={({ isActive }) => (isActive ? 'active' : '')}>
                        Payouts
                    </NavLink>
                    <NavLink to="/refunds" className={({ isActive }) => (isActive ? 'active' : '')}>
                        Refund Review
                    </NavLink>
                    <NavLink to="/orphaned-charges" className={({ isActive }) => (isActive ? 'active' : '')}>
                        Orphaned Charges
                    </NavLink>
                </nav>
                <button className="logout" onClick={logout}>Log out</button>
            </header>
            <main>{children}</main>
        </div>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                    path="/payouts"
                    element={
                        <RequireAuth>
                            <Layout><Payouts /></Layout>
                        </RequireAuth>
                    }
                />
                <Route
                    path="/refunds"
                    element={
                        <RequireAuth>
                            <Layout><RefundReview /></Layout>
                        </RequireAuth>
                    }
                />
                <Route
                    path="/orphaned-charges"
                    element={
                        <RequireAuth>
                            <Layout><OrphanedCharges /></Layout>
                        </RequireAuth>
                    }
                />
                <Route path="*" element={<Navigate to="/payouts" replace />} />
            </Routes>
        </BrowserRouter>
    );
}
