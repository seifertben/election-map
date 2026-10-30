import { useEffect, useState } from "react";

// Midnight Eastern, after the November 1 daylight-saving transition.
const ELECTION_DAY = Date.parse("2026-11-03T00:00:00-05:00");
const ELECTION_END = Date.parse("2026-11-04T00:00:00-05:00");

function ElectionCountdown() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const remaining = Math.max(0, Math.ceil((ELECTION_DAY - now) / 1000));
  const units = [
    { label: "days", value: Math.floor(remaining / 86400), short: "d" },
    { label: "hours", value: Math.floor(remaining / 3600) % 24, short: "h" },
    { label: "minutes", value: Math.floor(remaining / 60) % 60, short: "m" },
    { label: "seconds", value: remaining % 60, short: "s" },
  ];
  return (
    <div className="election-countdown" role="timer" aria-live="off" title="Countdown to November 3, 2026 at midnight Eastern">
      {remaining > 0 ? <>
        <span className="election-countdown__label">Election Day<span> · Nov 3</span></span>
        <span className="election-countdown__digits">{units.map(({ label, value, short }) => <span key={short} aria-label={`${value} ${label}`}><strong>{String(value).padStart(2, "0")}</strong><small aria-hidden="true">{short}</small></span>)}</span>
      </> : <span className="election-countdown__label">{now < ELECTION_END ? "It's Election Day · November 3, 2026" : "Election Day · November 3, 2026"}</span>}
    </div>
  );
}

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

/** Flag ribbon with the star field on the left and a live election countdown. */
export function FlagRibbon() {
  return (
    <div className="flag-ribbon">
      <svg className="flag-ribbon__stars" viewBox="0 0 64 32" width="64" height="32" aria-hidden="true">
        <rect width="64" height="32" fill="#203b62" />
        {STAR_POINTS.map((point, index) => (
          <path key={index} d={starPath(point.x, point.y, STAR_R)} fill="#fffdf8" />
        ))}
      </svg>
      <ElectionCountdown />
    </div>
  );
}
