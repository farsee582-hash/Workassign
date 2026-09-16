import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Department } from '../types';

export default function Departments() {
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    api.get('/departments').then((r) => setDepartments(r.data));
  }, []);

  return (
    <div>
      <div className="section-title"><h2>Departments</h2></div>
      {departments.map((d) => (
        <div className="card" key={d.id} style={{ marginBottom: 12 }}>
          <strong>{d.name}</strong>
          <p style={{ color: '#888', margin: '4px 0' }}>{d.description}</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {d.subDepartments.map((s) => <span key={s.id} className="badge">{s.name}</span>)}
          </div>
        </div>
      ))}
    </div>
  );
}
