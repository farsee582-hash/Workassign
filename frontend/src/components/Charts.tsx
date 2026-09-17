import { useState } from 'react';

const COLORS = ['#1d4ed8', '#1e7a4c', '#a5690f', '#c0392b', '#5b3fa6', '#0e7c86'];

/** Dependency-free horizontal bar chart with a hover tooltip. */
export function BarChart({ data }: { data: { label: string; value: number; color?: string }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      {data.map((d, i) => (
        <div
          key={d.label}
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, position: 'relative' }}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
        >
          <div
            style={{
              width: '30%',
              minWidth: 70,
              maxWidth: 120,
              fontSize: 13,
              color: '#555',
              flexShrink: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {d.label}
          </div>
          <div style={{ flex: 1, background: '#eef0f4', borderRadius: 4, height: 16, overflow: 'hidden' }}>
            <div
              style={{
                width: `${(d.value / max) * 100}%`,
                background: d.color ?? COLORS[i % COLORS.length],
                height: '100%',
                transition: 'width .2s',
              }}
            />
          </div>
          <div style={{ width: 36, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{d.value}</div>
          {hover === i && (
            <div
              style={{
                position: 'absolute',
                left: 128,
                top: -22,
                background: '#222',
                color: '#fff',
                fontSize: 11,
                padding: '2px 6px',
                borderRadius: 4,
                whiteSpace: 'nowrap',
              }}
            >
              {d.label}: {d.value}
            </div>
          )}
        </div>
      ))}
      {data.length === 0 && <p style={{ color: '#888' }}>No data.</p>}
    </div>
  );
}

/** Dependency-free SVG donut chart with a hover tooltip on each segment. */
export function DonutChart({ data, size = 140 }: { data: { label: string; value: number; color?: string }[]; size?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2;
  const stroke = size * 0.22;
  const radius = r - stroke / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: '100%', height: 'auto' }}>
        <g transform={`rotate(-90 ${r} ${r})`}>
          {total === 0 && <circle cx={r} cy={r} r={radius} fill="none" stroke="#eef0f4" strokeWidth={stroke} />}
          {data.map((d, i) => {
            const frac = total ? d.value / total : 0;
            const len = frac * circumference;
            const dash = `${len} ${circumference - len}`;
            const el = (
              <circle
                key={d.label}
                cx={r}
                cy={r}
                r={radius}
                fill="none"
                stroke={d.color ?? COLORS[i % COLORS.length]}
                strokeWidth={hover === i ? stroke + 4 : stroke}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                style={{ transition: 'stroke-width .15s', cursor: 'pointer' }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <title>{`${d.label}: ${d.value}`}</title>
              </circle>
            );
            offset += len;
            return el;
          })}
        </g>
        <text x={r} y={r} textAnchor="middle" dominantBaseline="central" fontSize={size * 0.16} fontWeight={700}>
          {total}
        </text>
      </svg>
      <div>
        {data.map((d, i) => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.color ?? COLORS[i % COLORS.length], display: 'inline-block' }} />
            {d.label}: <strong>{d.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
