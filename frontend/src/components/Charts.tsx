import { useState } from 'react';

const COLORS = ['#e8b923', '#241f18', '#a89a7c', '#c0432b'];

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

/** Dependency-free semicircular gauge for a single 0-100 hero metric. */
export function GaugeChart({
  percent,
  size = 160,
  label,
  min = 0,
  max = 100,
  showTicks = true,
}: {
  percent: number;
  size?: number;
  color?: string;
  label?: string;
  min?: number;
  max?: number;
  showTicks?: boolean;
}) {
  const p = Math.max(min, Math.min(max, percent));
  const frac = (p - min) / (max - min || 1);
  const r = size / 2;
  const stroke = size * 0.2;
  const radius = r - stroke / 2;
  const circumference = Math.PI * radius; // half circle
  const filled = frac * circumference;
  const pad = size * 0.14; // extra room for tick labels around the arc
  const cx = r + pad;
  const cy = r + stroke / 2;
  const svgW = size + pad * 2;
  const svgH = r + stroke / 2 + pad * 0.6;
  const gaugeId = `gauge-grad-${size}-${label ?? 'x'}`.replace(/\s+/g, '');

  // Angle of the arc runs from 180deg (left) to 0deg (right) along the top half.
  const angleFor = (f: number) => Math.PI - f * Math.PI;
  const pointAt = (f: number, rad: number) => {
    const a = angleFor(f);
    return { x: cx + rad * Math.cos(a), y: cy - rad * Math.sin(a) };
  };
  const handle = pointAt(frac, radius);
  const ticks = showTicks ? [0, 0.2, 0.4, 0.6, 0.8, 1] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        <defs>
          <linearGradient id={gaugeId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#c99a13" />
            <stop offset="55%" stopColor="#e8b923" />
            <stop offset="100%" stopColor="#f6d271" />
          </linearGradient>
        </defs>
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="#f2ead9"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={`url(#${gaugeId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
        />
        {ticks.map((t) => {
          const tp = pointAt(t, radius + stroke * 0.72);
          return (
            <text
              key={t}
              x={tp.x}
              y={tp.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={size * 0.075}
              fontWeight={600}
              fill="#a99e88"
            >
              {Math.round(min + t * (max - min))}
            </text>
          );
        })}
        <circle cx={handle.x} cy={handle.y} r={stroke * 0.42} fill="#fff" stroke="#e8b923" strokeWidth={size * 0.02} style={{ filter: 'drop-shadow(0 2px 4px rgba(66,58,47,0.35))' }} />
      </svg>
      <div style={{ marginTop: -svgH * 0.42, fontSize: size * 0.26, fontWeight: 800, color: '#241f18' }}>{Math.round(frac * 100)}%</div>
      {label && <div style={{ fontSize: 12, color: '#746a5c', fontWeight: 600, marginTop: 4 }}>{label}</div>}
    </div>
  );
}

/** Dependency-free line sparkline with a dashed average reference line. */
export function LineChart({ points, width = 280, height = 80 }: { points: number[]; width?: number; height?: number }) {
  if (points.length === 0) return <p style={{ color: '#a49a8a' }}>No data.</p>;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const avg = points.reduce((a, b) => a + b, 0) / points.length;
  const stepX = width / Math.max(1, points.length - 1);
  const toY = (v: number) => height - ((v - min) / range) * (height - 8) - 4;
  const path = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${toY(v)}`).join(' ');
  const avgY = toY(avg);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ maxWidth: '100%' }}>
      <line x1={0} y1={avgY} x2={width} y2={avgY} stroke="#cabfa8" strokeWidth={1} strokeDasharray="4 4" />
      <path d={path} fill="none" stroke="#e8b923" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((v, i) => (
        <circle key={i} cx={i * stepX} cy={toY(v)} r={2.5} fill="#241f18" />
      ))}
    </svg>
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
