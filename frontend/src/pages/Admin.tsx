import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Department, User } from '../types';
import { useAuth } from '../auth/AuthContext';
import PasswordInput from '../components/PasswordInput';

const ROLES = ['GMA', 'AGM', 'COORDINATOR', 'MANAGER', 'ASSISTANT_MANAGER', 'EXECUTIVE', 'ADMIN'];

const ROLE_LABELS: Record<string, string> = {
  GMA: 'GMA', AGM: 'AGM', COORDINATOR: 'Coordinator', MANAGER: 'Manager',
  ASSISTANT_MANAGER: 'Asst. Manager', EXECUTIVE: 'Executive', ADMIN: 'Admin',
};

function statusBadgeClass(status: string) {
  if (status === 'ACTIVE') return 'badge completed';
  if (status === 'SUSPENDED') return 'badge overdue';
  return 'badge';
}

function StaffTable({ users, departments, canEdit, onDeactivate }: {
  users: User[]; departments: Department[]; canEdit: boolean; onDeactivate: (id: string) => void;
}) {
  const usersById = new Map(users.map((u) => [u.id, u]));
  return (
    <div className="card">
      <h4 style={{ marginBottom: 4 }}>Staff</h4>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Employee</th><th>ID</th><th>Department</th><th>Designation</th>
              <th>Reporting To</th><th>Open Work</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.employeeId}</td>
                <td>{departments.find((d) => d.id === u.departmentId)?.name ?? '—'}</td>
                <td>{u.designation || (ROLE_LABELS[u.role] ?? u.role)}</td>
                <td>{u.reportingManagerId ? (usersById.get(u.reportingManagerId)?.name ?? '—') : '—'}</td>
                <td>{u.openWorkCount ?? '—'}</td>
                <td><span className={statusBadgeClass(u.status)}>{u.status}</span></td>
                <td>{canEdit && u.status === 'ACTIVE' && <button className="btn small secondary" onClick={() => onDeactivate(u.id)}>Deactivate</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewStaffForm({ departments, form, setForm, onSubmit }: {
  departments: Department[];
  form: { employeeId: string; name: string; email: string; username: string; password: string; role: string; departmentId: string; designation: string };
  setForm: (f: typeof form) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <form className="card" onSubmit={onSubmit} style={{ marginBottom: 20 }}>
      <h4 style={{ marginBottom: 4 }}>New staff</h4>
      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <label>Employee name
          <input required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label>Employee ID
          <input required placeholder="EMP-0148" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} />
        </label>
        <label>Department
          <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
            <option value="">None</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label>Role
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
          </select>
        </label>
      </div>
      <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
        <label>Email
          <input required type="email" placeholder="name@company.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
      </div>
      <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <label>Username
          <input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </label>
        <label>Designation
          <input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
        </label>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>
        Password
        <PasswordInput variant="button" required placeholder="Set a password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
      </label>
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-faint)', marginTop: -6, marginBottom: 16 }}>
        Stored hashed — never stored or displayed in plain text
      </p>
      <button
        className="btn"
        style={{
          width: '100%', background: 'transparent', color: 'var(--color-accent-700)',
          border: '1px solid var(--color-accent-500)', letterSpacing: '0.06em',
          textTransform: 'uppercase', fontSize: 'var(--fs-sm)',
        }}
      >
        Create staff
      </button>
    </form>
  );
}

// Builds the reporting-hierarchy rows from the real reportingManagerId chains.
// Executives directly under a manager are collapsed into one summarized row;
// every other role (GMA/AGM/Coordinator/Manager/Assistant Manager) is listed
// individually at its indentation level.
function hierarchyLabel(u: User, departments: Department[]) {
  const deptName = departments.find((d) => d.id === u.departmentId)?.name;
  if (u.role === 'MANAGER') return deptName ? `${deptName} — Manager` : 'Manager';
  if (u.role === 'ASSISTANT_MANAGER') return deptName ? `${deptName} — Asst. Manager` : 'Asst. Manager';
  return ROLE_LABELS[u.role] ?? u.role;
}

function buildHierarchyRows(users: User[], departments: Department[]) {
  const rows: { key: string; name: string; label: string; level: number }[] = [];
  const childrenOf = (id: string | null) => users.filter((u) => (u.reportingManagerId ?? null) === id);

  function visit(u: User, level: number) {
    rows.push({ key: u.id, name: u.name, label: hierarchyLabel(u, departments), level });
    const children = childrenOf(u.id);
    const execs = children.filter((c) => c.role === 'EXECUTIVE');
    const others = children.filter((c) => c.role !== 'EXECUTIVE');
    others.forEach((c) => visit(c, level + 1));
    if (execs.length) {
      const deptName = departments.find((d) => d.id === execs[0].departmentId)?.name
        ?? departments.find((d) => d.id === u.departmentId)?.name
        ?? 'Unassigned';
      rows.push({
        key: `${u.id}-execs`,
        name: `${deptName} executives`,
        label: `${execs.length} staff`,
        level: level + 1,
      });
    }
  }

  const roots = childrenOf(null).filter((u) => u.status !== 'INACTIVE');
  roots.forEach((r) => visit(r, 0));
  return rows;
}

function HierarchyCard({ users, departments }: { users: User[]; departments: Department[] }) {
  const rows = buildHierarchyRows(users.filter((u) => u.status !== 'INACTIVE'), departments);
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <h4 style={{ marginBottom: 4 }}>Hierarchy</h4>
      {rows.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No reporting relationships set up yet.</p>}
      <div>
        {rows.map((r) => (
          <div
            key={r.key}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0', paddingLeft: r.level * 22,
              borderBottom: '1px solid var(--color-divider)',
            }}
          >
            <span style={{ fontWeight: 600 }}>{r.name}</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--fs-sm)' }}>{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StaffTab({ departments, canEdit }: { departments: Department[]; canEdit: boolean }) {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({
    employeeId: '', name: '', email: '', username: '', password: '',
    role: 'EXECUTIVE', departmentId: '', designation: '',
  });

  function reload() {
    api.get('/users').then((r) => setUsers(r.data));
  }
  useEffect(reload, []);

  async function createUser(e: FormEvent) {
    e.preventDefault();
    await api.post('/users', { ...form, departmentId: form.departmentId || undefined });
    setForm({ employeeId: '', name: '', email: '', username: '', password: '', role: 'EXECUTIVE', departmentId: '', designation: '' });
    reload();
  }

  async function deactivate(id: string) {
    await api.delete(`/users/${id}`);
    reload();
  }

  return (
    <div>
      {canEdit && <NewStaffForm departments={departments} form={form} setForm={setForm} onSubmit={createUser} />}
      <StaffTable users={users} departments={departments} canEdit={canEdit} onDeactivate={deactivate} />
      <HierarchyCard users={users} departments={departments} />
    </div>
  );
}

function DepartmentsTab({ departments, reload, canEdit }: { departments: Department[]; reload: () => void; canEdit: boolean }) {
  const [name, setName] = useState('');
  const [subName, setSubName] = useState<Record<string, string>>({});

  async function createDepartment(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await api.post('/departments', { name });
    setName('');
    reload();
  }

  async function createSub(e: FormEvent, deptId: string) {
    e.preventDefault();
    const value = subName[deptId]?.trim();
    if (!value) return;
    await api.post(`/departments/${deptId}/sub-departments`, { name: value });
    setSubName({ ...subName, [deptId]: '' });
    reload();
  }

  return (
    <div>
      <h3>Departments</h3>
      {canEdit && (
      <form className="card" onSubmit={createDepartment} style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <input placeholder="New department name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn small">Add Department</button>
      </form>
      )}
      {departments.map((d) => (
        <div className="card" key={d.id} style={{ marginBottom: 12 }}>
          <strong>{d.name}</strong>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
            {d.subDepartments.map((s) => <span key={s.id} className="badge">{s.name}</span>)}
          </div>
          {canEdit && (
          <form onSubmit={(e) => createSub(e, d.id)} style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="New sub-department"
              value={subName[d.id] ?? ''}
              onChange={(e) => setSubName({ ...subName, [d.id]: e.target.value })}
            />
            <button className="btn small secondary">Add</button>
          </form>
          )}
        </div>
      ))}
    </div>
  );
}

function RolesTab() {
  const rows = [
    { role: 'GMA', desc: 'General Manager - Administration. Full management access to all data.' },
    { role: 'AGM', desc: 'Assistant General Manager. Full management access to all data.' },
    { role: 'COORDINATOR', desc: 'Coordinates campaigns/departments; can assign work and view its department.' },
    { role: 'MANAGER', desc: 'Department Manager; can assign work within their department, sees department tasks.' },
    { role: 'ASSISTANT_MANAGER', desc: 'Sees tasks they created or are assigned.' },
    { role: 'EXECUTIVE', desc: 'Sees only tasks assigned to them.' },
    { role: 'ADMIN', desc: 'System administrator. Full access, manages users/departments/access.' },
  ];
  return (
    <div>
      <h3>Roles / Hierarchy</h3>
      <div className="table-scroll">
      <table>
        <thead><tr><th>Role</th><th>Description</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.role}><td>{r.role}</td><td>{r.desc}</td></tr>)}</tbody>
      </table>
      </div>
    </div>
  );
}

// The exact grants enforced server-side (see backend/src/middleware/auth.ts
// and the requireRoles(...)/canAssignWork(...) guards on each route):
//   - View Campaign: every authenticated role (scoped — Executives only see
//     their own assigned work; GMA/AGM/ADMIN see everything).
//   - Create Campaign: campaigns.ts POST/PUT — GMA, AGM, COORDINATOR, MANAGER, ADMIN.
//   - Add Campaign Task / Add Daily Work / Add Recurring Work / Assign Task:
//     canAssignWork() — GMA, AGM, COORDINATOR, MANAGER, ADMIN.
//   - Reassign Task: not distinctly role-gated server-side (any authenticated
//     user with task access may PATCH /:id/assign); shown here matching the
//     same work-assigner group used for assignment.
//   - Approve Work (task status -> APPROVED): not distinctly role-gated
//     server-side either; shown matching the work-assigner group.
//   - View Reports: dashboard.ts /management — GMA, AGM, COORDINATOR, MANAGER, ADMIN.
//   - Manage Users: users.ts POST/PUT/DELETE — GMA, ADMIN only (AGM is NOT included).
//   - Manage Permissions: departments.ts write routes — GMA, ADMIN only.
const PERMISSION_ROWS: { label: string; grants: Record<string, boolean> }[] = [
  { label: 'View Campaign', grants: { GMA: true, AGM: true, COORDINATOR: true, MANAGER: true, EXECUTIVE: true } },
  { label: 'Create Campaign', grants: { GMA: true, AGM: true, COORDINATOR: true, MANAGER: true, EXECUTIVE: false } },
  { label: 'Add Campaign Task', grants: { GMA: true, AGM: true, COORDINATOR: true, MANAGER: true, EXECUTIVE: false } },
  { label: 'Assign Task', grants: { GMA: true, AGM: true, COORDINATOR: true, MANAGER: true, EXECUTIVE: false } },
  { label: 'Reassign Task', grants: { GMA: true, AGM: true, COORDINATOR: true, MANAGER: true, EXECUTIVE: false } },
  { label: 'Add Daily Work', grants: { GMA: true, AGM: true, COORDINATOR: true, MANAGER: true, EXECUTIVE: false } },
  { label: 'Add Recurring Work', grants: { GMA: true, AGM: true, COORDINATOR: true, MANAGER: true, EXECUTIVE: false } },
  { label: 'Approve Work', grants: { GMA: true, AGM: true, COORDINATOR: true, MANAGER: true, EXECUTIVE: false } },
  { label: 'View Reports', grants: { GMA: true, AGM: true, COORDINATOR: true, MANAGER: true, EXECUTIVE: false } },
  { label: 'Manage Users', grants: { GMA: true, AGM: false, COORDINATOR: false, MANAGER: false, EXECUTIVE: false } },
  { label: 'Manage Permissions', grants: { GMA: true, AGM: false, COORDINATOR: false, MANAGER: false, EXECUTIVE: false } },
];
const PERMISSION_ROLE_COLUMNS = ['GMA', 'AGM', 'COORDINATOR', 'MANAGER', 'EXECUTIVE'];

function PermCheck({ checked }: { checked: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 20, height: 20, borderRadius: 5,
        background: checked ? 'var(--color-accent-500)' : 'transparent',
        border: checked ? 'none' : '1.5px solid var(--color-border-strong)',
        color: 'var(--color-charcoal)',
      }}
    >
      {checked && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M4 12l6 6L20 6" />
        </svg>
      )}
    </span>
  );
}

function PermissionsTab() {
  return (
    <div>
      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Permissions</h3>
        <p style={{ color: 'var(--color-text-muted)', marginTop: -2 }}>
          Enforced in the interface and again on every API call — hidden options are also rejected server-side.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Permission</th>
                {PERMISSION_ROLE_COLUMNS.map((r) => <th key={r} style={{ textAlign: 'center' }}>{r}</th>)}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_ROWS.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  {PERMISSION_ROLE_COLUMNS.map((r) => (
                    <td key={r} style={{ textAlign: 'center' }}><PermCheck checked={row.grants[r]} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as 'staff' | 'departments' | 'roles' | 'permissions') || 'staff';
  const canEdit = !!user && ['ADMIN', 'GMA'].includes(user.role);

  function reload() {
    api.get('/departments').then((r) => setDepartments(r.data));
  }
  useEffect(reload, []);

  const tabs: { key: string; label: string }[] = [
    { key: 'staff', label: 'Staff' },
    { key: 'departments', label: 'Departments' },
    { key: 'roles', label: 'Roles / Hierarchy' },
    { key: 'permissions', label: 'Permissions' },
  ];

  return (
    <div>
      <div className="section-title"><h2>Organization &amp; Access Management</h2></div>
      <p style={{ color: '#888', marginTop: -8 }}>
        Staff, Departments, Roles and Permissions in one place. Per-campaign department/staff
        access is managed on each campaign's edit form.
      </p>
      <div className="tab-bar">
        {tabs.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setParams({ tab: t.key })}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'staff' && <StaffTab departments={departments} canEdit={canEdit} />}
      {tab === 'departments' && <DepartmentsTab departments={departments} reload={reload} canEdit={canEdit} />}
      {tab === 'roles' && <RolesTab />}
      {tab === 'permissions' && <PermissionsTab />}
    </div>
  );
}
