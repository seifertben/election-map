import {
  RATINGS_SOURCES,
  sourceAsOf,
} from "../data/ratingsSources";

export interface RatingsPanelProps {
  mode: "senate" | "house";
  /** Currently selected ratings source id. */
  sourceId: string;
  /** True when the map no longer matches the selected source (user edited it). */
  isCustom: boolean;
  /** Called when the user picks a source (or re-applies the current one). */
  onChange: (sourceId: string) => void;
  /** Whether party flips (projected party != incumbent party) are striped. */
  stripePickups: boolean;
  onStripeChange: (enabled: boolean) => void;
}

export function RatingsPanel({
  mode,
  sourceId,
  isCustom,
  onChange,
  stripePickups,
  onStripeChange,
}: RatingsPanelProps) {
  const source =
    RATINGS_SOURCES.find((s) => s.id === sourceId) ?? RATINGS_SOURCES[0];
  const modeLabel = mode === "senate" ? "Senate" : "House";
  return (
    <section className="panel">
      <h2 className="panel__title">Ratings</h2>
      <label className="ratings__label" htmlFor={`ratings-${mode}`}>
        Display {modeLabel} ratings from
      </label>
      <select
        id={`ratings-${mode}`}
        className="ratings__select"
        value={sourceId}
        onChange={(event) => onChange(event.target.value)}
      >
        {RATINGS_SOURCES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <label className="ratings__toggle">
        <input
          type="checkbox"
          checked={stripePickups}
          onChange={(event) => onStripeChange(event.target.checked)}
        />
        Stripe party pickups
      </label>
      {isCustom ? (
        <p className="ratings__note">
          You've customized this map.{" "}
          <button
            type="button"
            className="ratings__reapply"
            onClick={() => onChange(sourceId)}
          >
            Re-apply {source.label}
          </button>{" "}
          to restore its ratings.
        </p>
      ) : (
        <p className="ratings__note">
          Ratings from{" "}
          <a href={source.url} target="_blank" rel="noopener noreferrer">
            {source.label}
          </a>
          , as of {sourceAsOf(source, mode)}.
        </p>
      )}
    </section>
  );
}