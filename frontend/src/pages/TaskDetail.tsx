import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Task } from '../types';
import { StatusBadge } from '../components/StatusBadge';

const STATUSES = [
  'NOT_STARTED', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'SUBMITTED',
  'UNDER_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'COMPLETED', 'CANCELLED',
];

export default function TaskDetail() {
  const { id } = useParams();
  const [task, setTask] = useState<Task | null>(null);
  const [commentText, setCommentText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [completionPercent, setCompletionPercent] = useState(0);

  function reload() {
    api.get(`/tasks/${id}`).then((r) => {
      setTask(r.data);
      setStatus(r.data.status);
      setCompletionPercent(r.data.completionPercent);
    });
  }

  useEffect(() => { reload(); }, [id]);

  async function updateStatus(e: FormEvent) {
    e.preventDefault();
    await api.patch(`/tasks/${id}/status`, { status, completionPercent });
    reload();
  }

  async function addComment(e: FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    await api.post(`/tasks/${id}/comments`, { text: commentText });
    setCommentText('');
    reload();
  }

  async function uploadAttachment(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    await api.post(`/tasks/${id}/attachments`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    setFile(null);
    reload();
  }

  if (!task) return <p>Loading…</p>;

  return (
    <div>
      <div className="section-title">
        <h2>{task.title}</h2>
        <StatusBadge status={task.status} overdue={task.overdue} />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <p>{task.description || 'No description'}</p>
        <div className="form-grid">
          <div><strong>Task ID:</strong> {task.taskId}</div>
          <div><strong>Work Type:</strong> {task.workType}</div>
          <div><strong>Campaign:</strong> {task.campaign?.name ?? '—'}</div>
          <div><strong>Department:</strong> {task.department.name}</div>
          <div><strong>Assigned To:</strong> {task.assignedTo.name}</div>
          <div><strong>Created By:</strong> {task.createdBy.name}</div>
          <div><strong>Start Date:</strong> {new Date(task.startDate).toLocaleDateString()}</div>
          <div><strong>Due Date:</strong> {new Date(task.dueDate).toLocaleDateString()}</div>
          <div><strong>Priority:</strong> {task.priority}</div>
          <div><strong>Completion:</strong> {task.completionPercent}%</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Update Status</h3>
        <form onSubmit={updateStatus} className="form-grid">
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </label>
          <label>
            Completion %
            <input
              type="number"
              min={0}
              max={100}
              value={completionPercent}
              onChange={(e) => setCompletionPercent(Number(e.target.value))}
            />
          </label>
          <button className="btn" style={{ gridColumn: '1 / -1', justifySelf: 'start' }}>Save</button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Attachments</h3>
        <ul>
          {(task.attachments ?? []).map((a) => (
            <li key={a.id}>
              <a href={`${import.meta.env.VITE_API_URL}${a.filePath}`} target="_blank" rel="noreferrer">{a.fileName}</a>
            </li>
          ))}
          {(task.attachments ?? []).length === 0 && <p style={{ color: '#888' }}>No attachments yet.</p>}
        </ul>
        <form onSubmit={uploadAttachment}>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button className="btn small" style={{ marginLeft: 8 }}>Upload</button>
        </form>
      </div>

      <div className="card">
        <h3>Comments</h3>
        {(task.comments ?? []).map((c) => (
          <div key={c.id} style={{ marginBottom: 10, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
            <strong>{c.user.name}</strong> <span style={{ color: '#888', fontSize: '0.8rem' }}>{new Date(c.createdAt).toLocaleString()}</span>
            <p style={{ margin: '4px 0 0' }}>{c.text}</p>
          </div>
        ))}
        <form onSubmit={addComment}>
          <textarea
            style={{ width: '100%', minHeight: 60 }}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment…"
          />
          <button className="btn small" style={{ marginTop: 8 }}>Post comment</button>
        </form>
      </div>
    </div>
  );
}
