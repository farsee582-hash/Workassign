import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { Department, ManagementDashboard, MyDashboard, RecentActivityItem, Task } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { BarChart, DonutChart, GaugeChart } from '../components/Charts';
import { Link } from 'react-router-dom';

const managementRoles = ['GMA', 'AGM', 'ADMIN', 'MANAGER', 'COORDINATOR'];
const ROLES = ['GMA', 'AGM', 'COORDINATOR', 'MANAGER', 'ASSISTANT_MANAGER', 'EXECUTIVE'];

const kpiTints = ['var(--color-accent-tint)'];

function KpiIcon({ kind }: { kind: 'list' | 'clock' | 'progress' | 'calendar' | 'alert' | 'check' | 'flag' | 'megaphone' }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (kind) {
    case 'list':
      return <svg {...common}><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1.2" fill="currentColor" stroke="none" /><circle cx="3.5" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="3.5" cy="18" r="1.2" fill="currentColor" stroke="none" /></svg>;
    case 'clock':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>;
    case 'progress':
      return <svg {...common}><path d="M4 20V10M12 20V4M20 20v-7" /></svg>;
    case 'calendar':
      return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>;
    case 'alert':
      return <svg {...common}><path d="M12 3l10 18H2L12 3Z" /><path d="M12 10v4M12 17.5v.01" /></svg>;
    case 'check':
      return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M7.5 12.5l3 3 6-6" /></svg>;
    case 'flag':
      return <svg {...common}><path d="M5 21V4" /><path d="M5 4h13l-3 4 3 4H5" /></svg>;
    case 'megaphone':
      return <svg {...common}><path d="M3 10v4a1 1 0 0 0 1 1h2l5 4V5L6 9H4a1 1 0 0 0-1 1Z" /><path d="M16 8a4 4 0 0 1 0 8" /></svg>;
    default:
      return null;
  }
}

function StatInline({ value, label, icon }: { value: number | string; label: string; icon: Parameters<typeof KpiIcon>[0]['kind'] }) {
  return (
    <div className="dash-stat">
      <div className="dash-stat-icon"><KpiIcon kind={icon} /></div>
      <div>
        <div className="dash-stat-value">{value}</div>
        <div className="dash-stat-label">{label}</div>
      </div>
    </div>
  );
}

function Kpi({ value, label, icon, tint }: { value: number | string; label: string; icon: Parameters<typeof KpiIcon>[0]['kind']; tint: string }) {
  return (
    <div className="kpi-card">
      <div className="icon-chip" style={{ background: tint }}>
        <KpiIcon kind={icon} />
      </div>
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

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

function ProgressRow({ num, name, percent, href }: { num?: string | null; name: string; percent: number; href?: string }) {
  const label = href ? (
    <Link to={href} className="progress-row-name">{name}</Link>
  ) : (
    <span className="progress-row-name">{name}</span>
  );
  return (
    <div className="progress-row">
      <div className="progress-row-top">
        <span style={{ display: 'flex', minWidth: 0 }}>
          {num && <span className="progress-row-num">{num}</span>}
          {label}
        </span>
        <span className="progress-row-pct">{percent}%</span>
      </div>
      <div className="progress-bar"><div style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} /></div>
    </div>
  );
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function describeActivity(item: RecentActivityItem) {
  const entity = item.entityType === 'Task' ? 'task' : item.entityType === 'Campaign' ? 'campaign' : item.entityType.toLowerCase();
  const action = item.action.toLowerCase().replace(/_/g, ' ');
  return `${item.actorName} ${action} a ${entity}`;
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
  const [activity, setActivity] = useState<RecentActivityItem[] | null>(null);

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

  useEffect(() => {
    if (!user || !managementRoles.includes(user.role)) return;
    api.get('/dashboard/recent-activity').then((r) => setActivity(r.data)).catch(() => setActivity([]));
  }, [user]);

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
          {my && (
            <div className="dash-stat-row">
              <StatInline value={my.counts.total} label="Total tasks" icon="list" />
              <StatInline value={my.counts.pending} label="Pending" icon="clock" />
              <StatInline value={my.counts.inProgress} label="In progress" icon="progress" />
              <StatInline value={my.counts.dueToday} label="Due today" icon="calendar" />
              <StatInline value={my.counts.overdue} label="Overdue" icon="alert" />
              <StatInline value={my.counts.completed} label="Completed" icon="check" />
            </div>
          )}
        </div>
        <div className="dash-header-right">
          <div className="dash-header-controls">
            {isManager && (
              <div className="glass dash-range-wrap">
                <span className="icon" aria-hidden="true">📅</span>
                <select className="dash-range-select" value={range} onChange={(e) => setRange(e.target.value)} aria-label="Date range">
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
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
          <div className="dash-gauge-card">
            <GaugeChart percent={overallPercent} size={200} label="Overall completion" />
          </div>
        </div>
      </div>

      {isManager && range === 'custom' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
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

          {mgmt && (() => {
            const completionPercent = mgmt.tasks.total > 0 ? Math.round((mgmt.tasks.completed / mgmt.tasks.total) * 100) : 0;
            const inProgressCount = mgmt.tasks.inProgress;
            const pendingOnly = Math.max(0, mgmt.tasks.pending - inProgressCount - mgmt.tasks.overdue);
            const topCampaigns = [...mgmt.campaignProgress]
              .sort((a, b) => (a.status === 'IN_PROGRESS' ? -1 : 1) - (b.status === 'IN_PROGRESS' ? -1 : 1) || b.completionPercent - a.completionPercent)
              .slice(0, 6);
            return (
              <>
                <div className="kpi-grid">
                  <Kpi value={mgmt.campaigns.active} label="Active Campaigns" icon="megaphone" tint={kpiTints[0]} />
                  <div className="kpi-card">
                    <div className="icon-chip" style={{ background: kpiTints[0] }}><KpiIcon kind="list" /></div>
                    <div className="value">{mgmt.tasks.total}</div>
                    <div className="label">Total Tasks</div>
                    <div className="sub">{mgmt.tasks.pending} pending</div>
                  </div>
                  <div className="kpi-card">
                    <div className="icon-chip" style={{ background: kpiTints[0] }}><KpiIcon kind="check" /></div>
                    <div className="value">{mgmt.tasks.completed}</div>
                    <div className="label">Completed</div>
                    <div className="sub">{completionPercent}%</div>
                  </div>
                  <div className="kpi-card">
                    <div className="icon-chip" style={{ background: kpiTints[0] }}><KpiIcon kind="progress" /></div>
                    <div className="value">{inProgressCount}</div>
                    <div className="label">In Progress</div>
                    <div className="sub">{pendingOnly} not started</div>
                  </div>
                  <div className="kpi-card">
                    <div className="icon-chip" style={{ background: kpiTints[0] }}><KpiIcon kind="alert" /></div>
                    <div className="value">{mgmt.tasks.overdue}</div>
                    <div className="label">Overdue</div>
                    {mgmt.tasks.overdue > 0 && <div className="sub warn">⚠ Attention</div>}
                  </div>
                  <div className="kpi-card">
                    <div className="icon-chip" style={{ background: kpiTints[0] }}><KpiIcon kind="calendar" /></div>
                    <div className="value">{mgmt.tasks.dueToday}</div>
                    <div className="label">Due Today</div>
                  </div>
                </div>

                <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(260px, 1fr)', gap: 16, marginTop: 8 }}>
                  <div className="card card-wide">
                    <strong>Overall Work Progress</strong>
                    <div className="hero-progress" style={{ marginTop: 14 }}>
                      <div>
                        <div className="hero-progress-number">{completionPercent}%</div>
                        <div style={{ color: 'var(--color-text-muted)', fontWeight: 600, fontSize: 'var(--fs-sm)' }}>Overall completion</div>
                      </div>
                      <DonutChart
                        data={[
                          { label: 'Completed', value: mgmt.tasks.completed, color: '#241f18' },
                          { label: 'In Progress', value: inProgressCount, color: '#f2ab0e' },
                          { label: 'Pending', value: pendingOnly, color: '#a89a7c' },
                          { label: 'Overdue', value: mgmt.tasks.overdue, color: '#c0432b' },
                        ]}
                      />
                    </div>
                  </div>

                  <div className="card">
                    <strong>Department Progress</strong>
                    <div style={{ marginTop: 12 }}>
                      {mgmt.departmentCompletion.length === 0 && <div className="empty-note">No department data yet.</div>}
                      {mgmt.departmentCompletion.map((d) => (
                        <ProgressRow key={d.id} name={d.name} percent={d.completionPercent} />
                      ))}
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header-row">
                      <strong>Campaign Progress</strong>
                      <Link to="/campaigns" className="card-link">View All →</Link>
                    </div>
                    <div style={{ marginTop: 4 }}>
                      {topCampaigns.length === 0 && <div className="empty-note">No campaigns yet.</div>}
                      {topCampaigns.map((c) => (
                        <ProgressRow
                          key={c.id}
                          num={c.campaignNumber}
                          name={c.name}
                          percent={c.completionPercent}
                          href={`/campaigns/${c.id}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="card">
                    <strong>Attention Required</strong>
                    <div style={{ marginTop: 8 }}>
                      <div className="attn-row">
                        <span className={`attn-dot ${mgmt.tasks.overdue > 0 ? 'danger' : ''}`} />
                        <span className="attn-row-text">Overdue tasks</span>
                        <span className="attn-row-count">{mgmt.tasks.overdue}</span>
                      </div>
                      <div className="attn-row">
                        <span className={`attn-dot ${mgmt.tasks.dueToday > 0 ? 'warn' : ''}`} />
                        <span className="attn-row-text">Due today</span>
                        <span className="attn-row-count">{mgmt.tasks.dueToday}</span>
                      </div>
                      <div className="attn-row">
                        <span className={`attn-dot ${mgmt.tasks.awaitingReview > 0 ? 'accent' : ''}`} />
                        <span className="attn-row-text">Awaiting review / approval</span>
                        <span className="attn-row-count">{mgmt.tasks.awaitingReview}</span>
                      </div>
                      <div className="attn-row">
                        <span className={`attn-dot ${mgmt.tasks.revisionRequired > 0 ? 'warn' : ''}`} />
                        <span className="attn-row-text">Revision required</span>
                        <span className="attn-row-count">{mgmt.tasks.revisionRequired}</span>
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <strong>Staff Workload (pending tasks)</strong>
                    <div style={{ marginTop: 10 }}>
                      <BarChart data={mgmt.staffWithPendingWork.slice(0, 8).map((s) => ({ label: s.name, value: s.count }))} />
                    </div>
                  </div>

                  <div className="card">
                    <strong>Upcoming Deadlines</strong>
                    <div style={{ marginTop: 4 }}>
                      <div className="deadline-group-label">Today</div>
                      {mgmt.upcomingDeadlines.today.length === 0 && <div className="empty-note">Nothing due today.</div>}
                      {mgmt.upcomingDeadlines.today.map((t) => (
                        <div className="deadline-row" key={t.id}>
                          <span className="attn-dot warn" />
                          <div className="attn-row-text">
                            <div className="deadline-row-title"><Link to={`/tasks/${t.id}`}>{t.title}</Link></div>
                            <div className="deadline-row-meta">{t.department} · {t.assignedTo}</div>
                          </div>
                        </div>
                      ))}
                      <div className="deadline-group-label">Tomorrow</div>
                      {mgmt.upcomingDeadlines.tomorrow.length === 0 && <div className="empty-note">Nothing due tomorrow.</div>}
                      {mgmt.upcomingDeadlines.tomorrow.map((t) => (
                        <div className="deadline-row" key={t.id}>
                          <span className="attn-dot" />
                          <div className="attn-row-text">
                            <div className="deadline-row-title"><Link to={`/tasks/${t.id}`}>{t.title}</Link></div>
                            <div className="deadline-row-meta">{t.department} · {t.assignedTo}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {activity && activity.length > 0 && (
                    <div className="card">
                      <strong>Recent Activity</strong>
                      <div style={{ marginTop: 8 }}>
                        {activity.map((a) => (
                          <div className="activity-row" key={a.id}>
                            <span className="attn-dot accent" />
                            <span className="activity-row-text">{describeActivity(a)}</span>
                            <span className="activity-row-time">{timeAgo(a.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
            );
          })()}
        </>
      )}
    </div>
  );
}
