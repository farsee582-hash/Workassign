import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { Campaign, Department, DepartmentGoal, DepartmentTodo, SubDepartment, Task, User } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import MonthCalendar from '../components/MonthCalendar';
import type { CalendarView } from '../components/MonthCalendar';
import TaskDetailModal from '../components/TaskDetailModal';
import { BarChart, DonutChart } from '../components/Charts';
import { DM_WORK_TYPES, DM_STATUS_OPTIONS, REGIONS, regionColor, regionLabel } from '../lib/digitalMarketing';
import AssignWorkForm from '../components/AssignWorkForm';

type PageTab = 'work' | 'calendar' | 'chart';

const canManage = ['GMA', 'AGM', 'COORDINATOR', 'MANAGER', 'ADMIN'];

/**
 * Department-wise Work Management page — Marketing > Digital Marketing.
 * Everything below is parametrized by departmentId/subDepartmentId (found by
 * name once on load), not hardcoded, so this same component can be reused
 * for a future department by pointing it at a different sub-department.
 */
export default function DigitalMarketing() {
  const { user } = useAuth();
  const [dept, setDept] = useState<Department | null>(null);
  const [sub, setSub] = useState<SubDepartment | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [goals, setGoals] = useState<DepartmentGoal[]>([]);
  const [todos, setTodos] = useState<DepartmentTodo[]>([]);
  const [tab, setTab] = useState<PageTab>('calendar');
  const [view, setView] = useState<CalendarView>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showAssignForm, setShowAssignForm] = useState(false);

  // Filters — shared across Work / Calendar / Chart tabs.
  const [regionFilter, setRegionFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [workTypeFilter, setWorkTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('');

  function reloadTasks(departmentId: string, subDepartmentId: string) {
    api.get('/tasks', { params: { departmentId, subDepartmentId } }).then((r) => setTasks(r.data));
  }

  useEffect(() => {
    api.get('/departments').then((r) => {
      const departments: Department[] = r.data;
      const marketing = departments.find((d) => d.name === 'Marketing') ?? null;
      setDept(marketing);
      const digitalMarketing = marketing?.subDepartments.find((s) => s.name === 'Digital Marketing') ?? null;
      setSub(digitalMarketing);
      if (marketing && digitalMarketing) {
        reloadTasks(marketing.id, digitalMarketing.id);
        api.get('/users', { params: { departmentId: marketing.id } }).then((ur) => setStaff(ur.data));
        api.get(`/department-work/${marketing.id}/goals`, { params: { subDepartmentId: digitalMarketing.id } }).then((gr) => setGoals(gr.data));
        api.get(`/department-work/${marketing.id}/todos`, { params: { subDepartmentId: digitalMarketing.id } }).then((tr) => setTodos(tr.data));
      }
    });
    api.get('/campaigns').then((r) => setCampaigns(r.data)).catch(() => {});
    api.get('/recurring-work/generate').catch(() => {});
  }, []);

  function reload() {
    if (dept && sub) reloadTasks(dept.id, sub.id);
  }

  const filtered = useMemo(() => {
    return tasks
      .filter((t) => (regionFilter ? t.region === regionFilter : true))
      .filter((t) => (staffFilter ? t.assignedToId === staffFilter : true))
      .filter((t) => (workTypeFilter ? t.dmWorkType === workTypeFilter : true))
      .filter((t) => (campaignFilter ? t.campaignId === campaignFilter : true))
      .filter((t) => {
        if (!statusFilter) return true;
        if (statusFilter === 'OVERDUE') return t.overdue;
        return t.status === statusFilter;
      });
  }, [tasks, regionFilter, staffFilter, workTypeFilter, statusFilter, campaignFilter]);

  const summary = useMemo(() => {
    const total = filtered.length;
    const done = filtered.filter((t) => t.status === 'COMPLETED').length;
    const pending = total - done;
    const avgCompletion = total ? Math.round(filtered.reduce((s, t) => s + t.completionPercent, 0) / total) : 0;
    return { total, done, pending, avgCompletion };
  }, [filtered]);

  const canManageHere = user && canManage.includes(user.role);

  function shiftAnchor(dir: 1 | -1) {
    setAnchor((d) => {
      const c = new Date(d);
      if (view === 'day') c.setDate(c.getDate() + dir);
      else if (view === 'week') c.setDate(c.getDate() + dir * 7);
      else if (view === 'month') c.setMonth(c.getMonth() + dir);
      else c.setFullYear(c.getFullYear() + dir);
      return c;
    });
  }

  async function addGoal(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dept || !sub) return;
    const text = (new FormData(e.currentTarget).get('text') as string)?.trim();
    if (!text) return;
    const r = await api.post(`/department-work/${dept.id}/goals`, { text, subDepartmentId: sub.id, order: goals.length });
    setGoals([...goals, r.data]);
    e.currentTarget.reset();
  }

  async function removeGoal(id: string) {
    await api.delete(`/department-work/goals/${id}`);
    setGoals(goals.filter((g) => g.id !== id));
  }

  async function addTodo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dept || !sub) return;
    const text = (new FormData(e.currentTarget).get('text') as string)?.trim();
    if (!text) return;
    const r = await api.post(`/department-work/${dept.id}/todos`, { text, subDepartmentId: sub.id, order: todos.length });
    setTodos([...todos, r.data]);
    e.currentTarget.reset();
  }

  async function toggleTodo(t: DepartmentTodo) {
    const r = await api.patch(`/department-work/todos/${t.id}`, { done: !t.done });
    setTodos(todos.map((x) => (x.id === t.id ? r.data : x)));
  }

  async function removeTodo(id: string) {
    await api.delete(`/department-work/todos/${id}`);
    setTodos(todos.filter((t) => t.id !== id));
  }

  if (!dept || !sub) {
    return (
      <div>
        <div className="section-title"><h2>Digital Marketing</h2></div>
        <p style={{ color: '#888' }}>Loading department…</p>
      </div>
    );
  }

  const anchorLabel =
    view === 'month' ? anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : view === 'year' ? String(anchor.getFullYear())
    : view === 'week' ? `Week of ${anchor.toLocaleDateString()}`
    : anchor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div>
      <div className="section-title">
        <h2>Marketing / Digital Marketing</h2>
        {canManageHere && <button className="btn" onClick={() => setShowAssignForm((v) => !v)}>{showAssignForm ? 'Cancel' : 'New Task'}</button>}
      </div>

      {showAssignForm && dept && (
        <AssignWorkForm
          departments={[dept]}
          workType="DAILY"
          defaultDepartmentId={dept.id}
          defaultSubDepartmentId={sub.id}
          onDone={() => { setShowAssignForm(false); reload(); }}
          onCancel={() => setShowAssignForm(false)}
        />
      )}

      <div className="dw-summary-row">
        <div className="dw-summary-card"><div className="value">{summary.avgCompletion}%</div><div className="label">Completion</div></div>
        <div className="dw-summary-card"><div className="value">{summary.pending}</div><div className="label">Pending</div></div>
        <div className="dw-summary-card"><div className="value">{summary.done}</div><div className="label">Done</div></div>
        <div className="dw-summary-card"><div className="value">{summary.total}</div><div className="label">Total Tasks</div></div>
      </div>

      <div className="tab-bar">
        {(['work', 'calendar', 'chart'] as PageTab[]).map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      <div className="calendar-filter-bar" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
          <option value="">All regions</option>
          {REGIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
          <option value="">All staff</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={workTypeFilter} onChange={(e) => setWorkTypeFilter(e.target.value)}>
          <option value="">All work types</option>
          {DM_WORK_TYPES.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {DM_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)}>
          <option value="">All campaigns</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.campaignNumber ?? c.code} — {c.name}</option>)}
        </select>
      </div>

      {tab === 'work' && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Task ID</th><th>Task Name</th><th>Work Type</th><th>Region</th><th>Campaign</th>
                <th>Assigned Staff</th><th>Start</th><th>Due</th><th>Priority</th><th>Status</th><th>Completion</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedTaskId(t.id)}>
                  <td>{t.taskId}</td>
                  <td>{t.title}</td>
                  <td>{t.dmWorkType ?? '—'}</td>
                  <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: regionColor(t.region) }} />{regionLabel(t.region)}</span></td>
                  <td>{t.campaign ? `${t.campaign.code} — ${t.campaign.name}` : '—'}</td>
                  <td>{t.assignedTo.name}</td>
                  <td>{new Date(t.startDate).toLocaleDateString()}</td>
                  <td>{new Date(t.dueDate).toLocaleDateString()}</td>
                  <td>{t.priority}</td>
                  <td><StatusBadge status={t.status} overdue={t.overdue} /></td>
                  <td>{t.completionPercent}%</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={11} style={{ color: '#888' }}>No Digital Marketing tasks match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'calendar' && (
        <div>
          <div className="calendar-nav">
            <div className="calendar-nav-controls">
              <button className="btn secondary small" onClick={() => shiftAnchor(-1)} aria-label="Previous">‹</button>
              <button className="btn secondary small" onClick={() => setAnchor(new Date())}>Today</button>
              <button className="btn secondary small" onClick={() => shiftAnchor(1)} aria-label="Next">›</button>
            </div>
            <h3 className="calendar-month-label">{anchorLabel}</h3>
            <div className="tab-bar" style={{ marginBottom: 0 }}>
              {(['day', 'week', 'month', 'year'] as CalendarView[]).map((v) => (
                <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>
              ))}
            </div>
          </div>

          <MonthCalendar
            view={view}
            anchor={anchor}
            tasks={filtered}
            onSelectTask={(t) => setSelectedTaskId(t.id)}
            onPickDay={(d) => { setAnchor(d); if (view === 'year') setView('month'); }}
          />

          <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginTop: 24 }}>
            <div className="card">
              <h3>Top Goals</h3>
              <ul className="dw-widget-list">
                {goals.map((g) => (
                  <li key={g.id}>
                    <span style={{ flex: 1 }}>{g.text}</span>
                    {canManageHere && <button className="btn secondary small" onClick={() => removeGoal(g.id)}>Remove</button>}
                  </li>
                ))}
                {goals.length === 0 && <li style={{ color: '#888' }}>No goals set yet.</li>}
              </ul>
              {canManageHere && (
                <form className="dw-widget-add" onSubmit={addGoal}>
                  <input name="text" placeholder="Add a goal…" />
                  <button className="btn small">Add</button>
                </form>
              )}
            </div>
            <div className="card">
              <h3>To-Do List</h3>
              <ul className="dw-widget-list">
                {todos.map((t) => (
                  <li key={t.id}>
                    <input type="checkbox" checked={t.done} onChange={() => toggleTodo(t)} />
                    <span style={{ flex: 1, textDecoration: t.done ? 'line-through' : undefined, color: t.done ? '#a99e88' : undefined }}>{t.text}</span>
                    <button className="btn secondary small" onClick={() => removeTodo(t.id)}>Remove</button>
                  </li>
                ))}
                {todos.length === 0 && <li style={{ color: '#888' }}>No to-dos yet.</li>}
              </ul>
              <form className="dw-widget-add" onSubmit={addTodo}>
                <input name="text" placeholder="Add a to-do…" />
                <button className="btn small">Add</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {tab === 'chart' && (
        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <div className="card">
            <h3>Work Status</h3>
            <DonutChart
              data={[
                { label: 'Completed', value: filtered.filter((t) => t.status === 'COMPLETED').length, color: '#3f8a5c' },
                { label: 'In Progress', value: filtered.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'ASSIGNED').length, color: '#f2ab0e' },
                { label: 'Pending', value: filtered.filter((t) => ['NOT_STARTED', 'ON_HOLD', 'SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUIRED'].includes(t.status)).length, color: '#a89a7c' },
                { label: 'Overdue', value: filtered.filter((t) => t.overdue).length, color: '#c0432b' },
              ]}
            />
          </div>
          <div className="card">
            <h3>Regional Performance</h3>
            <BarChart
              data={REGIONS.map((r) => ({ label: r.label, value: filtered.filter((t) => t.region === r.value).length, color: r.color }))}
            />
          </div>
          <div className="card card-wide">
            <h3>Work Type Breakdown</h3>
            <BarChart
              data={DM_WORK_TYPES.map((w) => ({ label: w, value: filtered.filter((t) => t.dmWorkType === w).length }))
                .filter((d) => d.value > 0)}
            />
          </div>
          <div className="card card-wide">
            <h3>Staff Workload</h3>
            <BarChart
              data={staff.map((s) => ({ label: s.name, value: filtered.filter((t) => t.assignedToId === s.id).length }))
                .filter((d) => d.value > 0)}
            />
          </div>
        </div>
      )}

      {selectedTaskId && (
        <TaskDetailModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} onChanged={reload} />
      )}
    </div>
  );
}
