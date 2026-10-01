'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';

export interface LineSeries {
  kind: 'line';
  key: string;
  label: string;
  color: string;
  values: number[];
  dashed?: boolean;
}

export interface BandSeries {
  kind: 'band';
  key: string;
  label: string;
  color: string;
  lower: number[];
  upper: number[];
}

export type ChartSeries = LineSeries | BandSeries;

interface Props {
  x: number[];
  series: ChartSeries[];
  formatX: (x: number) => string;
  formatY: (y: number) => string;
  /** Compact tick labels for the y axis. */
  formatTick?: (y: number) => string;
  height?: number;
  ariaLabel: string;
}

const PAD = { top: 12, right: 12, bottom: 26, left: 56 };

function niceTicks(min: number, max: number, count = 4): number[] {
  if (max <= min) return [min];
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(v);
  return ticks;
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

/** Time-series chart: lines and shaded bands on one y axis, with a snapping crosshair and tooltip. */
export function TimeChart({ x, series, formatX, formatY, formatTick = formatY, height = 220, ariaLabel }: Props) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const geom = useMemo(() => {
    const all = series.flatMap((s) => (s.kind === 'line' ? s.values : [...s.lower, ...s.upper])).filter(Number.isFinite);
    const lo = Math.min(0, ...all);
    const hi = Math.max(...all, lo + 1);
    const ticks = niceTicks(lo, hi);
    const yMax = Math.max(hi, ticks[ticks.length - 1]);
    const yMin = Math.min(lo, ticks[0]);
    const innerW = width - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;
    const x0 = x[0];
    const x1 = x[x.length - 1];
    const sx = (v: number) => PAD.left + (x1 === x0 ? innerW / 2 : ((v - x0) / (x1 - x0)) * innerW);
    const sy = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;
    const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${sx(x[i]).toFixed(1)},${sy(v).toFixed(1)}`).join('');
    const xTickCount = Math.max(2, Math.min(6, Math.floor(innerW / 90)));
    const xTicks = Array.from({ length: xTickCount }, (_, i) => Math.round((i * (x.length - 1)) / (xTickCount - 1)));
    return { ticks, sx, sy, path, xTicks, innerH };
  }, [x, series, width, height]);

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left + PAD.left;
    let best = 0;
    let dist = Infinity;
    x.forEach((v, i) => {
      const d = Math.abs(geom.sx(v) - px);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    setHover(best);
  };

  const legend = series.length > 1;
  const hx = hover !== null ? geom.sx(x[hover]) : 0;

  return (
    <div className="chart" ref={ref}>
      {legend && (
        <div className="chart-legend">
          {series.map((s) => (
            <span key={s.key} className="chart-legend-item">
              <span className={`chart-key ${s.kind}`} style={{ background: s.kind === 'band' ? s.color : undefined, borderColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {geom.ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={geom.sy(t)} y2={geom.sy(t)} className="chart-grid" />
            <text x={PAD.left - 8} y={geom.sy(t)} className="chart-tick" textAnchor="end" dominantBaseline="middle">
              {formatTick(t)}
            </text>
          </g>
        ))}
        {geom.xTicks.map((i, n) => (
          <text
            key={i}
            x={geom.sx(x[i])}
            y={height - 8}
            className="chart-tick"
            textAnchor={n === 0 ? 'start' : n === geom.xTicks.length - 1 ? 'end' : 'middle'}
          >
            {formatX(x[i])}
          </text>
        ))}
        {series.map((s) =>
          s.kind === 'band' ? (
            <path
              key={s.key}
              d={`${geom.path(s.upper)}${s.lower
                .map((v, i) => [i, v] as const)
                .reverse()
                .map(([i, v]) => `L${geom.sx(x[i]).toFixed(1)},${geom.sy(v).toFixed(1)}`)
                .join('')}Z`}
              fill={s.color}
              opacity={0.18}
            />
          ) : (
            <path
              key={s.key}
              d={geom.path(s.values)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dashed ? '5 4' : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ),
        )}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={hx} x2={hx} y1={PAD.top} y2={PAD.top + geom.innerH} className="chart-crosshair" />
            {series.map((s) =>
              s.kind === 'line' ? (
                <circle key={s.key} cx={hx} cy={geom.sy(s.values[hover])} r={4} fill={s.color} className="chart-dot" />
              ) : null,
            )}
          </g>
        )}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={Math.max(0, width - PAD.left - PAD.right)}
          height={geom.innerH}
          fill="transparent"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hover !== null && (
        <div className={`chart-tooltip ${hx > width / 2 ? 'left' : 'right'}`} style={{ left: hx, top: legend ? 32 : 4 }}>
          <div className="chart-tooltip-x">{formatX(x[hover])}</div>
          {series.map((s) => (
            <div key={s.key} className="chart-tooltip-row">
              <span className="chart-tooltip-key" style={{ borderColor: s.color }} />
              <strong>
                {s.kind === 'line' ? formatY(s.values[hover]) : `${formatY(s.lower[hover])} – ${formatY(s.upper[hover])}`}
              </strong>
              <span className="muted">{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
