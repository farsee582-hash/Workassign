import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Department, Task } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../auth/AuthContext';
import AssignWorkForm from '../components/AssignWorkForm';

const canAssignRoles = ['GMA', 'AGM', 'COORDINATOR', 'MANAGER', 'ADMIN'];

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

  const isMyWork = title === 'My Work';
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
        {canAddWork && (
          <button className="btn" onClick={() => setShowAddWork((v) => !v)}>{showAddWork ? 'Cancel' : 'Add Work'}</button>
        )}
      </div>

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
    </div>
  );
}
