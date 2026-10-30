const CANTON_W = 64;
const CANTON_H = 32;
const STAR_R = 1.2;
const STAR_POINTS = Array.from({ length: 9 }, (_, row) =>
  Array.from({ length: row % 2 === 0 ? 6 : 5 }, (_, col) => ({
    x: (CANTON_W / 12) * (2 * col + (row % 2 === 0 ? 1 : 2)),
    y: (CANTON_H / 9) * (row + 0.5),
  })),
).flat();

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

/** Decorative flag ribbon with the star field anchored to the right. */
export function FlagRibbon() {
  return (
    <div className="flag-ribbon" aria-hidden="true">
      <svg className="flag-ribbon__stars" viewBox="0 0 64 32" width="64" height="32">
        <rect width="64" height="32" fill="#203b62" />
        {STAR_POINTS.map((point, index) => (
          <path key={index} d={starPath(point.x, point.y, STAR_R)} fill="#fffdf8" />
        ))}
      </svg>
    </div>
  );
}
