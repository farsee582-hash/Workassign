import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '▦' },
  { to: '/my-work', label: 'My Work', icon: '✓' },
  { to: '/calendar', label: 'Calendar', icon: '\u{1F4C5}' },
  { to: '/campaigns', label: 'Campaigns', icon: '\u{1F4E3}' },
  { to: '/daily-work', label: 'Daily Work', icon: '⚙' },
  { to: '/recurring-work', label: 'Recurring', icon: '↻' },
  { to: '/admin', label: 'Org & Access', icon: '\u{1F465}' },
];

function initials(name?: string) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join('');
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Close the mobile menu whenever navigation happens.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <header className="mobile-topbar">
        <button
          className="hamburger-btn"
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
        <h1>WorkAssign</h1>
      </header>
      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <h1 className="sidebar-title">WorkAssign</h1>
        <nav>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="favorites">
          <h6>QUICK LINKS</h6>
          <ul>
            <li><span className="dot" style={{ background: 'var(--color-accent-500)' }} /> Overdue tasks</li>
            <li><span className="dot" style={{ background: '#4f83c9' }} /> Active campaigns</li>
            <li><span className="dot" style={{ background: '#3f8a5c' }} /> Completed today</li>
          </ul>
        </div>
        <div className="user-info">
          <div className="avatar-chip">{initials(user?.name)}</div>
          <div className="user-meta">
            <div>{user?.name}</div>
            <div>{user?.role}</div>
          </div>
          <button className="btn secondary small" onClick={logout} aria-label="Log out">
            {'⏻'}
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
