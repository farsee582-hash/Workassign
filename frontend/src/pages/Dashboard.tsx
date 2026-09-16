import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { Department, ManagementDashboard, MyDashboard, Task } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { BarChart, DonutChart } from '../components/Charts';
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

  return (
    <div>
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
            <select value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="all">All time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom</option>
            </select>
            {range === 'custom' && (
              <>
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </>
            )}
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
                        { label: 'Completed', value: mgmt.tasks.completed, color: '#22a06b' },
                        { label: 'Pending', value: mgmt.tasks.pending - mgmt.tasks.overdue, color: '#3b6ef6' },
                        { label: 'Overdue', value: mgmt.tasks.overdue, color: '#e0473b' },
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
