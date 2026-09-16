import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Campaign, CampaignProgress, Department } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../auth/AuthContext';

const canManage = ['ADMIN', 'GMA', 'AGM', 'MANAGER'];

export default function CampaignDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [progress, setProgress] = useState<CampaignProgress | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState('');

  function reload() {
    api.get(`/campaigns/${id}`).then((r) => setCampaign(r.data));
    api.get(`/campaigns/${id}/progress`).then((r) => setProgress(r.data));
  }

  useEffect(() => {
    reload();
    api.get('/departments').then((r) => setDepartments(r.data));
  }, [id]);

  async function attachDepartment(e: FormEvent) {
    e.preventDefault();
    if (!selectedDept) return;
    await api.post(`/campaigns/${id}/departments`, { departmentId: selectedDept });
    setSelectedDept('');
    reload();
  }

  if (!campaign) return <p>Loading…</p>;

  const attachedIds = new Set(campaign.departments.map((d) => d.department.id));
  const available = departments.filter((d) => !attachedIds.has(d.id));

  return (
    <div>
      <div className="section-title">
        <h2>{campaign.name} <span style={{ color: '#888', fontWeight: 400 }}>({campaign.code})</span></h2>
        <span className="badge">{campaign.status}</span>
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <p>{campaign.description}</p>
        <div className="form-grid">
          <div><strong>Owner:</strong> {campaign.owner.name}</div>
          <div><strong>Priority:</strong> {campaign.priority}</div>
          <div><strong>Budget:</strong> {campaign.budget ?? '—'}</div>
          <div><strong>Dates:</strong> {new Date(campaign.startDate).toLocaleDateString()} – {new Date(campaign.endDate).toLocaleDateString()}</div>
        </div>
      </div>

      <div className="section-title"><h2>Department Progress</h2></div>
      {progress?.departments.length === 0 && <p>No departments attached yet.</p>}
      {progress?.departments.map((d) => (
        <div className="card" key={d.department.id} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <strong>{d.department.name}</strong>
            <span>{d.completionPercent}% ({d.completedCount}/{d.taskCount} tasks completed)</span>
          </div>
          <div className="progress-bar"><div style={{ width: `${d.completionPercent}%` }} /></div>
          {d.tasks.length > 0 && (
            <table style={{ marginTop: 10 }}>
              <thead><tr><th>Task</th><th>Assigned To</th><th>Due</th><th>Status</th></tr></thead>
              <tbody>
                {d.tasks.map((t) => (
                  <tr key={t.id}>
                    <td><Link to={`/tasks/${t.id}`}>{t.title}</Link></td>
                    <td>{t.assignedTo}</td>
                    <td>{new Date(t.dueDate).toLocaleDateString()}</td>
                    <td><StatusBadge status={t.status} overdue={t.overdue} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}

      {user && canManage.includes(user.role) && available.length > 0 && (
        <form className="card" onSubmit={attachDepartment}>
          <strong>Attach a department</strong>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
              <option value="">Select department</option>
              {available.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button className="btn small">Attach</button>
          </div>
        </form>
      )}
    </div>
  );
}
