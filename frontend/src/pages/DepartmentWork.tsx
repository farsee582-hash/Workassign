import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Department, Task } from '../types';
import { StatusBadge } from '../components/StatusBadge';

/**
 * Generic fallback for any department/sub-department that doesn't yet have
 * a dedicated module (like Digital Marketing does). Lists its tasks via the
 * same generic /tasks?departmentId&subDepartmentId filters the Digital
 * Marketing module uses, so every department is at least browsable from the
 * sidebar while richer modules (Calendar/Chart tabs, etc.) are built later.
 */
export default function DepartmentWork() {
  const { id } = useParams<{ id: string }>();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    api.get('/departments').then((r) => setDepartments(r.data));
  }, []);

  const department = departments.find((d) => d.id === id);
  const subDepartment = departments.flatMap((d) => d.subDepartments).find((s) => s.id === id);
  const owningDepartment = subDepartment ? departments.find((d) => d.id === subDepartment.departmentId) : department;

  useEffect(() => {
    if (!id) return;
    const params = subDepartment
      ? { departmentId: subDepartment.departmentId, subDepartmentId: subDepartment.id }
      : { departmentId: id };
    api.get('/tasks', { params }).then((r) => setTasks(r.data));
  }, [id, subDepartment]);

  const title = subDepartment ? `${owningDepartment?.name ?? ''} / ${subDepartment.name}` : department?.name ?? 'Department';

  return (
    <div>
      <div className="section-title"><h2>{title}</h2></div>
      <div className="card">
        {tasks.length === 0 && <div className="empty-note">No tasks yet for this department.</div>}
        {tasks.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Task</th><th>Assigned To</th><th>Due</th><th>Priority</th><th>Status</th><th>Completion</th></tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <td>{t.title}</td>
                    <td>{t.assignedTo?.name}</td>
                    <td>{new Date(t.dueDate).toLocaleDateString()}</td>
                    <td>{t.priority}</td>
                    <td><StatusBadge status={t.status} overdue={t.overdue} /></td>
                    <td>{t.completionPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
