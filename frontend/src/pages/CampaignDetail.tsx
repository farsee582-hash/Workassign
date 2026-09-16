import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Campaign, CampaignMessage, CampaignProgress, Department } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../auth/AuthContext';
import AssignWorkForm from '../components/AssignWorkForm';

const canManage = ['ADMIN', 'GMA', 'AGM', 'MANAGER', 'COORDINATOR'];
const canAssignRoles = ['GMA', 'AGM', 'COORDINATOR', 'MANAGER', 'ADMIN'];

function ChatPanel({ campaignId }: { campaignId: string }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<CampaignMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  function load() {
    api.get(`/campaigns/${campaignId}/messages`).then((r) => setMessages(r.data)).catch(() => {});
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, [campaignId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.post(`/campaigns/${campaignId}/messages`, { text: text.trim() });
      setText('');
      load();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 480 }}>
      <strong style={{ marginBottom: 8 }}>Campaign Chat</strong>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ background: m.userId === user?.id ? '#eaf1ff' : '#f4f5f7', borderRadius: 6, padding: '6px 8px' }}>
            <div style={{ fontSize: 12, color: '#666', display: 'flex', justifyContent: 'space-between' }}>
              <span><strong>{m.user.name}</strong>{m.user.department ? ` · ${m.user.department.name}` : ''}</span>
              <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div style={{ fontSize: 14 }}>{m.text}</div>
          </div>
        ))}
        {messages.length === 0 && <p style={{ color: '#888' }}>No messages yet.</p>}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <input
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ flex: 1 }}
        />
        <button className="btn small" disabled={sending}>Send</button>
      </form>
    </div>
  );
}

export default function CampaignDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [progress, setProgress] = useState<CampaignProgress | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  function reload() {
    api.get(`/campaigns/${id}`).then((r) => setCampaign(r.data)).catch((e) => {
      if (e?.response?.status === 403) setForbidden(true);
    });
    api.get(`/campaigns/${id}/progress`).then((r) => setProgress(r.data)).catch(() => {});
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

  if (forbidden) return <p>You do not have access to this campaign.</p>;
  if (!campaign) return <p>Loading…</p>;

  const attachedIds = new Set(campaign.departments.map((d) => d.department.id));
  const available = departments.filter((d) => !attachedIds.has(d.id));
  const involvedDepartments = campaign.departments.map((d) => d.department);
  const canAddTask = !!user && (canAssignRoles.includes(user.role) || campaign.coordinatorId === user.id);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 20, alignItems: 'start' }}>
      <div>
        <div className="section-title">
          <h2>{campaign.name} <span style={{ color: '#888', fontWeight: 400 }}>({campaign.campaignNumber})</span></h2>
          <span className="badge">{campaign.status}</span>
        </div>
        <div className="card" style={{ marginBottom: 20 }}>
          <p>{campaign.description}</p>
          <div className="form-grid">
            <div><strong>Campaign Number:</strong> {campaign.campaignNumber}</div>
            <div><strong>Code:</strong> {campaign.code}</div>
            <div><strong>Coordinator:</strong> {campaign.coordinator?.name}</div>
            <div><strong>Priority:</strong> {campaign.priority}</div>
            <div><strong>Dates:</strong> {new Date(campaign.startDate).toLocaleDateString()} – {new Date(campaign.endDate).toLocaleDateString()}</div>
          </div>
        </div>

        <div className="section-title">
          <h2>Department Progress</h2>
          {canAddTask && (
            <button className="btn" onClick={() => setShowAddTask((v) => !v)}>{showAddTask ? 'Cancel' : 'Add Task'}</button>
          )}
        </div>

        {showAddTask && canAddTask && (
          <AssignWorkForm
            departments={involvedDepartments}
            workType="CAMPAIGN"
            campaignId={campaign.id}
            onDone={() => { setShowAddTask(false); reload(); }}
            onCancel={() => setShowAddTask(false)}
          />
        )}

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

      <ChatPanel campaignId={campaign.id} />
    </div>
  );
}
