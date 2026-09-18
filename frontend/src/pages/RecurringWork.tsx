import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api/client';
import type { Department, RecurringWorkTemplate, User } from '../types';
import { useAuth } from '../auth/AuthContext';
import { DM_WORK_TYPES, REGIONS } from '../lib/digitalMarketing';

const canManage = ['GMA', 'AGM', 'COORDINATOR', 'MANAGER', 'ADMIN'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function RecurringWork() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<RecurringWorkTemplate[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', departmentId: '', subDepartmentId: '', assignedToId: '',
    recurrenceType: 'DAILY', weekday: '1', dayOfMonth: '1', priority: 'MEDIUM',
    region: '', dmWorkType: '',
  });
  const selectedDept = departments.find((d) => d.id === form.departmentId);
  const selectedSub = selectedDept?.subDepartments.find((s) => s.id === form.subDepartmentId);

  function reload() {
    api.get('/recurring-work').then((r) => setTemplates(r.data));
  }

  useEffect(() => {
    reload();
    api.get('/departments').then((r) => setDepartments(r.data));
    // Idempotently ensure today's occurrences exist (item 5) — no cron in
    // this environment, so this runs once when the page loads.
    api.get('/recurring-work/generate').catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.departmentId) { setStaff([]); return; }
    api.get('/users', { params: { departmentId: form.departmentId } }).then((r) => setStaff(r.data));
  }, [form.departmentId]);

  async function createTemplate(e: FormEvent) {
    e.preventDefault();
    await api.post('/recurring-work', {
      ...form,
      subDepartmentId: form.subDepartmentId || undefined,
      assignedToId: form.assignedToId || undefined,
      weekday: form.recurrenceType === 'WEEKLY' ? Number(form.weekday) : undefined,
      dayOfMonth: form.recurrenceType === 'MONTHLY' ? Number(form.dayOfMonth) : undefined,
      region: form.region || undefined,
      dmWorkType: form.dmWorkType || undefined,
    });
    setShowForm(false);
    setForm({ title: '', description: '', departmentId: '', subDepartmentId: '', assignedToId: '', recurrenceType: 'DAILY', weekday: '1', dayOfMonth: '1', priority: 'MEDIUM', region: '', dmWorkType: '' });
    reload();
  }

  async function deactivate(id: string) {
    await api.patch(`/recurring-work/${id}`, { active: false });
    reload();
  }

  const allowed = user && canManage.includes(user.role);

  return (
    <div>
      <div className="section-title">
        <h2>Recurring Daily Work</h2>
        {allowed && <button className="btn" onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : 'New Recurring Template'}</button>}
      </div>
      <p style={{ color: '#888', marginTop: -8 }}>
        Recurring occurrences are generated the moment someone opens this page or Daily Work
        (there is no scheduler in this environment) — each occurrence becomes a normal, independently
        completable Daily Work task.
      </p>

      {allowed && showForm && (
        <form className="card" onSubmit={createTemplate} style={{ marginBottom: 20 }}>
          <div className="form-grid">
            <label>Title<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label>Department
              <select required value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                <option value="">Select department</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            {selectedDept && selectedDept.subDepartments.length > 0 && (
              <label>Sub-department
                <select value={form.subDepartmentId} onChange={(e) => setForm({ ...form, subDepartmentId: e.target.value })}>
                  <option value="">All / none</option>
                  {selectedDept.subDepartments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            )}
            {selectedSub?.name === 'Digital Marketing' && (
              <>
                <label>Region
                  <select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>
                    <option value="">Not set</option>
                    {REGIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </label>
                <label>Work Type
                  <select value={form.dmWorkType} onChange={(e) => setForm({ ...form, dmWorkType: e.target.value })}>
                    <option value="">Not set</option>
                    {DM_WORK_TYPES.map((w) => <option key={w} value={w}>{w}</option>)}
                  </select>
                </label>
              </>
            )}
            <label>Assign To
              <select value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}>
                <option value="">All staff in department</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label>Recurrence
              <select value={form.recurrenceType} onChange={(e) => setForm({ ...form, recurrenceType: e.target.value })}>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </label>
            {form.recurrenceType === 'WEEKLY' && (
              <label>Weekday
                <select value={form.weekday} onChange={(e) => setForm({ ...form, weekday: e.target.value })}>
                  {WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}
                </select>
              </label>
            )}
            {form.recurrenceType === 'MONTHLY' && (
              <label>Day of Month
                <input type="number" min={1} max={31} value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })} />
              </label>
            )}
            <label>Priority
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          </div>
          <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <button className="btn" style={{ marginTop: 10 }}>Create Template</button>
        </form>
      )}

      <div className="table-scroll">
      <table>
        <thead><tr><th>Title</th><th>Department</th><th>Assigned To</th><th>Recurrence</th><th>Priority</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {templates.map((t) => (
            <tr key={t.id}>
              <td>{t.title}</td>
              <td>{t.department.name}</td>
              <td>{t.assignedTo?.name ?? 'All staff'}</td>
              <td>
                {t.recurrenceType === 'DAILY' && 'Daily'}
                {t.recurrenceType === 'WEEKLY' && `Weekly (${WEEKDAYS[t.weekday ?? 0]})`}
                {t.recurrenceType === 'MONTHLY' && `Monthly (day ${t.dayOfMonth})`}
              </td>
              <td>{t.priority}</td>
              <td><span className="badge">{t.active ? 'Active' : 'Inactive'}</span></td>
              <td>{allowed && t.active && <button className="btn small secondary" onClick={() => deactivate(t.id)}>Deactivate</button>}</td>
            </tr>
          ))}
          {templates.length === 0 && <tr><td colSpan={7} style={{ color: '#888' }}>No recurring templates yet.</td></tr>}
        </tbody>
      </table>
      </div>
    </div>
  );
}
