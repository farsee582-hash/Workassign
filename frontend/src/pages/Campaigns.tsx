import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Campaign, User } from '../types';
import { useAuth } from '../auth/AuthContext';

const canCreate = ['ADMIN', 'GMA', 'AGM', 'MANAGER'];

export default function Campaigns() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: '', name: '', type: '', description: '', startDate: '', endDate: '',
    ownerId: '', priority: 'MEDIUM', budget: '', status: 'DRAFT',
  });

  function reload() {
    api.get('/campaigns').then((r) => setCampaigns(r.data));
  }

  useEffect(() => {
    reload();
    api.get('/users').then((r) => setUsers(r.data));
  }, []);

  async function createCampaign(e: FormEvent) {
    e.preventDefault();
    await api.post('/campaigns', { ...form, budget: form.budget ? Number(form.budget) : undefined });
    setShowForm(false);
    setForm({ code: '', name: '', type: '', description: '', startDate: '', endDate: '', ownerId: '', priority: 'MEDIUM', budget: '', status: 'DRAFT' });
    reload();
  }

  return (
    <div>
      <div className="section-title">
        <h2>Campaigns</h2>
        {user && canCreate.includes(user.role) && (
          <button className="btn" onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : 'New Campaign'}</button>
        )}
      </div>

      {showForm && (
        <form className="card" onSubmit={createCampaign} style={{ marginBottom: 20 }}>
          <div className="form-grid">
            <label>Code<input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
            <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Type<input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} /></label>
            <label>Owner
              <select value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })}>
                <option value="">Select owner</option>
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
            <label>Budget<input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></label>
          </div>
          <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <button className="btn" style={{ marginTop: 10 }}>Create Campaign</button>
        </form>
      )}

      <table>
        <thead>
          <tr><th>Code</th><th>Name</th><th>Owner</th><th>Status</th><th>Priority</th><th>Tasks</th><th>Dates</th></tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id}>
              <td>{c.code}</td>
              <td><Link to={`/campaigns/${c.id}`}>{c.name}</Link></td>
              <td>{c.owner.name}</td>
              <td><span className="badge">{c.status}</span></td>
              <td>{c.priority}</td>
              <td>{c._count?.tasks ?? 0}</td>
              <td>{new Date(c.startDate).toLocaleDateString()} – {new Date(c.endDate).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
