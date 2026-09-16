import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { ManagementDashboard, MyDashboard, Task } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Link } from 'react-router-dom';

const managementRoles = ['GMA', 'AGM', 'ADMIN', 'MANAGER', 'COORDINATOR'];

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

  useEffect(() => {
    api.get('/dashboard/me').then((r) => setMy(r.data));
    if (user && managementRoles.includes(user.role)) {
      api.get('/dashboard/management').then((r) => setMgmt(r.data));
    }
  }, [user]);

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
          <table>
            <thead><tr><th>Task</th><th>Department</th><th>Due</th><th>Status</th></tr></thead>
            <tbody>{my.dueToday.map((t) => <TaskRow key={t.id} task={t} />)}</tbody>
          </table>
        </>
      )}

      {my && my.dueThisWeek.length > 0 && (
        <>
          <h3>Due This Week</h3>
          <table>
            <thead><tr><th>Task</th><th>Department</th><th>Due</th><th>Status</th></tr></thead>
            <tbody>{my.dueThisWeek.map((t) => <TaskRow key={t.id} task={t} />)}</tbody>
          </table>
        </>
      )}

      {mgmt && (
        <>
          <div className="section-title">
            <h2>Management Overview</h2>
          </div>
          <div className="kpi-grid">
            <div className="kpi-card"><div className="value">{mgmt.campaigns.total}</div><div className="label">Total campaigns</div></div>
            <div className="kpi-card"><div className="value">{mgmt.campaigns.active}</div><div className="label">Active campaigns</div></div>
            <div className="kpi-card"><div className="value">{mgmt.campaigns.completed}</div><div className="label">Completed campaigns</div></div>
            <div className="kpi-card"><div className="value">{mgmt.tasks.total}</div><div className="label">Total tasks</div></div>
            <div className="kpi-card"><div className="value">{mgmt.tasks.pending}</div><div className="label">Pending tasks</div></div>
            <div className="kpi-card"><div className="value">{mgmt.tasks.overdue}</div><div className="label">Overdue tasks</div></div>
          </div>
          <h3>Staff With Pending Work</h3>
          <table>
            <thead><tr><th>Name</th><th>Pending tasks</th></tr></thead>
            <tbody>
              {mgmt.staffWithPendingWork.map((s) => (
                <tr key={s.id}><td>{s.name}</td><td>{s.count}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
