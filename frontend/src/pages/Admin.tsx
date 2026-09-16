import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Department, User } from '../types';
import { useAuth } from '../auth/AuthContext';
import PasswordInput from '../components/PasswordInput';

const ROLES = ['GMA', 'AGM', 'COORDINATOR', 'MANAGER', 'ASSISTANT_MANAGER', 'EXECUTIVE', 'ADMIN'];

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
      <h3>Staff</h3>
      {canEdit && (
      <form className="card" onSubmit={createUser} style={{ marginBottom: 16 }}>
        <div className="form-grid">
          <label>Employee ID<input required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} /></label>
          <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Designation<input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></label>
          <label>Username<input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
          <label>Password<PasswordInput required value={form.password} onChange={(v) => setForm({ ...form, password: v })} /></label>
          <label>Role
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label>Department
            <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              <option value="">None</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
        </div>
        <button className="btn">Create User</button>
      </form>
      )}
      <div className="table-scroll">
      <table>
        <thead><tr><th>Employee ID</th><th>Name</th><th>Designation</th><th>Role</th><th>Department</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.employeeId}</td><td>{u.name}</td><td>{u.designation}</td><td>{u.role}</td>
              <td>{departments.find((d) => d.id === u.departmentId)?.name ?? '—'}</td>
              <td>{u.status}</td>
              <td>{canEdit && u.status === 'ACTIVE' && <button className="btn small secondary" onClick={() => deactivate(u.id)}>Deactivate</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
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

function PermissionsTab() {
  return (
    <div>
      <h3>Permissions</h3>
      <div className="card">
        <p><strong>Add Task / Add Work</strong> — GMA, AGM, COORDINATOR, MANAGER, ADMIN, plus a campaign's Coordinator.</p>
        <p><strong>Campaign create/edit</strong> — GMA, AGM, COORDINATOR, MANAGER, ADMIN.</p>
        <p><strong>Campaign delete</strong> — GMA, ADMIN.</p>
        <p><strong>Campaign / task / chat visibility for other roles</strong> — controlled per-campaign via Campaign Access (Departments and Staff access, below), configured when creating or editing a campaign.</p>
        <p><strong>User / Department management</strong> — GMA, ADMIN.</p>
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
