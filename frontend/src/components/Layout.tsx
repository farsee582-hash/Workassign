import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/my-work', label: 'My Work' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/campaigns', label: 'Campaigns' },
  { to: '/daily-work', label: 'Daily Work' },
  { to: '/recurring-work', label: 'Recurring Work' },
  { to: '/admin', label: 'Organization & Access' },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>WorkAssign</h1>
        <nav>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="user-info">
          <div>{user?.name}</div>
          <div>{user?.role}</div>
          <button className="btn secondary small" style={{ marginTop: 8 }} onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
