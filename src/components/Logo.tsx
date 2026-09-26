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
    const colW = CANTON_W / (count + 1);
    for (let c = 1; c <= count; c += 1) {
      pts.push({ x: colW * c, y: rowH * (r + 0.5) });
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
 * App mark: an American flag whose right edge fades out into the title.
 */
export function Logo({ size = 40 }: LogoProps) {
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
        <linearGradient id="logo-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="45%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <mask id="logo-fade-mask">
          <rect width={FLAG_W} height={FLAG_H} fill="url(#logo-fade)" />
        </mask>
      </defs>
      <g mask="url(#logo-fade-mask)">
        <rect width={FLAG_W} height={FLAG_H} rx="4" fill="#ffffff" />
        {Array.from({ length: STRIPES }, (_, i) =>
          i % 2 === 0 ? (
            <rect
              key={i}
              y={i * STRIPE_H}
              width={FLAG_W}
              height={STRIPE_H}
              fill="#b22234"
            />
          ) : null,
        )}
        <rect width={CANTON_W} height={CANTON_H} fill="#3c3b6e" />
        {STAR_POINTS.map((p, i) => (
          <path key={i} d={starPath(p.x, p.y, STAR_R)} fill="#ffffff" />
        ))}
      </g>
    </svg>
  );
}
