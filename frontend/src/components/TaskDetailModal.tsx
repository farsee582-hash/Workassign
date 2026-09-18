import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Task } from '../types';
import { StatusBadge } from './StatusBadge';
import { regionLabel } from '../lib/digitalMarketing';

const STATUSES = [
  'NOT_STARTED', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'SUBMITTED',
  'UNDER_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'COMPLETED', 'CANCELLED',
];

/**
 * Task detail panel as a modal (item 13). Reuses the same
 * GET/PATCH /tasks/:id endpoints as the full TaskDetail page (which stays
 * the canonical deep-linkable view) instead of duplicating task logic.
 */
export default function TaskDetailModal({ taskId, onClose, onChanged }: { taskId: string; onClose: () => void; onChanged?: () => void }) {
  const [task, setTask] = useState<Task | null>(null);
  const [status, setStatus] = useState('');
  const [completionPercent, setCompletionPercent] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [file, setFile] = useState<File | null>(null);

  function reload() {
    api.get(`/tasks/${taskId}`).then((r) => {
      setTask(r.data);
      setStatus(r.data.status);
      setCompletionPercent(r.data.completionPercent);
    });
  }

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [taskId]);

  async function updateStatus(e: FormEvent) {
    e.preventDefault();
    await api.patch(`/tasks/${taskId}/status`, { status, completionPercent });
    reload();
    onChanged?.();
  }

  async function addComment(e: FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    await api.post(`/tasks/${taskId}/comments`, { text: commentText });
    setCommentText('');
    reload();
  }

  async function uploadAttachment(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    await api.post(`/tasks/${taskId}/attachments`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    setFile(null);
    reload();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel card" onClick={(e) => e.stopPropagation()}>
        <button className="btn secondary small modal-close" onClick={onClose} aria-label="Close">✕</button>
        {!task && <p>Loading…</p>}
        {task && (
          <>
            <div className="section-title" style={{ marginTop: 0 }}>
              <h3 style={{ margin: 0 }}>{task.title}</h3>
              <StatusBadge status={task.status} overdue={task.overdue} />
            </div>
            <p style={{ color: '#746a5c' }}>{task.description || 'No description'}</p>
            <div className="form-grid">
              <div><strong>Task ID:</strong> {task.taskId}</div>
              <div><strong>Work Type:</strong> {task.dmWorkType ?? task.workType}</div>
              <div><strong>Region:</strong> {regionLabel(task.region)}</div>
              <div><strong>Campaign:</strong> {task.campaign?.name ?? '—'}</div>
              <div><strong>Department:</strong> {task.department.name}{task.subDepartment ? ` / ${task.subDepartment.name}` : ''}</div>
              <div><strong>Assigned To:</strong> {task.assignedTo.name}</div>
              <div><strong>Start Date:</strong> {new Date(task.startDate).toLocaleDateString()}</div>
              <div><strong>Due Date:</strong> {new Date(task.dueDate).toLocaleDateString()}</div>
              <div><strong>Priority:</strong> {task.priority}</div>
              <div><strong>Completion:</strong> {task.completionPercent}%</div>
            </div>
            <p style={{ marginTop: 4 }}><Link to={`/tasks/${task.id}`}>Open full task page →</Link></p>

            <form onSubmit={updateStatus} className="form-grid" style={{ marginTop: 10 }}>
              <label>Status
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </label>
              <label>Completion %
                <input type="number" min={0} max={100} value={completionPercent} onChange={(e) => setCompletionPercent(Number(e.target.value))} />
              </label>
              <button className="btn" style={{ gridColumn: '1 / -1', justifySelf: 'start' }}>Save</button>
            </form>

            <div style={{ marginTop: 16 }}>
              <strong>Attachments</strong>
              <ul>
                {(task.attachments ?? []).map((a) => <li key={a.id}>{a.fileName}</li>)}
                {(task.attachments ?? []).length === 0 && <p style={{ color: '#888' }}>No attachments yet.</p>}
              </ul>
              <form onSubmit={uploadAttachment}>
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <button className="btn small" style={{ marginLeft: 8 }}>Upload</button>
              </form>
            </div>

            <div style={{ marginTop: 16 }}>
              <strong>Comments</strong>
              {(task.comments ?? []).map((c) => (
                <div key={c.id} style={{ marginTop: 8, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                  <strong>{c.user.name}</strong> <span style={{ color: '#888', fontSize: '0.8rem' }}>{new Date(c.createdAt).toLocaleString()}</span>
                  <p style={{ margin: '4px 0 0' }}>{c.text}</p>
                </div>
              ))}
              <form onSubmit={addComment} style={{ marginTop: 8 }}>
                <textarea style={{ width: '100%', minHeight: 60 }} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add a comment…" />
                <button className="btn small" style={{ marginTop: 8 }}>Post comment</button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
