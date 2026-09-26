import {
  POLL_AVERAGE_OPTIONS,
  POLL_MARGIN_CAP,
  POLL_NONE_OPTION_ID,
  pollScaleGradientCss,
} from "../lib/polling";
import type { PollOption } from "../lib/polling";

export interface PollingPanelProps {
  /** Selected poll option id, or POLL_NONE_OPTION_ID when no overlay is shown. */
  optionId: string;
  onChange: (optionId: string) => void;
  /** True when the map no longer matches the map polling began with. */
  isCustom: boolean;
  /** True when the poll overlay is currently controlling the map. */
  active: boolean;
  /** Called to drop the user's paints and restore the poll overlay. */
  onReapply: () => void;
  /** The race label for the panel copy ("Senate" / "Governor"). */
  raceLabel: string;
  /** How many states are on the ballot, for the panel copy. */
  raceCount: number;
  /** Date of the most recent committed poll. */
  asOf: string;
  /** The poll options (averages + pollsters) for this race. */
  options: PollOption[];
}

export function PollingPanel({
  optionId,
  onChange,
  isCustom,
  active,
  onReapply,
  raceLabel,
  raceCount,
  asOf,
  options,
}: PollingPanelProps) {
  const overlayOn = optionId !== POLL_NONE_OPTION_ID;
  const pollsterOptions = options.filter((option) => option.kind === "pollster");
  return (
    <section className={`panel${active ? " panel--active" : ""}`}>
      <h2 className="panel__title">Polling</h2>
      <label className="ratings__label" htmlFor="polling-option">
        Color {raceLabel} states by
      </label>
      <select
        id="polling-option"
        className="ratings__select"
        value={optionId}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value={POLL_NONE_OPTION_ID} disabled>
          Select a poll…
        </option>
        <optgroup label="Averages">
          {POLL_AVERAGE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Pollster">
          {pollsterOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </optgroup>
      </select>

      <div className="polling__legend">
        <div
          className="polling__scale"
          style={{ background: pollScaleGradientCss() }}
        />
        <div className="polling__ticks">
          <span>D +{POLL_MARGIN_CAP}</span>
          <span>Even</span>
          <span>R +{POLL_MARGIN_CAP}</span>
        </div>
      </div>

      {overlayOn && isCustom ? (
        <p className="ratings__note">
          You've customized this map.{" "}
          <button
            type="button"
            className="ratings__reapply"
            onClick={onReapply}
          >
            Re-apply poll
          </button>{" "}
          to restore the poll colors.
        </p>
      ) : (
        <p className="ratings__note">
          {overlayOn
            ? "States with no matching poll stay grey. A state whose poll leader differs from the incumbent is striped as a pickup (toggle it in Pickups). Selecting or changing a poll wipes your paints; so does choosing a ratings source."
            : `Pick a pollster or a rolling average to color the ${raceCount} ${raceLabel} states by polling margin. Polls through ${asOf}.`}
        </p>
      )}
    </section>
  );
}
