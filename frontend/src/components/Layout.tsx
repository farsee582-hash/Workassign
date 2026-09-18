import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import type { Department } from '../types';

type IconProps = { size?: number };

function IconGrid({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </svg>
  );
}

function IconCheck({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M7.5 12.5l3 3 6-6" />
    </svg>
  );
}

function IconCalendar({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function IconMegaphone({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10v4a1 1 0 0 0 1 1h2l5 4V5L6 9H4a1 1 0 0 0-1 1Z" />
      <path d="M16 8a4 4 0 0 1 0 8" />
      <path d="M19 5a8 8 0 0 1 0 14" />
    </svg>
  );
}

function IconSettings({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.96 19a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.96a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 8.96 4.6a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 8.96a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  );
}

function IconRepeat({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 2l4 4-4 4" />
      <path d="M3 12v-2a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 12v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function IconUsers({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconLayers({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

const navItems = [
  { to: '/', label: 'Dashboard', Icon: IconGrid },
  { to: '/my-work', label: 'My Work', Icon: IconCheck },
  { to: '/calendar', label: 'Calendar', Icon: IconCalendar },
  { to: '/campaigns', label: 'Campaigns', Icon: IconMegaphone },
  { to: '/daily-work', label: 'Daily Work', Icon: IconSettings },
  { to: '/recurring-work', label: 'Recurring', Icon: IconRepeat },
  { to: '/admin', label: 'Org & Access', Icon: IconUsers },
];

function IconChevron({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function initials(name?: string) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join('');
}

function Logomark() {
  return (
    <span className="logomark" aria-hidden="true">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 8l5 9 3-6 3 6 5-9" />
      </svg>
    </span>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deptOpen, setDeptOpen] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const location = useLocation();

  useEffect(() => {
    api.get('/departments').then((r) => setDepartments(r.data)).catch(() => setDepartments([]));
  }, []);

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
        <h1><Logomark /> WorkAssign</h1>
      </header>
      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <h1 className="sidebar-title"><Logomark /> WorkAssign</h1>
        <nav>
          {navItems.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}>
              <span className="nav-icon"><Icon /></span>
              <span className="nav-label">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-group">
          <button className="sidebar-group-toggle" onClick={() => setDeptOpen((v) => !v)} aria-expanded={deptOpen}>
            <span className={`sidebar-group-chevron${deptOpen ? ' open' : ''}`}><IconChevron /></span>
            <span>Departments</span>
          </button>
          {deptOpen && (
            <ul className="sidebar-group-list">
              {departments.length === 0 && (
                <li style={{ fontSize: 12, color: 'var(--color-text-faint)', padding: '4px 12px' }}>No departments yet</li>
              )}
              {departments.map((d) => (
                <li key={d.id} className="sidebar-dept-group">
                  <div className="sidebar-dept-name">{d.name}</div>
                  <ul className="sidebar-group-list">
                    {d.subDepartments.length === 0 && (
                      <li>
                        <NavLink to={`/departments/${d.id}`} className={({ isActive }) => `sidebar-group-item${isActive ? ' active' : ''}`}>
                          <span className="nav-icon"><IconLayers size={16} /></span>
                          <span className="sidebar-group-item-label">All work</span>
                        </NavLink>
                      </li>
                    )}
                    {d.subDepartments.map((s) => (
                      <li key={s.id}>
                        <NavLink
                          to={s.name === 'Digital Marketing' ? '/departments/digital-marketing' : `/departments/${s.id}`}
                          className={({ isActive }) => `sidebar-group-item${isActive ? ' active' : ''}`}
                        >
                          <span className="nav-icon"><IconLayers size={16} /></span>
                          <span className="sidebar-group-item-label">{s.name}</span>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
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
