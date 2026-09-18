import { useMemo } from 'react';
import type { Task } from '../types';
import { regionColor } from '../lib/digitalMarketing';

export type CalendarView = 'day' | 'week' | 'month' | 'year';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfWeek(d: Date) {
  const c = new Date(d);
  const weekday = (c.getDay() + 6) % 7; // 0 = Monday
  c.setDate(c.getDate() - weekday);
  c.setHours(0, 0, 0, 0);
  return c;
}

function buildMonthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

/**
 * Dependency-free, reusable calendar for a department/sub-department's task
 * list. Supports Day / Week / Month / Year views. Month view is the fully
 * featured "real month grid with task chips" view; the others render real
 * data (a list, a 7-column grid, a 12-month mini summary) rather than
 * placeholders.
 */
export default function MonthCalendar({
  view,
  anchor,
  tasks,
  onSelectTask,
  onPickDay,
  onToggleComplete,
}: {
  view: CalendarView;
  anchor: Date;
  tasks: Task[];
  onSelectTask: (t: Task) => void;
  onPickDay?: (d: Date) => void;
  onToggleComplete?: (t: Task) => void;
}) {
  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((t) => {
      const key = new Date(t.dueDate).toDateString();
      map.set(key, [...(map.get(key) ?? []), t]);
    });
    return map;
  }, [tasks]);

  const today = new Date();

  function Chip({ t }: { t: Task }) {
    return (
      <button
        type="button"
        className="month-grid-pill"
        title={`${t.title}${t.campaign ? ` — ${t.campaign.code} ${t.campaign.name}` : ''}`}
        onClick={(e) => { e.stopPropagation(); onSelectTask(t); }}
        style={{ display: 'flex', alignItems: 'center', gap: 4, textAlign: 'left', border: 'none', cursor: 'pointer' }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: regionColor(t.region), flexShrink: 0, display: 'inline-block' }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t.campaign ? `[${t.campaign.code}] ` : ''}{t.title}
        </span>
      </button>
    );
  }

  if (view === 'month') {
    const grid = buildMonthGrid(anchor);
    return (
      <div className="month-grid">
        {WEEKDAY_LABELS.map((w) => <div key={w} className="month-grid-weekday">{w}</div>)}
        {grid.map((d) => {
          const inMonth = d.getMonth() === anchor.getMonth();
          const isToday = sameDay(d, today);
          const dayTasks = tasksByDay.get(d.toDateString()) ?? [];
          const doneCount = dayTasks.filter((t) => t.status === 'COMPLETED').length;
          const pct = dayTasks.length ? Math.round((doneCount / dayTasks.length) * 100) : 0;
          return (
            <div key={d.toISOString()} className={`month-grid-cell${inMonth ? '' : ' outside'}${isToday ? ' today' : ''}`}>
              <button type="button" className="month-grid-cell-head" onClick={() => onPickDay?.(d)}>
                <span className="month-grid-daycount">{dayTasks.length || ''}</span>
                <span className="month-grid-daynum">{d.getDate()}</span>
              </button>
              {dayTasks.length > 0 && (
                <div className="month-grid-progress"><div className="month-grid-progress-fill" style={{ width: `${pct}%` }} />{pct > 0 && <span className="month-grid-progress-pct">{pct}%</span>}</div>
              )}
              <div className="month-grid-checklist">
                {dayTasks.slice(0, 4).map((t) => {
                  const done = t.status === 'COMPLETED';
                  return (
                    <div key={t.id} className="month-grid-check-row">
                      <button
                        type="button"
                        className={`month-grid-checkbox${done ? ' checked' : ''}`}
                        aria-label={done ? 'Mark as not completed' : 'Mark as completed'}
                        onClick={(e) => { e.stopPropagation(); onToggleComplete?.(t); }}
                      >
                        {done && '✓'}
                      </button>
                      <button
                        type="button"
                        className={`month-grid-check-label${done ? ' done' : ''}`}
                        title={`${t.title}${t.campaign ? ` — ${t.campaign.code} ${t.campaign.name}` : ''}`}
                        onClick={(e) => { e.stopPropagation(); onSelectTask(t); }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: regionColor(t.region), flexShrink: 0, display: 'inline-block' }} />
                        <span className="month-grid-check-text">{t.title}</span>
                      </button>
                    </div>
                  );
                })}
                {dayTasks.length > 4 && (
                  <button type="button" className="month-grid-pill more" onClick={() => onPickDay?.(d)}>+{dayTasks.length - 4} more</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (view === 'week') {
    const start = startOfWeek(anchor);
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
    return (
      <div className="month-grid" style={{ gridTemplateRows: 'auto 1fr' }}>
        {days.map((d) => (
          <div key={`h-${d.toISOString()}`} className="month-grid-weekday">
            {WEEKDAY_LABELS[(d.getDay() + 6) % 7]} {d.getDate()}
          </div>
        ))}
        {days.map((d) => {
          const dayTasks = tasksByDay.get(d.toDateString()) ?? [];
          const isToday = sameDay(d, today);
          return (
            <div key={d.toISOString()} className={`month-grid-cell${isToday ? ' today' : ''}`} style={{ minHeight: 140 }}>
              <span className="month-grid-pills">
                {dayTasks.map((t) => <Chip key={t.id} t={t} />)}
                {dayTasks.length === 0 && <span style={{ fontSize: 11, color: '#a99e88' }}>—</span>}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  if (view === 'day') {
    const dayTasks = tasksByDay.get(anchor.toDateString()) ?? [];
    return (
      <div className="card">
        <strong>{anchor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>
        {dayTasks.length === 0 && <p style={{ color: '#888', marginTop: 8 }}>No tasks due on this day.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {dayTasks.map((t) => (
            <div key={t.id} className="card" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => onSelectTask(t)}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: regionColor(t.region) }} />
                {t.campaign ? `[${t.campaign.code}] ` : ''}{t.title}
              </span>
              <span className="badge">{t.status.replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // year view: 12-month mini grid with a task count per month.
  const year = anchor.getFullYear();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
      {MONTH_LABELS.map((label, m) => {
        const count = tasks.filter((t) => {
          const d = new Date(t.dueDate);
          return d.getFullYear() === year && d.getMonth() === m;
        }).length;
        return (
          <div key={label} className="card" style={{ padding: 14, cursor: onPickDay ? 'pointer' : undefined }} onClick={() => onPickDay?.(new Date(year, m, 1))}>
            <strong>{label} {year}</strong>
            <p style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 800, color: '#241f18' }}>{count}</p>
            <p style={{ margin: 0, fontSize: 12, color: '#a99e88' }}>tasks due</p>
          </div>
        );
      })}
    </div>
  );
}
