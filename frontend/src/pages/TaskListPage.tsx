import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Task } from '../types';
import { StatusBadge } from '../components/StatusBadge';

export default function TaskListPage({ workType, title }: { workType?: 'CAMPAIGN' | 'DAILY'; title: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    const params = workType ? { workType } : {};
    api.get('/tasks', { params }).then((r) => setTasks(r.data));
  }, [workType]);

  return (
    <div>
      <div className="section-title">
        <h2>{title}</h2>
      </div>
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
          {tasks.map((t) => (
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
          {tasks.length === 0 && (
            <tr><td colSpan={7} style={{ color: '#888' }}>No tasks found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
