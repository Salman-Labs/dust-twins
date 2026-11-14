"use client";
// Dust Ring: one year of dust drawn as a closed ring. Radius = dust relative to the place's own average.
// Mars sits fixed (12 Ls bins, Ls 0 at top). The Earth ring rotates by the season shift until it lines up.
import { MONTHS } from "@/lib/types";

const C = 160, R0 = 40, R1 = 128, VMAX = 2.4;

const pt = (i: number, v: number, n = 12) => {
  const a = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2;
  const r = R0 + (Math.min(v, VMAX) / VMAX) * (R1 - R0);
  return [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
};

/** Closed smooth path through the 12 points (Catmull-Rom converted to cubic Beziers). */
function ringPath(shape: number[]) {
  const p = shape.map((v, i) => pt(i, v));
  const n = p.length;
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + "Z";
}

export default function DustRing(props: {
  mars: number[]; marsYears?: number[][]; earth?: number[] | null; shift?: number; aligned?: boolean;
  highlight?: number | null; size?: number; title: string; emphYear?: number | null;
}) {
  const { mars, earth, shift = 0, aligned = true, highlight = null, size = 300 } = props;
  const mean = mars.reduce((a, b) => a + b, 0) / mars.length || 1;
  // Earth month j sits at Mars bin (j + shift) when aligned, so rotate the Earth ring by shift * 30 degrees.
  const rot = aligned ? shift * 30 : 0;
  return (
    <svg viewBox="0 0 320 320" width={size} height={size} role="img" aria-label={props.title} className="max-w-full h-auto">
      <title>{props.title}</title>
      {[1, 2].map((v) => (
        <circle key={v} cx={C} cy={C} r={R0 + (v / VMAX) * (R1 - R0)} fill="none" stroke="var(--line)" strokeDasharray={v === 1 ? "0" : "2 4"} />
      ))}
      <text x={C} y={C - (R0 + (1 / VMAX) * (R1 - R0)) - 3} textAnchor="middle" className="num" fontSize="7" fill="var(--dim)">average</text>
      {/* Mars dust-storm season (Ls 180-360) */}
      <path d={`M${C},${C + R1 + 8} A${R1 + 8},${R1 + 8} 0 0 1 ${C},${C - R1 - 8}`} fill="none" stroke="var(--mars)" strokeOpacity="0.28" strokeWidth="2" />
      {[0, 90, 180, 270].map((ls) => {
        const a = (ls / 360) * Math.PI * 2 - Math.PI / 2;
        return <text key={ls} x={C + (R1 + 20) * Math.cos(a)} y={C + (R1 + 20) * Math.sin(a) + 3} textAnchor="middle" className="num" fontSize="8" fill="var(--mars)">Ls {ls}°</text>;
      })}
      {/* each Mars year, faint: global-storm years show up as spikes */}
      {props.marsYears?.map((y, i) => (
        <path key={i} d={ringPath(y.map((v) => v / mean))} fill="none" stroke="var(--mars)" strokeOpacity="0.16" strokeWidth="0.8" />
      ))}
      <path d={ringPath(mars)} fill="var(--mars)" fillOpacity="0.14" stroke="var(--mars)" strokeWidth="2" />
      {props.emphYear != null && props.marsYears?.[props.emphYear] && (
        <path d={ringPath(props.marsYears[props.emphYear].map((v) => v / mean))} fill="none" stroke="var(--ink)" strokeWidth="1.8" />
      )}
      {earth && (
        <g className="ring-rot" style={{ transform: `rotate(${rot}deg)` }}>
          <path d={ringPath(earth)} fill="var(--earth)" fillOpacity="0.1" stroke="var(--earth)" strokeWidth="2" />
          {MONTHS.map((m, j) => {
            const a = ((j + 0.5) / 12) * Math.PI * 2 - Math.PI / 2;
            const on = highlight === j;
            return (
              <text key={m} x={C + (R0 - 13) * Math.cos(a)} y={C + (R0 - 13) * Math.sin(a) + 2.5} textAnchor="middle" className="num"
                fontSize={on ? 8.5 : 6.5} fontWeight={on ? 700 : 400} fill={on ? "var(--ink)" : "var(--earth)"}>{m[0]}</text>
            );
          })}
          {highlight != null && (() => { const [x, y] = pt(highlight, earth[highlight]); return <circle cx={x} cy={y} r="4" fill="var(--ink)" />; })()}
        </g>
      )}
    </svg>
  );
}
