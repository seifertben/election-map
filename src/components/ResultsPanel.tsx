import { RESULTS_AS_OF, RESULTS_BY_MODE, RESULTS_SOURCE_URL } from "../data/results2026";
import type { Mode } from "../types";

interface ResultsPanelProps {
  mode: Mode;
  active: boolean;
  custom: boolean;
  onShow: () => void;
}

export function ResultsPanel({ mode, active, custom, onShow }: ResultsPanelProps) {
  const isPresident = mode === "president";
  const races = isPresident ? null : RESULTS_BY_MODE[mode];
  const called = races ? Object.values(races).filter((race) => race.status === "called").length : 51;
  const total = races ? Object.keys(races).length : 51;
  return (
    <section className={`panel results-panel${active ? " panel--active" : ""}`}>
      <h2 className="panel__title">Results</h2>
      <p className="ratings__note">
        {isPresident ? "2024 presidential results" : `${called} of ${total} races called`}
        {!isPresident && <> · <a href={RESULTS_SOURCE_URL} target="_blank" rel="noopener noreferrer">Polling Desk / civicAPI</a></>}
      </p>
      {!isPresident && <p className="ratings__note">As of {new Date(RESULTS_AS_OF).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" })}. Uncalled races are gray. Results are unofficial until certified.</p>}
      <button type="button" className="results-panel__button" onClick={onShow}>
        {active && custom ? "Restore results" : active ? "Reapply results" : "Show results"}
      </button>
    </section>
  );
}
