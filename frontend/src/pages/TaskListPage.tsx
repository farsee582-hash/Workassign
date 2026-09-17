import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Department, Task } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../auth/AuthContext';
import AssignWorkForm from '../components/AssignWorkForm';

const canAssignRoles = ['GMA', 'AGM', 'COORDINATOR', 'MANAGER', 'ADMIN'];

const KANBAN_COLUMNS: { key: string; label: string; statuses: string[] }[] = [
  { key: 'todo', label: 'Not Started', statuses: ['NOT_STARTED', 'ASSIGNED'] },
  { key: 'progress', label: 'In Progress', statuses: ['IN_PROGRESS', 'ON_HOLD'] },
  { key: 'review', label: 'Submitted / Review', statuses: ['SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUIRED'] },
  { key: 'completed', label: 'Completed', statuses: ['APPROVED', 'COMPLETED'] },
];
// The status a card moves to when dropped on a column (first status in each group).
const COLUMN_DROP_STATUS: Record<string, string> = {
  todo: 'ASSIGNED',
  progress: 'IN_PROGRESS',
  review: 'SUBMITTED',
  completed: 'COMPLETED',
};

function initials(name?: string) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join('');
}

function KanbanBoard({ tasks, onStatusChange }: { tasks: Task[]; onStatusChange: (taskId: string, status: string) => void }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const columns = KANBAN_COLUMNS.map((col) => ({
    ...col,
    tasks: tasks.filter((t) => col.statuses.includes(t.status) || (col.key === 'completed' && t.overdue === false && t.status === 'CANCELLED')),
  }));

  return (
    <div className="kanban-board">
      {columns.map((col) => (
        <div
          key={col.key}
          className={`kanban-column${overCol === col.key ? ' drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
          onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
          onDrop={(e) => {
            e.preventDefault();
            setOverCol(null);
            if (dragId) onStatusChange(dragId, COLUMN_DROP_STATUS[col.key]);
            setDragId(null);
          }}
        >
          <div className="kanban-column-header">
            <h4>{col.label}</h4>
            <span className="kanban-column-count">{col.tasks.length}</span>
          </div>
          {col.tasks.map((t) => (
            <div
              key={t.id}
              className={`kanban-card${dragId === t.id ? ' dragging' : ''}`}
              draggable
              onDragStart={() => setDragId(t.id)}
              onDragEnd={() => setDragId(null)}
              style={{ borderLeftColor: t.overdue ? 'var(--color-danger)' : undefined }}
            >
              <Link to={`/tasks/${t.id}`} className="kanban-card-title">{t.title}</Link>
              <div className="kanban-card-meta">
                <span title={t.assignedTo.name} className="avatar-chip">{initials(t.assignedTo.name)}</span>
                <span>{new Date(t.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              </div>
              <div className="kanban-card-tags">
                <span className="badge">{t.priority}</span>
                {t.overdue && <span className="badge overdue">OVERDUE</span>}
              </div>
            </div>
          ))}
          {col.tasks.length === 0 && <p style={{ color: 'var(--color-text-faint)', fontSize: 13, margin: 0 }}>No tasks.</p>}
        </div>
      ))}
    </div>
  );
}

const MY_WORK_FILTERS = [
  'All', 'Pending', 'In Progress', 'Due Today', 'Upcoming', 'Overdue', 'Completed', 'Campaign Work', 'Daily Work', 'Recurring Work',
] as const;

function matchesMyWorkFilter(t: Task, filter: (typeof MY_WORK_FILTERS)[number]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const due = new Date(t.dueDate);
  switch (filter) {
    case 'All': return true;
    case 'Pending': return !['COMPLETED', 'CANCELLED'].includes(t.status);
    case 'In Progress': return t.status === 'IN_PROGRESS';
    case 'Due Today': return due >= today && due < tomorrow;
    case 'Upcoming': return due >= tomorrow && !['COMPLETED', 'CANCELLED'].includes(t.status);
    case 'Overdue': return t.overdue;
    case 'Completed': return t.status === 'COMPLETED';
    case 'Campaign Work': return t.workType === 'CAMPAIGN';
    case 'Daily Work': return t.workType === 'DAILY' && !t.recurringTemplateId;
    case 'Recurring Work': return !!t.recurringTemplateId;
    default: return true;
  }
}

export default function TaskListPage({ workType, title }: { workType?: 'CAMPAIGN' | 'DAILY'; title: string }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [myWorkFilter, setMyWorkFilter] = useState<(typeof MY_WORK_FILTERS)[number]>('All');
  const [showAddWork, setShowAddWork] = useState(false);
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [toast, setToast] = useState<string | null>(null);

  const isMyWork = title === 'My Work';

  function updateStatus(taskId: string, status: string) {
    const prevTask = tasks.find((t) => t.id === taskId);
    if (!prevTask || prevTask.status === status) return;
    setTasks((cur) => cur.map((t) => (t.id === taskId ? { ...t, status } : t)));
    api.patch(`/tasks/${taskId}/status`, { status })
      .then(() => {
        setToast(`Moved "${prevTask.title}" to ${status.replace(/_/g, ' ')}`);
        setTimeout(() => setToast(null), 2500);
      })
      .catch(() => {
        setTasks((cur) => cur.map((t) => (t.id === taskId ? { ...t, status: prevTask.status } : t)));
        setToast('Failed to update status');
        setTimeout(() => setToast(null), 2500);
      });
  }
  const isDailyWork = workType === 'DAILY';

  function reload() {
    const params = workType ? { workType } : {};
    api.get('/tasks', { params }).then((r) => setTasks(r.data));
  }

  useEffect(() => {
    reload();
    api.get('/departments').then((r) => setDepartments(r.data));
    // Recurring templates are generated lazily on page load (no cron here) —
    // do it whenever Daily Work is opened, so occurrences show up promptly.
    if (isDailyWork) {
      api.get('/recurring-work/generate').then(reload).catch(() => {});
    }
  }, [workType]);

  const filtered = useMemo(() => {
    return tasks
      .filter((t) => (isMyWork ? matchesMyWorkFilter(t, myWorkFilter) : true))
      .filter((t) => (deptFilter ? t.departmentId === deptFilter : true))
      .filter((t) => (statusFilter ? t.status === statusFilter : true))
      .filter((t) => (priorityFilter ? t.priority === priorityFilter : true))
      .filter((t) => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return (
          t.taskId.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.assignedTo.name.toLowerCase().includes(q) ||
          t.department.name.toLowerCase().includes(q) ||
          (t.campaign?.name.toLowerCase().includes(q) ?? false)
        );
      });
  }, [tasks, search, deptFilter, statusFilter, priorityFilter, myWorkFilter, isMyWork]);

  const canAddWork = isDailyWork && user && canAssignRoles.includes(user.role);

  return (
    <div>
      <div className="section-title">
        <h2>{title}</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {isMyWork && (
            <div className="kanban-toggle">
              <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>List</button>
              <button className={view === 'kanban' ? 'active' : ''} onClick={() => setView('kanban')}>Kanban</button>
            </div>
          )}
          {canAddWork && (
            <button className="btn" onClick={() => setShowAddWork((v) => !v)}>{showAddWork ? 'Cancel' : 'Add Work'}</button>
          )}
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}

      {isMyWork && (
        <div className="tab-bar" style={{ flexWrap: 'wrap' }}>
          {MY_WORK_FILTERS.map((f) => (
            <button key={f} className={myWorkFilter === f ? 'active' : ''} onClick={() => setMyWorkFilter(f)}>{f}</button>
          ))}
        </div>
      )}

      {showAddWork && canAddWork && (
        <AssignWorkForm
          departments={departments}
          workType="DAILY"
          onDone={() => { setShowAddWork(false); reload(); }}
          onCancel={() => setShowAddWork(false)}
        />
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="Search by task ID, title, staff, department, campaign…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 280 }}
        />
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {['NOT_STARTED', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'COMPLETED', 'CANCELLED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option value="">All priorities</option>
          {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {isMyWork && view === 'kanban' ? (
        <KanbanBoard tasks={filtered} onStatusChange={updateStatus} />
      ) : (
      <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Task ID</th>
            <th>Title</th>
            <th>Department</th>
            <th>Assigned To</th>
            <th>Due</th>
            <th>Priority</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((t) => (
            <tr key={t.id}>
              <td>{t.taskId}</td>
              <td><Link to={`/tasks/${t.id}`}>{t.title}</Link></td>
              <td>{t.department.name}</td>
              <td>{t.assignedTo.name}</td>
              <td>{new Date(t.dueDate).toLocaleDateString()}</td>
              <td>{t.priority}</td>
              <td><StatusBadge status={t.status} overdue={t.overdue} /></td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={7} style={{ color: '#888' }}>No tasks found.</td></tr>
          )}
        </tbody>
      </table>
      </div>
      )}
    </div>
  );
}
