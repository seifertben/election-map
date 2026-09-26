import type { ScoreModel, Seat } from "../lib/scoreboard";
import { SeatArc } from "./SeatArc";

export interface ScoreboardProps {
  score: ScoreModel;
  /** Chamber seats to draw as a semicircle, or null for non-chamber modes. */
  seats?: Seat[] | null;
}

export function Scoreboard({ score, seats }: ScoreboardProps) {
  return (
    <div className="scoreboard">
      {seats && seats.length > 0 ? (
        <SeatArc
          seats={seats}
          counts={{ D: score.headline.D, R: score.headline.R }}
          label={`${score.caption}: ${score.headline.D} Democrat, ${score.headline.R} Republican`}
        />
      ) : null}
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
