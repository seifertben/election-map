import type { Mode } from "../types";

const MODES: { id: Mode; label: string }[] = [
  { id: "president", label: "President" },
  { id: "senate", label: "Senate" },
  { id: "house", label: "House" },
];

export interface ModeTabsProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

export function ModeTabs({ mode, onChange }: ModeTabsProps) {
  return (
    <div className="tabs" role="tablist" aria-label="Election type">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="tab"
          aria-selected={mode === m.id}
          className={mode === m.id ? "tab tab--active" : "tab"}
          onClick={() => onChange(m.id)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
