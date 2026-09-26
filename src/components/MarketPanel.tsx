import type { MarketSource } from "../lib/markets";
import { MARKET_NONE_ID } from "../lib/markets";
import { pollScaleGradientCss } from "../lib/polling";

export type MarketStatus = "idle" | "loading" | "live" | "error";

export interface MarketPanelProps {
  /** Selected market source id, or MARKET_NONE_ID when no overlay is shown. */
  sourceId: string;
  onChange: (sourceId: string) => void;
  status: MarketStatus;
  /** ISO timestamp of the freshest quote, or null before the first load. */
  asOf: string | null;
  /** How many of the state races have usable odds. */
  count: number;
  /** Error message when status is "error". */
  error: string | null;
  /** True when the map no longer matches the map the market view began with. */
  isCustom: boolean;
  /** True when the market overlay is currently controlling the map. */
  active: boolean;
  /** Called to refetch the live odds. */
  onRefresh: () => void;
  /** Called to drop the user's paints and restore the market overlay. */
  onReapply: () => void;
  /** The race label for the panel copy ("Senate" / "Governor"). */
  raceLabel: string;
  /** How many states are on the ballot, for the panel copy. */
  raceCount: number;
  /** The market sources available for this race. */
  sources: MarketSource[];
}

function formatAsOf(asOf: string): string {
  const date = new Date(asOf);
  if (Number.isNaN(date.getTime())) return asOf;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MarketPanel({
  sourceId,
  onChange,
  status,
  asOf,
  count,
  error,
  isCustom,
  active,
  onRefresh,
  onReapply,
  raceLabel,
  raceCount,
  sources,
}: MarketPanelProps) {
  const overlayOn = sourceId !== MARKET_NONE_ID;
  const source = sources.find((s) => s.id === sourceId);

  return (
    <section className={`panel${active ? " panel--active" : ""}`}>
      <h2 className="panel__title">Betting Markets</h2>
      <label className="ratings__label" htmlFor="market-source">
        Color {raceLabel} states by live odds from
      </label>
      <select
        id="market-source"
        className="ratings__select"
        value={sourceId}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value={MARKET_NONE_ID} disabled>
          Select a market…
        </option>
        {sources.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>

      <div className="polling__legend">
        <div
          className="polling__scale"
          style={{ background: pollScaleGradientCss() }}
        />
        <div className="polling__ticks">
          <span>D 100%</span>
          <span>Even</span>
          <span>R 100%</span>
        </div>
      </div>

      {!overlayOn ? (
        <p className="ratings__note">
          Pick a market to color the {raceCount} {raceLabel} states by live
          implied win probability.
        </p>
      ) : status === "loading" && !asOf ? (
        <p className="ratings__note">Loading live odds…</p>
      ) : status === "error" ? (
        <p className="ratings__note">
          Couldn't load live odds{error ? `: ${error}` : "."}{" "}
          <button type="button" className="ratings__reapply" onClick={onRefresh}>
            Retry
          </button>
        </p>
      ) : isCustom ? (
        <p className="ratings__note">
          You've customized this map.{" "}
          <button
            type="button"
            className="ratings__reapply"
            onClick={onReapply}
          >
            Re-apply market
          </button>{" "}
          to restore the live colors.
        </p>
      ) : (
        <p className="ratings__note">
          Live implied win probability from{" "}
          <a href={source?.url} target="_blank" rel="noopener noreferrer">
            {source?.label ?? "the market"}
          </a>
          {asOf ? `, updated ${formatAsOf(asOf)}` : ""} ({count} of {raceCount}{" "}
          races).{" "}
          <button type="button" className="ratings__reapply" onClick={onRefresh}>
            Refresh
          </button>{" "}
          States with no market stay grey; painting wipes your paints, as does
          choosing ratings or polling.
        </p>
      )}
    </section>
  );
}
