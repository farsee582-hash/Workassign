import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { User } from '../types';

export default function Staff() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    api.get('/users').then((r) => setUsers(r.data));
  }, []);

  return (
    <div>
      <div className="section-title"><h2>Staff</h2></div>
      <table>
        <thead>
          <tr><th>Employee ID</th><th>Name</th><th>Designation</th><th>Role</th><th>Status</th></tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.employeeId}</td>
              <td>{u.name}</td>
              <td>{u.designation}</td>
              <td>{u.role}</td>
              <td><span className="badge">{u.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
