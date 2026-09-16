import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Task } from '../types';
import { StatusBadge } from '../components/StatusBadge';

type ViewMode = 'day' | 'week' | 'month';

function rangeDays(mode: ViewMode): number {
  return mode === 'day' ? 1 : mode === 'week' ? 7 : 30;
}

export default function Calendar() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [mode, setMode] = useState<ViewMode>('week');

  useEffect(() => {
    // Ensure today's recurring occurrences exist before loading (no cron in
    // this environment — see README).
    api.get('/recurring-work/generate').catch(() => {}).finally(() => {
      api.get('/tasks').then((r) => setTasks(r.data));
    });
  }, []);

  const grouped = useMemo(() => {
    const days = rangeDays(mode);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + days);

    const map = new Map<string, Task[]>();
    tasks
      .filter((t) => new Date(t.dueDate) >= start && new Date(t.dueDate) < end)
      .forEach((t) => {
        const key = new Date(t.dueDate).toLocaleDateString();
        map.set(key, [...(map.get(key) ?? []), t]);
      });
    return Array.from(map.entries()).sort(
      (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()
    );
  }, [tasks, mode]);

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
      {grouped.length === 0 && <p>No tasks due in this range.</p>}
      {grouped.map(([date, dayTasks]) => (
        <div className="card" key={date} style={{ marginBottom: 12 }}>
          <strong>{date}</strong>
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
      ))}
    </div>
  );
}
