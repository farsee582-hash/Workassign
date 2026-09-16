import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Department, Task } from '../types';
import { StatusBadge } from '../components/StatusBadge';

type ViewMode = 'day' | 'week' | 'month';

function rangeDays(mode: ViewMode): number {
  return mode === 'day' ? 1 : mode === 'week' ? 7 : 30;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Monday-first 6-row month grid covering the full weeks that contain the 1st/last day of the month. */
function buildMonthGrid(monthAnchor: Date): Date[] {
  const first = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
  const firstWeekday = (first.getDay() + 6) % 7; // 0 = Monday
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - firstWeekday);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function Calendar() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [mode, setMode] = useState<ViewMode>('month');
  const [monthAnchor, setMonthAnchor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    // Ensure today's recurring occurrences exist before loading (no cron in
    // this environment — see README).
    api.get('/recurring-work/generate').catch(() => {}).finally(() => {
      api.get('/tasks').then((r) => setTasks(r.data));
    });
    api.get('/departments').then((r) => setDepartments(r.data)).catch(() => {});
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => (deptFilter ? t.departmentId === deptFilter : true))
      .filter((t) => (statusFilter ? t.status === statusFilter : true))
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
  }, [tasks, search, deptFilter, statusFilter]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    filteredTasks.forEach((t) => {
      const d = new Date(t.dueDate);
      const key = d.toDateString();
      map.set(key, [...(map.get(key) ?? []), t]);
    });
    return map;
  }, [filteredTasks]);

  const grouped = useMemo(() => {
    const days = rangeDays(mode);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + days);

    const map = new Map<string, Task[]>();
    filteredTasks
      .filter((t) => new Date(t.dueDate) >= start && new Date(t.dueDate) < end)
      .forEach((t) => {
        const key = new Date(t.dueDate).toLocaleDateString();
        map.set(key, [...(map.get(key) ?? []), t]);
      });
    return Array.from(map.entries()).sort(
      (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()
    );
  }, [filteredTasks, mode]);

  const monthGrid = useMemo(() => buildMonthGrid(monthAnchor), [monthAnchor]);
  const today = new Date();
  const monthLabel = monthAnchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const selectedDayTasks = selectedDay ? tasksByDay.get(selectedDay.toDateString()) ?? [] : [];

  return (
    <div>
      <div className="section-title"><h2>Calendar</h2></div>

      <div className="tab-bar">
        {(['day', 'week', 'month'] as ViewMode[]).map((m) => (
          <button key={m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>
            {m[0].toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      <div className="calendar-filter-bar" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="Search by task ID, title, staff, department, campaign…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 240, flex: '1 1 240px' }}
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
      </div>

      {mode === 'month' && (
        <div>
          <div className="calendar-nav">
            <div className="calendar-nav-controls">
              <button
                className="btn secondary small"
                onClick={() => setMonthAnchor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                aria-label="Previous month"
              >
                ‹
              </button>
              <button className="btn secondary small" onClick={() => { setMonthAnchor(new Date()); setSelectedDay(new Date()); }}>
                Today
              </button>
              <button
                className="btn secondary small"
                onClick={() => setMonthAnchor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                aria-label="Next month"
              >
                ›
              </button>
            </div>
            <h3 className="calendar-month-label">{monthLabel}</h3>
          </div>

          <div className="month-grid">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className="month-grid-weekday">{w}</div>
            ))}
            {monthGrid.map((d) => {
              const inMonth = d.getMonth() === monthAnchor.getMonth();
              const isToday = sameDay(d, today);
              const isSelected = selectedDay && sameDay(d, selectedDay);
              const dayTasks = tasksByDay.get(d.toDateString()) ?? [];
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  className={`month-grid-cell${inMonth ? '' : ' outside'}${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
                  onClick={() => setSelectedDay(d)}
                >
                  <span className="month-grid-daynum">{d.getDate()}</span>
                  <span className="month-grid-pills">
                    {dayTasks.slice(0, 3).map((t) => (
                      <span key={t.id} className="month-grid-pill" title={t.title}>{t.title}</span>
                    ))}
                    {dayTasks.length > 3 && (
                      <span className="month-grid-pill more">+{dayTasks.length - 3} more</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedDay && (
            <div className="card" style={{ marginTop: 16 }}>
              <strong>
                {selectedDay.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </strong>
              {selectedDayTasks.length === 0 && <p style={{ color: '#888', marginBottom: 0 }}>No tasks due on this day.</p>}
              {selectedDayTasks.length > 0 && (
                <div className="table-scroll" style={{ marginTop: 8 }}>
                  <table>
                    <tbody>
                      {selectedDayTasks.map((t) => (
                        <tr key={t.id} style={{ opacity: t.status === 'COMPLETED' ? 0.6 : 1 }}>
                          <td><Link to={`/tasks/${t.id}`}>{t.title}</Link></td>
                          <td>
                            <span className="badge" style={{ fontSize: 11 }}>
                              {t.campaign ? 'Campaign' : t.recurringTemplateId ? 'Recurring' : 'Daily'}
                            </span>
                          </td>
                          <td>{t.department.name}</td>
                          <td>{t.assignedTo.name}</td>
                          <td><StatusBadge status={t.status} overdue={t.overdue} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {mode !== 'month' && (
        <div>
          {grouped.length === 0 && <p>No tasks due in this range.</p>}
          {grouped.map(([date, dayTasks]) => (
            <div className="card" key={date} style={{ marginBottom: 12 }}>
              <strong>{date}</strong>
              <div className="table-scroll">
                <table style={{ marginTop: 6 }}>
                  <tbody>
                    {dayTasks.map((t) => (
                      <tr key={t.id} style={{ opacity: t.status === 'COMPLETED' ? 0.6 : 1 }}>
                        <td><Link to={`/tasks/${t.id}`}>{t.title}</Link></td>
                        <td>
                          <span className="badge" style={{ fontSize: 11 }}>
                            {t.campaign ? 'Campaign' : t.recurringTemplateId ? 'Recurring' : 'Daily'}
                          </span>
                        </td>
                        <td>{t.department.name}</td>
                        <td>{t.assignedTo.name}</td>
                        <td><StatusBadge status={t.status} overdue={t.overdue} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
