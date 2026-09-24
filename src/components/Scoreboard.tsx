import type { ScoreModel } from "../lib/scoreboard";

export interface ScoreboardProps {
  score: ScoreModel;
}

export function Scoreboard({ score }: ScoreboardProps) {
  return (
    <div className="scoreboard">
      <div className="scoreboard__headline">
        <div className="scoreboard__number scoreboard__number--d">
          {score.headline.D}
        </div>
        <div className="scoreboard__mid">
          <span className="scoreboard__caption">{score.caption}</span>
          <span className="scoreboard__sub">
            {score.majority} {score.unit} to win
          </span>
        </div>
        <div className="scoreboard__number scoreboard__number--r">
          {score.headline.R}
        </div>
      </div>

      <div
        className="scoreboard__bar"
        role="img"
        aria-label={score.segments
          .map((s) => `${s.label}: ${s.count}`)
          .join(", ")}
      >
        {score.segments
          .filter((s) => s.count > 0)
          .map((s) => (
            <div
              key={s.key}
              className="scoreboard__segment"
              style={{
                width: `${(s.count / score.total) * 100}%`,
                backgroundColor: s.color,
              }}
              title={`${s.label}: ${s.count}`}
            />
          ))}
      </div>

      <ul className="scoreboard__legend">
        {score.segments.map((s) => (
          <li key={s.key}>
            <span
              className="scoreboard__dot"
              style={{ backgroundColor: s.color }}
              aria-hidden="true"
            />
            {s.label}
            <strong>{s.count}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
