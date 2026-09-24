import { PARTY_COLOR, PARTY_LABEL, UNASSIGNED_COLOR } from "../data/parties";
import type { Party } from "../types";

export type Brush = "CYCLE" | Party | "CLEAR";

const PARTY_BRUSHES: Party[] = ["D", "R", "TOSS"];

export interface PartyPaletteProps {
  brush: Brush;
  onChange: (brush: Brush) => void;
}

export function PartyPalette({ brush, onChange }: PartyPaletteProps) {
  return (
    <div className="palette" role="group" aria-label="Paint color">
      <button
        type="button"
        className={brush === "CYCLE" ? "chip chip--active" : "chip"}
        onClick={() => onChange("CYCLE")}
        title="Click a region to cycle Democrat → Republican → Tossup → clear"
      >
        Cycle
      </button>
      {PARTY_BRUSHES.map((party) => (
        <button
          key={party}
          type="button"
          className={brush === party ? "chip chip--active" : "chip"}
          onClick={() => onChange(party)}
          title={`Paint ${PARTY_LABEL[party]}`}
        >
          <span
            className="chip__swatch"
            style={{ backgroundColor: PARTY_COLOR[party] }}
            aria-hidden="true"
          />
          {PARTY_LABEL[party]}
        </button>
      ))}
      <button
        type="button"
        className={brush === "CLEAR" ? "chip chip--active" : "chip"}
        onClick={() => onChange("CLEAR")}
        title="Clear regions back to uncolored"
      >
        <span
          className="chip__swatch"
          style={{ backgroundColor: UNASSIGNED_COLOR }}
          aria-hidden="true"
        />
        Clear
      </button>
    </div>
  );
}
