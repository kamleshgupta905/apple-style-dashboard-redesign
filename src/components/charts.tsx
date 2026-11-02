import { useEffect, useState } from "react";
import { cn } from "../utils/cn";

/** Flat, animated charts using plain SVG/CSS (no gradients). */

export function BarList({
  items,
  color = "var(--accent)",
  format = (n: number) => String(n),
}: {
  items: { label: string; value: number; sub?: string }[];
  color?: string;
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-4">
      {items.map((it, i) => (
        <li key={it.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="truncate text-[14px] font-medium text-ink">{it.label}</span>
            <span className="shrink-0 text-[14px] font-semibold text-ink tabular">{format(it.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-fill">
            <div
              className="anim-grow-x h-full rounded-full"
              style={{ width: `${(it.value / max) * 100}%`, background: color, animationDelay: `${i * 90}ms` }}
            />
          </div>
          {it.sub && <p className="mt-1 text-[12px] text-ink-3">{it.sub}</p>}
        </li>
      ))}
    </ul>
  );
}

export function Donut({
  segments,
  size = 168,
  thickness = 18,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill)" strokeWidth={thickness} />
        {total > 0 &&
          segments.map((s) => {
            const len = (s.value / total) * c;
            const gap = segments.filter((x) => x.value > 0).length > 1 ? 3 : 0;
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeLinecap="round"
                strokeDasharray={`${ready ? Math.max(0, len - gap) : 0} ${c}`}
                strokeDashoffset={-offset}
                style={{ transition: "stroke-dasharray 1.2s var(--ease)" }}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[26px] font-bold leading-none text-ink tabular">{centerValue ?? total}</span>
        {centerLabel && <span className="mt-1 text-[12px] font-medium text-ink-3">{centerLabel}</span>}
      </div>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; value: string | number; color: string }[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.label} className="flex items-center justify-between gap-6 text-[14px]">
          <span className="flex items-center gap-2 text-ink-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: i.color }} />
            {i.label}
          </span>
          <span className="font-semibold text-ink tabular">{i.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Vertical columns with labels. */
export function Columns({
  data,
  height = 180,
  color = "var(--accent)",
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-2 sm:gap-3" style={{ height }}>
      {data.map((d, i) => (
        <div key={d.label} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
          <span className="text-[12px] font-semibold text-ink opacity-0 transition-opacity group-hover:opacity-100 tabular">
            {d.value}
          </span>
          <div className="flex w-full flex-1 items-end">
            <div
              className="anim-grow-y w-full rounded-t-lg transition-opacity group-hover:opacity-80"
              style={{
                height: `${Math.max(3, (d.value / max) * 100)}%`,
                background: color,
                animationDelay: `${i * 70}ms`,
              }}
            />
          </div>
          <span className="w-full truncate text-center text-[11px] text-ink-3">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Funnel-like stacked progress */
export function Stacked({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3 w-full gap-1 overflow-hidden rounded-full">
        {parts.map((p, i) => (
          <div
            key={p.label}
            className={cn("anim-grow-x h-full rounded-full")}
            style={{ width: `${(p.value / total) * 100}%`, background: p.color, animationDelay: `${i * 100}ms` }}
            title={`${p.label}: ${p.value}`}
          />
        ))}
      </div>
    </div>
  );
}

export function Sparkline({ values, color = "var(--accent)", height = 44 }: { values: number[]; color?: string; height?: number }) {
  if (values.length < 2) return null;
  const w = 160;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, height - 4 - ((v - min) / (max - min || 1)) * (height - 8)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="anim-draw"
        style={{ ["--len" as any]: 400 }}
      />
    </svg>
  );
}
