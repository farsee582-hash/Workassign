import { useState } from 'react';

const COLORS = ['#f2ab0e', '#241f18', '#a89a7c', '#c0432b'];

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
  const stroke = size * 0.09; // thin ring, like the reference — not a thick donut
  const radius = r - stroke / 2;
  const pad = size * 0.16; // room for tick labels outside the ring
  const cx = r + pad;
  const cy = r + pad;
  const svgSize = size + pad * 2;

  // Near-full ring with a gap centered at the bottom (a speedometer-style
  // gauge), not a plain semicircle. 0deg = 3 o'clock, increases clockwise
  // (SVG's y-axis points down, so increasing angle sweeps clockwise).
  const gapDeg = 60;
  const sweepDeg = 360 - gapDeg;
  const startDeg = 90 + gapDeg / 2;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const pointAt = (deg: number, rad: number) => ({
    x: cx + rad * Math.cos(toRad(deg)),
    y: cy + rad * Math.sin(toRad(deg)),
  });
  const endDeg = startDeg + sweepDeg;
  const filledEndDeg = startDeg + frac * sweepDeg;
  const largeArc = (deg: number) => (deg - startDeg > 180 ? 1 : 0);

  const trackStart = pointAt(startDeg, radius);
  const trackEnd = pointAt(endDeg, radius);
  const filledEnd = pointAt(filledEndDeg, radius);
  const handle = pointAt(filledEndDeg, radius);
  const ticks = showTicks ? [0, 0.2, 0.4, 0.6, 0.8, 1] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
        <path
          d={`M ${trackStart.x} ${trackStart.y} A ${radius} ${radius} 0 ${largeArc(endDeg)} 1 ${trackEnd.x} ${trackEnd.y}`}
          fill="none"
          stroke="#fbe9c2"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {frac > 0 && (
          <path
            d={`M ${trackStart.x} ${trackStart.y} A ${radius} ${radius} 0 ${largeArc(filledEndDeg)} 1 ${filledEnd.x} ${filledEnd.y}`}
            fill="none"
            stroke="#f2ab0e"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        )}
        {ticks.map((t) => {
          const tp = pointAt(startDeg + t * sweepDeg, radius + stroke * 1.1);
          return (
            <text
              key={t}
              x={tp.x}
              y={tp.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={size * 0.06}
              fontWeight={600}
              fill="#a99e88"
            >
              {Math.round(min + t * (max - min))}
            </text>
          );
        })}
        {frac > 0 && (
          <circle cx={handle.x} cy={handle.y} r={stroke * 0.75} fill="#fff" stroke="#f2ab0e" strokeWidth={stroke * 0.35} style={{ filter: 'drop-shadow(0 2px 4px rgba(66,58,47,0.3))' }} />
        )}
      </svg>
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: size * 0.22, fontWeight: 800, color: '#241f18', lineHeight: 1 }}>{Math.round(frac * 100)}%</div>
        {label && <div style={{ fontSize: size * 0.065, color: '#746a5c', fontWeight: 600, marginTop: 4, whiteSpace: 'nowrap' }}>{label}</div>}
      </div>
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
      <path d={path} fill="none" stroke="#f2ab0e" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
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
