import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api/client';
import type { Department, User } from '../types';

const ROLES = ['GMA', 'AGM', 'COORDINATOR', 'MANAGER', 'ASSISTANT_MANAGER', 'EXECUTIVE', 'ADMIN'];

function UsersAdmin({ departments }: { departments: Department[] }) {
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
      <h3>Users</h3>
      <form className="card" onSubmit={createUser} style={{ marginBottom: 16 }}>
        <div className="form-grid">
          <label>Employee ID<input required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} /></label>
          <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Designation<input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></label>
          <label>Username<input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
          <label>Password<input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
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
      <table>
        <thead><tr><th>Employee ID</th><th>Name</th><th>Role</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.employeeId}</td><td>{u.name}</td><td>{u.role}</td><td>{u.status}</td>
              <td>{u.status === 'ACTIVE' && <button className="btn small secondary" onClick={() => deactivate(u.id)}>Deactivate</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DepartmentsAdmin({ departments, reload }: { departments: Department[]; reload: () => void }) {
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
      <form className="card" onSubmit={createDepartment} style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <input placeholder="New department name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn small">Add Department</button>
      </form>
      {departments.map((d) => (
        <div className="card" key={d.id} style={{ marginBottom: 12 }}>
          <strong>{d.name}</strong>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
            {d.subDepartments.map((s) => <span key={s.id} className="badge">{s.name}</span>)}
          </div>
          <form onSubmit={(e) => createSub(e, d.id)} style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="New sub-department"
              value={subName[d.id] ?? ''}
              onChange={(e) => setSubName({ ...subName, [d.id]: e.target.value })}
            />
            <button className="btn small secondary">Add</button>
          </form>
        </div>
      ))}
    </div>
  );
}

export default function Admin() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [tab, setTab] = useState<'users' | 'departments'>('users');

  function reload() {
    api.get('/departments').then((r) => setDepartments(r.data));
  }
  useEffect(reload, []);

  return (
    <div>
      <div className="section-title"><h2>Admin Settings</h2></div>
      <div className="tab-bar">
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Users</button>
        <button className={tab === 'departments' ? 'active' : ''} onClick={() => setTab('departments')}>Departments</button>
      </div>
      {tab === 'users' ? <UsersAdmin departments={departments} /> : <DepartmentsAdmin departments={departments} reload={reload} />}
    </div>
  );
}
