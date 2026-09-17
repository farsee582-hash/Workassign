import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { Department, ManagementDashboard, MyDashboard, Task } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { BarChart, DonutChart, GaugeChart } from '../components/Charts';
import { Link } from 'react-router-dom';

const managementRoles = ['GMA', 'AGM', 'ADMIN', 'MANAGER', 'COORDINATOR'];
const ROLES = ['GMA', 'AGM', 'COORDINATOR', 'MANAGER', 'ASSISTANT_MANAGER', 'EXECUTIVE'];

function TaskRow({ task }: { task: Task }) {
  return (
    <tr>
      <td>
        <Link to={`/tasks/${task.id}`}>{task.title}</Link>
      </td>
      <td>{task.department.name}</td>
      <td>{new Date(task.dueDate).toLocaleDateString()}</td>
      <td>
        <StatusBadge status={task.status} overdue={task.overdue} />
      </td>
    </tr>
  );
}

function greetingForHour(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { user } = useAuth();
  const [my, setMy] = useState<MyDashboard | null>(null);
  const [mgmt, setMgmt] = useState<ManagementDashboard | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [range, setRange] = useState('all');
  const [departmentId, setDepartmentId] = useState('');
  const [role, setRole] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);

  const firstName = (user?.name ?? '').split(' ')[0] || 'there';
  const greeting = greetingForHour(new Date().getHours());
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  useEffect(() => {
    api.get('/dashboard/me').then((r) => setMy(r.data));
    if (user && managementRoles.includes(user.role)) {
      api.get('/departments').then((r) => setDepartments(r.data));
    }
  }, [user]);

  useEffect(() => {
    if (!user || !managementRoles.includes(user.role)) return;
    const params: Record<string, string> = { range };
    if (departmentId) params.departmentId = departmentId;
    if (role) params.role = role;
    if (range === 'custom' && customFrom && customTo) {
      params.from = customFrom;
      params.to = customTo;
    }
    api.get('/dashboard/management', { params }).then((r) => setMgmt(r.data));
  }, [user, range, departmentId, role, customFrom, customTo]);

  const isManager = user && managementRoles.includes(user.role);

  const overallPercent = useMemo(() => {
    if (isManager && mgmt) {
      return mgmt.tasks.total > 0 ? (mgmt.tasks.completed / mgmt.tasks.total) * 100 : 0;
    }
    if (my) {
      return my.counts.total > 0 ? (my.counts.completed / my.counts.total) * 100 : 0;
    }
    return 0;
  }, [isManager, mgmt, my]);

  const notifications = useMemo(() => {
    const items: { id: string; text: string; kind: 'overdue' | 'due-today' }[] = [];
    if (my) {
      my.overdueTasks.forEach((t) => items.push({ id: `od-${t.id}`, text: `Overdue: ${t.title}`, kind: 'overdue' }));
      my.dueToday.forEach((t) => items.push({ id: `dt-${t.id}`, text: `Due today: ${t.title}`, kind: 'due-today' }));
    }
    return items;
  }, [my]);

  return (
    <div>
      <div className="dash-header glass">
        <div className="dash-header-left">
          <div className="dash-breadcrumb">Home / Dashboard</div>
          <h1 className="dash-greeting">{greeting}, {firstName}</h1>
          <div className="dash-subtitle">It&rsquo;s {todayLabel}</div>
        </div>
        <div className="dash-header-right">
          <div className="dash-header-controls">
            {isManager && (
              <select className="glass dash-range-select" value={range} onChange={(e) => setRange(e.target.value)} aria-label="Date range">
                <option value="all">All time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="custom">Custom</option>
              </select>
            )}
            <div className="dash-notif-wrap">
              <button
                type="button"
                className="glass dash-notif-btn"
                aria-label="Notifications"
                onClick={() => setNotifOpen((v) => !v)}
              >
                <span aria-hidden="true">🔔</span>
                {notifications.length > 0 && <span className="dash-notif-badge">{notifications.length}</span>}
              </button>
              {notifOpen && (
                <div className="glass dash-notif-panel">
                  <div className="dash-notif-panel-title">Notifications</div>
                  {notifications.length === 0 && <div className="dash-notif-empty">You&rsquo;re all caught up.</div>}
                  {notifications.slice(0, 8).map((n) => (
                    <div key={n.id} className={`dash-notif-item ${n.kind}`}>{n.text}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="glass dash-gauge-card">
            <GaugeChart percent={overallPercent} size={140} label="Overall completion" />
          </div>
        </div>
      </div>

      {isManager && range === 'custom' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
        </div>
      )}

      <div className="section-title">
        <h2>My Dashboard</h2>
      </div>
      {my && (
        <div className="kpi-grid">
          <div className="kpi-card"><div className="value">{my.counts.total}</div><div className="label">Total tasks</div></div>
          <div className="kpi-card"><div className="value">{my.counts.pending}</div><div className="label">Pending</div></div>
          <div className="kpi-card"><div className="value">{my.counts.inProgress}</div><div className="label">In progress</div></div>
          <div className="kpi-card"><div className="value">{my.counts.dueToday}</div><div className="label">Due today</div></div>
          <div className="kpi-card"><div className="value">{my.counts.dueTomorrow}</div><div className="label">Due tomorrow</div></div>
          <div className="kpi-card"><div className="value">{my.counts.overdue}</div><div className="label">Overdue</div></div>
          <div className="kpi-card"><div className="value">{my.counts.completed}</div><div className="label">Completed</div></div>
        </div>
      )}

      {my && my.dueToday.length > 0 && (
        <>
          <h3>Due Today</h3>
          <div className="table-scroll">
          <table>
            <thead><tr><th>Task</th><th>Department</th><th>Due</th><th>Status</th></tr></thead>
            <tbody>{my.dueToday.map((t) => <TaskRow key={t.id} task={t} />)}</tbody>
          </table>
          </div>
        </>
      )}

      {my && my.dueThisWeek.length > 0 && (
        <>
          <h3>Due This Week</h3>
          <div className="table-scroll">
          <table>
            <thead><tr><th>Task</th><th>Department</th><th>Due</th><th>Status</th></tr></thead>
            <tbody>{my.dueThisWeek.map((t) => <TaskRow key={t.id} task={t} />)}</tbody>
          </table>
          </div>
        </>
      )}

      {isManager && (
        <>
          <div className="section-title">
            <h2>Management Overview</h2>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">All departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">All roles</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {mgmt && (
            <>
              <div className="kpi-grid">
                <div className="kpi-card"><div className="value">{mgmt.campaigns.total}</div><div className="label">Total campaigns</div></div>
                <div className="kpi-card"><div className="value">{mgmt.campaigns.active}</div><div className="label">Active campaigns</div></div>
                <div className="kpi-card"><div className="value">{mgmt.campaigns.completed}</div><div className="label">Completed campaigns</div></div>
                <div className="kpi-card"><div className="value">{mgmt.tasks.total}</div><div className="label">Total tasks</div></div>
                <div className="kpi-card"><div className="value">{mgmt.tasks.pending}</div><div className="label">Pending tasks</div></div>
                <div className="kpi-card"><div className="value">{mgmt.tasks.overdue}</div><div className="label">Overdue tasks</div></div>
              </div>

              <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(260px, 1fr)', gap: 16, marginTop: 8 }}>
                <div className="card">
                  <strong>Task Status Breakdown</strong>
                  <div style={{ marginTop: 10 }}>
                    <DonutChart
                      data={[
                        { label: 'Completed', value: mgmt.tasks.completed, color: '#1e7a4c' },
                        { label: 'Pending', value: mgmt.tasks.pending - mgmt.tasks.overdue, color: '#1d4ed8' },
                        { label: 'Overdue', value: mgmt.tasks.overdue, color: '#c0392b' },
                      ]}
                    />
                  </div>
                </div>
                <div className="card">
                  <strong>Department-wise Completion</strong>
                  <div style={{ marginTop: 10 }}>
                    <BarChart data={mgmt.departmentCompletion.map((d) => ({ label: d.name, value: d.completionPercent }))} />
                  </div>
                </div>
                <div className="card">
                  <strong>Campaign Progress</strong>
                  <div style={{ marginTop: 10 }}>
                    <BarChart data={mgmt.campaignProgress.map((c) => ({ label: c.name, value: c.completionPercent }))} />
                  </div>
                </div>
                <div className="card">
                  <strong>Staff Workload (pending tasks)</strong>
                  <div style={{ marginTop: 10 }}>
                    <BarChart data={mgmt.staffWithPendingWork.slice(0, 8).map((s) => ({ label: s.name, value: s.count }))} />
                  </div>
                </div>
              </div>

              <h3 style={{ marginTop: 20 }}>Staff With Pending Work</h3>
              <div className="table-scroll">
              <table>
                <thead><tr><th>Name</th><th>Pending tasks</th></tr></thead>
                <tbody>
                  {mgmt.staffWithPendingWork.map((s) => (
                    <tr key={s.id}><td>{s.name}</td><td>{s.count}</td></tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
