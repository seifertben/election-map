import { pollScaleGradientCss } from "../lib/polling";
import {
  formatSwing,
  HOUSE_SWING_MAX,
  HOUSE_SWING_MIN,
  HOUSE_SWING_STEP,
} from "../lib/houseSwing";

export interface SwingPanelProps {
  /** Whether the 2024 baseline is currently controlling the House map. */
  enabled: boolean;
  /** Uniform national swing in points toward the Democrats (negative is R). */
  swing: number;
  onToggle: (enabled: boolean) => void;
  onSwingChange: (swing: number) => void;
  /** Seats the swung map projects, for the panel summary. */
  seats: { d: number; r: number; even: number };
  /** Total districts the baseline covers, for the copy. */
  districtCount: number;
}

export function SwingPanel({
  enabled,
  swing,
  onToggle,
  onSwingChange,
  seats,
  districtCount,
}: SwingPanelProps) {
  return (
    <section className={`panel${enabled ? " panel--active" : ""}`}>
      <h2 className="panel__title">2024 Baseline</h2>
      <label className="ratings__toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onToggle(event.target.checked)}
        />
        Start from the 2024 presidential result
      </label>

      <div className="swing__control">
        <div className="swing__row">
          <span className="swing__label">Uniform swing</span>
          <span className="swing__value">{formatSwing(swing)}</span>
        </div>
        <input
          id="house-swing"
          className="swing__range"
          type="range"
          min={HOUSE_SWING_MIN}
          max={HOUSE_SWING_MAX}
          step={HOUSE_SWING_STEP}
          value={swing}
          disabled={!enabled}
          aria-label="Uniform national swing in points toward the Democrats"
          onChange={(event) => onSwingChange(Number(event.target.value))}
        />
        <div className="swing__ticks">
          <span>R +{Math.abs(HOUSE_SWING_MIN)}</span>
          <span>Even</span>
          <span>D +{HOUSE_SWING_MAX}</span>
        </div>
      </div>

      <div className="polling__legend">
        <div
          className="polling__scale"
          style={{ background: pollScaleGradientCss() }}
        />
        <div className="polling__ticks">
          <span>D</span>
          <span>Even</span>
          <span>R</span>
        </div>
      </div>

      {enabled ? (
        <p className="ratings__note">
          {districtCount} districts start from their 2024 presidential two-party
          margin; the swing shifts every district by the same amount. Projected
          now: <strong>{seats.d} D</strong> · <strong>{seats.r} R</strong>
          {seats.even > 0 ? ` · ${seats.even} even` : ""}. Painting is paused
          while this view is on.
        </p>
      ) : (
        <p className="ratings__note">
          Show each district's 2024 presidential result, then apply a uniform
          swing to model the 2026 map. Choosing ratings or a market clears this
          view.
        </p>
      )}
    </section>
  );
}
