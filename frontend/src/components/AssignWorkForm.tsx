import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api/client';
import type { Department, User } from '../types';

/**
 * Shared "Add Task" / "Add Work" flow (items 3 & 4): pick a department, pick
 * staff (individually or Select All), fill in the task fields, and bulk
 * create one Task per selected staff member via POST /tasks/bulk.
 */
export default function AssignWorkForm({
  departments,
  workType,
  campaignId,
  onDone,
  onCancel,
}: {
  departments: Department[];
  workType: 'CAMPAIGN' | 'DAILY';
  campaignId?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [departmentId, setDepartmentId] = useState('');
  const [staff, setStaff] = useState<User[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!departmentId) {
      setStaff([]);
      setSelected(new Set());
      return;
    }
    api.get('/users', { params: { departmentId } }).then((r) => {
      setStaff(r.data.filter((u: User) => u.status === 'ACTIVE'));
      setSelected(new Set());
    });
  }, [departmentId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === staff.length ? new Set() : new Set(staff.map((s) => s.id))));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!title || !departmentId || !dueDate || selected.size === 0) {
      setError('Title, department, due date and at least one staff member are required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/tasks/bulk', {
        title,
        description,
        workType,
        campaignId: campaignId ?? undefined,
        departmentId,
        startDate,
        dueDate,
        priority,
        assignedToIds: Array.from(selected),
      });
      onDone();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to create tasks');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card" onSubmit={submit} style={{ marginBottom: 20 }}>
      <strong>{workType === 'CAMPAIGN' ? 'Add Task' : 'Add Work'}</strong>
      {error && <p className="error-text">{error}</p>}
      <div className="form-grid" style={{ marginTop: 10 }}>
        <label>Title<input required value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label>Department
          <select required value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">Select department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label>Start Date<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
        <label>Due Date<input required type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
        <label>Priority
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      </div>
      <label>Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} /></label>

      {departmentId && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Assign to staff</strong>
            {staff.length > 0 && (
              <label style={{ fontWeight: 400 }}>
                <input type="checkbox" checked={selected.size === staff.length} onChange={toggleAll} /> Select All Staff
              </label>
            )}
          </div>
          {staff.length === 0 && <p style={{ color: '#888' }}>No active staff in this department.</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
            {staff.map((s) => (
              <label key={s.id} className="badge" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} style={{ marginRight: 6 }} />
                {s.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="btn" disabled={submitting}>{submitting ? 'Creating…' : `Create (${selected.size})`}</button>
        <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
