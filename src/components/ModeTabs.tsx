import type { Mode } from "../types";

const MODES: { id: Mode; label: string }[] = [
  { id: "senate", label: "Senate" },
  { id: "house", label: "House" },
  { id: "governor", label: "Governor" },
  { id: "president", label: "President" },
];

export interface ModeTabsProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
  /** True while the State Analyzer view is showing instead of the map. */
  analyzerActive: boolean;
  onAnalyzer: () => void;
}

export function ModeTabs({
  mode,
  onChange,
  analyzerActive,
  onAnalyzer,
}: ModeTabsProps) {
  return (
    <div className="tabs" role="tablist" aria-label="Election type">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="tab"
          aria-selected={!analyzerActive && mode === m.id}
          className={!analyzerActive && mode === m.id ? "tab tab--active" : "tab"}
          onClick={() => onChange(m.id)}
        >
          {m.label}
        </button>
      ))}
      <button
        type="button"
        role="tab"
        aria-selected={analyzerActive}
        className={analyzerActive ? "tab tab--active" : "tab"}
        onClick={onAnalyzer}
      >
        State Analyzer
      </button>
    </div>
  );
}
