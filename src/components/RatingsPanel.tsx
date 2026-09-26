import {
  sourcesForMode,
  sourceAsOf,
} from "../data/ratingsSources";

export interface RatingsPanelProps {
  mode: "senate" | "house" | "governor";
  /** Currently selected ratings source id. */
  sourceId: string;
  /** True when the map no longer matches the selected source (user edited it). */
  isCustom: boolean;
  /** True when ratings are the overlay currently controlling the map. */
  active: boolean;
  /** Called when the user picks a source (or re-applies the current one). */
  onChange: (sourceId: string) => void;
}

const MODE_LABEL: Record<"senate" | "house" | "governor", string> = {
  senate: "Senate",
  governor: "Governor",
  house: "House",
};

export function RatingsPanel({
  mode,
  sourceId,
  isCustom,
  active,
  onChange,
}: RatingsPanelProps) {
  const modeLabel = MODE_LABEL[mode];
  const sources = sourcesForMode(mode);
  const source = sources.find((s) => s.id === sourceId);
  return (
    <section className={`panel${active ? " panel--active" : ""}`}>
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
        {source ? null : (
          <option value="">Select a ratings source…</option>
        )}
        {sources.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      {!source ? (
        <p className="ratings__note">
          Pick a ratings source to color the {modeLabel.toLowerCase()} map.
        </p>
      ) : isCustom ? (
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