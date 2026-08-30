import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { api } from './api';
import Login from './pages/Login';
import Payouts from './pages/Payouts';
import RefundReview from './pages/RefundReview';
import OrphanedCharges from './pages/OrphanedCharges';
import Reports from './pages/Reports';
import Drivers from './pages/Drivers';
import Logo from './components/Logo';
import { PayoutsIcon, RefundIcon, OrphanedIcon, ReportIcon, DriversIcon, LogoutIcon } from './components/icons';

function RequireAuth({ children }) {
    if (!api.getKey()) return <Navigate to="/login" replace />;
    return children;
}

const NAV_ITEMS = [
    { to: '/drivers', label: 'Drivers', icon: DriversIcon },
    { to: '/payouts', label: 'Payouts', icon: PayoutsIcon },
    { to: '/refunds', label: 'Refund Review', icon: RefundIcon },
    { to: '/reports', label: 'Report Complaints', icon: ReportIcon },
    { to: '/orphaned-charges', label: 'Orphaned Charges', icon: OrphanedIcon },
];

function Layout({ children }) {
    const navigate = useNavigate();
    const logout = () => {
        api.clearKey();
        navigate('/login');
    };

    return (
        <div className="app">
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <Logo />
                </div>
                <nav>
                    {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                        <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
                            <Icon />
                            {label}
                        </NavLink>
                    ))}
                </nav>
                <button className="logout" onClick={logout}>
                    <LogoutIcon />
                    Log out
                </button>
            </aside>
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
                    path="/drivers"
                    element={
                        <RequireAuth>
                            <Layout><Drivers /></Layout>
                        </RequireAuth>
                    }
                />
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
                    path="/reports"
                    element={
                        <RequireAuth>
                            <Layout><Reports /></Layout>
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
