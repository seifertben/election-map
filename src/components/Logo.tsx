import { useId } from "react";

export interface LogoProps {
  size?: number;
}

const STRIPES = 13;
const FLAG_W = 76;
const FLAG_H = 40;
const STRIPE_H = FLAG_H / STRIPES;
const CANTON_W = 30.4;
const CANTON_H = STRIPE_H * 7;

const STAR_ROWS = 9;
const STAR_COUNT = 50;

const STAR_POINTS = (() => {
  const pts: { x: number; y: number }[] = [];
  const rowH = CANTON_H / STAR_ROWS;
  const rows = [6, 5, 6, 5, 6, 5, 6, 5, 6];
  let remaining = STAR_COUNT;
  for (let r = 0; r < STAR_ROWS; r += 1) {
    const count = Math.min(rows[r], remaining);
    const colW = CANTON_W / 12;
    for (let c = 0; c < count; c += 1) {
      pts.push({ x: colW * (2 * c + (count === 6 ? 1 : 2)), y: rowH * (r + 0.5) });
      remaining -= 1;
    }
  }
  return pts;
})();

const STAR_R = STRIPE_H * 0.32;

function starPath(cx: number, cy: number, r: number) {
  const inner = r * 0.382;
  let d = "";
  for (let i = 0; i < 10; i += 1) {
    const rad = (Math.PI / 5) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? r : inner;
    const x = cx + Math.cos(rad) * radius;
    const y = cy + Math.sin(rad) * radius;
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return `${d}Z`;
}

/**
 * A crisp flag badge with all 50 stars and 13 stripes.
 */
export function Logo({ size = 40 }: LogoProps) {
  const id = useId();
  const width = (size * FLAG_W) / FLAG_H;
  return (
    <svg
      className="logo"
      viewBox={`0 0 ${FLAG_W} ${FLAG_H}`}
      width={width}
      height={size}
      role="img"
      aria-label="2026 Election Mapper logo"
    >
      <defs>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#122640" stopOpacity="0.12" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <rect x="0.5" y="0.5" width={FLAG_W - 1} height={FLAG_H - 1} rx="5" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <rect width={FLAG_W} height={FLAG_H} fill="#fffdf8" />
        {Array.from({ length: STRIPES }, (_, i) =>
          i % 2 === 0 ? (
            <rect
              key={i}
              y={i * STRIPE_H}
              width={FLAG_W}
              height={STRIPE_H}
              fill="#ba3041"
            />
          ) : null,
        )}
        <rect width={CANTON_W} height={CANTON_H} fill="#203b62" />
        {STAR_POINTS.map((p, i) => (
          <path key={i} d={starPath(p.x, p.y, STAR_R)} fill="#ffffff" />
        ))}
        <rect width={FLAG_W} height={FLAG_H} fill={`url(#${id}-sheen)`} />
      </g>
      <rect x="0.5" y="0.5" width={FLAG_W - 1} height={FLAG_H - 1} rx="5" fill="none" stroke="#142b49" strokeOpacity="0.18" />
    </svg>
  );
}
