import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/attendance', label: 'Attendance' },
  { to: '/dispatches', label: 'Dispatch' },
  { to: '/payments', label: 'Payments' },
  { to: '/workers', label: 'Workers' },
  { to: '/sites', label: 'Sites' },
  { to: '/reports', label: 'Reports' },
];

export default function Layout() {
  const { user, logout, deleteAccount } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDeleteAccount = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Delete your account? This removes your sites, workers, attendance, payments and dispatches. Cannot be undone.')) return;
    // eslint-disable-next-line no-alert
    if (!window.confirm('Really delete everything? Last chance.')) return;
    try {
      await deleteAccount();
      navigate('/login');
    } catch (err) {
      // eslint-disable-next-line no-alert
      window.alert(err?.response?.data?.message || 'Could not delete account.');
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">K</span>
          <div>
            <strong>Karmamitra</strong>
            <small>Workforce &amp; payments</small>
          </div>
        </div>
        <nav className="topnav">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="userbox">
          <span>{user?.name}</span>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Log out
          </button>
          <button type="button" className="btn btn-ghost" style={{ color: '#b91c1c' }} onClick={handleDeleteAccount} title="Delete account and all data">
            Delete account
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}