import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Campaign, Department, User } from '../types';
import { useAuth } from '../auth/AuthContext';

const canCreate = ['ADMIN', 'GMA', 'AGM', 'MANAGER', 'COORDINATOR'];

export default function Campaigns() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState({
    code: '', name: '', type: '', description: '', startDate: '', endDate: '',
    coordinatorId: '', priority: 'MEDIUM', status: 'DRAFT',
  });
  const [selectedDeptIds, setSelectedDeptIds] = useState<Set<string>>(new Set());
  const [accessDeptIds, setAccessDeptIds] = useState<Set<string>>(new Set());
  const [accessStaffIds, setAccessStaffIds] = useState<Set<string>>(new Set());
  const [expandedDept, setExpandedDept] = useState<string | null>(null);

  function reload() {
    api.get('/campaigns').then((r) => setCampaigns(r.data));
  }

  useEffect(() => {
    reload();
    api.get('/users').then((r) => setUsers(r.data));
    api.get('/departments').then((r) => setDepartments(r.data));
  }, []);

  function toggleAllDepartments(target: Set<string>, setter: (s: Set<string>) => void) {
    setter(target.size === departments.length ? new Set() : new Set(departments.map((d) => d.id)));
  }

  function staffFor(departmentId: string) {
    return users.filter((u) => u.departmentId === departmentId && u.status === 'ACTIVE');
  }

  function toggleAllStaffForDept(deptId: string) {
    const staff = staffFor(deptId);
    const allSelected = staff.every((s) => accessStaffIds.has(s.id));
    setAccessStaffIds((prev) => {
      const next = new Set(prev);
      staff.forEach((s) => (allSelected ? next.delete(s.id) : next.add(s.id)));
      return next;
    });
  }

  async function createCampaign(e: FormEvent) {
    e.preventDefault();
    const access = [
      ...Array.from(accessDeptIds).map((departmentId) => ({ departmentId })),
      ...Array.from(accessStaffIds).map((userId) => ({ userId })),
    ];
    await api.post('/campaigns', {
      ...form,
      departmentIds: Array.from(selectedDeptIds),
      access,
    });
    setShowForm(false);
    setForm({ code: '', name: '', type: '', description: '', startDate: '', endDate: '', coordinatorId: '', priority: 'MEDIUM', status: 'DRAFT' });
    setSelectedDeptIds(new Set());
    setAccessDeptIds(new Set());
    setAccessStaffIds(new Set());
    reload();
  }

  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        c.campaignNumber?.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.coordinator?.name.toLowerCase().includes(q)
      );
    });
  }, [campaigns, search, statusFilter]);

  return (
    <div>
      <div className="section-title">
        <h2>Campaigns</h2>
        {user && canCreate.includes(user.role) && (
          <button className="btn" onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : 'New Campaign'}</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="Search by campaign number, code, name, coordinator…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 280 }}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {['DRAFT', 'PLANNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'CLOSED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {showForm && (
        <form className="card" onSubmit={createCampaign} style={{ marginBottom: 20 }}>
          <p style={{ color: '#888', margin: '0 0 8px' }}>Campaign Number is generated automatically once created.</p>
          <div className="form-grid">
            <label>Code<input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
            <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Type<input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} /></label>
            <label>Coordinator
              <select value={form.coordinatorId} onChange={(e) => setForm({ ...form, coordinatorId: e.target.value })}>
                <option value="">Select coordinator</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            <label>Start Date<input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
            <label>End Date<input type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
            <label>Priority
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          </div>
          <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>

          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>Departments Involved</strong>
              <label style={{ fontWeight: 400 }}>
                <input type="checkbox" checked={selectedDeptIds.size === departments.length && departments.length > 0} onChange={() => toggleAllDepartments(selectedDeptIds, setSelectedDeptIds)} /> Select All Departments
              </label>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {departments.map((d) => (
                <label key={d.id} className="badge" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedDeptIds.has(d.id)}
                    onChange={() => setSelectedDeptIds((prev) => {
                      const next = new Set(prev);
                      next.has(d.id) ? next.delete(d.id) : next.add(d.id);
                      return next;
                    })}
                    style={{ marginRight: 6 }}
                  />
                  {d.name}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>Campaign Access (who can view/act on this campaign)</strong>
              <label style={{ fontWeight: 400 }}>
                <input type="checkbox" checked={accessDeptIds.size === departments.length && departments.length > 0} onChange={() => toggleAllDepartments(accessDeptIds, setAccessDeptIds)} /> Select All Departments
              </label>
            </div>
            <p style={{ color: '#888', fontSize: 13, margin: '4px 0' }}>
              Management roles (GMA/AGM/Coordinator/Admin) always have full access. Everyone else needs
              their department, or themselves individually, granted here.
            </p>
            {departments.map((d) => (
              <div key={d.id} className="card" style={{ marginBottom: 8, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={accessDeptIds.has(d.id)}
                      onChange={() => setAccessDeptIds((prev) => {
                        const next = new Set(prev);
                        next.has(d.id) ? next.delete(d.id) : next.add(d.id);
                        return next;
                      })}
                      style={{ marginRight: 6 }}
                    />
                    {d.name}
                  </label>
                  <button type="button" className="btn small secondary" onClick={() => setExpandedDept(expandedDept === d.id ? null : d.id)}>
                    {expandedDept === d.id ? 'Hide staff' : 'Show staff'}
                  </button>
                </div>
                {expandedDept === d.id && (
                  <div style={{ marginTop: 8 }}>
                    <label style={{ fontSize: 13 }}>
                      <input type="checkbox" checked={staffFor(d.id).length > 0 && staffFor(d.id).every((s) => accessStaffIds.has(s.id))} onChange={() => toggleAllStaffForDept(d.id)} /> Select All Staff
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                      {staffFor(d.id).map((s) => (
                        <label key={s.id} className="badge" style={{ cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={accessStaffIds.has(s.id)}
                            onChange={() => setAccessStaffIds((prev) => {
                              const next = new Set(prev);
                              next.has(s.id) ? next.delete(s.id) : next.add(s.id);
                              return next;
                            })}
                            style={{ marginRight: 6 }}
                          />
                          {s.name}
                        </label>
                      ))}
                      {staffFor(d.id).length === 0 && <span style={{ color: '#888' }}>No staff in this department.</span>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button className="btn" style={{ marginTop: 10 }}>Create Campaign</button>
        </form>
      )}

      <div className="table-scroll">
      <table>
        <thead>
          <tr><th>Campaign #</th><th>Code</th><th>Name</th><th>Coordinator</th><th>Status</th><th>Priority</th><th>Tasks</th><th>Dates</th></tr>
        </thead>
        <tbody>
          {filtered.map((c) => (
            <tr key={c.id}>
              <td>{c.campaignNumber}</td>
              <td>{c.code}</td>
              <td><Link to={`/campaigns/${c.id}`}>{c.name}</Link></td>
              <td>{c.coordinator?.name}</td>
              <td><span className="badge">{c.status}</span></td>
              <td>{c.priority}</td>
              <td>{c._count?.tasks ?? 0}</td>
              <td>{new Date(c.startDate).toLocaleDateString()} – {new Date(c.endDate).toLocaleDateString()}</td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan={8} style={{ color: '#888' }}>No campaigns found.</td></tr>}
        </tbody>
      </table>
      </div>
    </div>
  );
}
