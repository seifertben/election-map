import { nextParty } from "../data/parties";
import type { Assignment, Assignments, Mode } from "../types";

export const MAX_HISTORY = 100;

export interface AppState {
  mode: Mode;
  assignments: Assignments;
  history: Assignments[];
}

export function emptyAssignments(): Assignments {
  return { president: {}, senate: {}, house: {}, governor: {} };
}

export function createInitialState(mode: Mode = "president"): AppState {
  return { mode, assignments: emptyAssignments(), history: [] };
}

export type Action =
  | { type: "setMode"; mode: Mode }
  | { type: "cycle"; mode: Mode; id: string }
  | { type: "set"; mode: Mode; id: string; party: Assignment }
  | { type: "undo" }
  | { type: "reset"; mode: Mode }
  | { type: "resetAll" }
  | {
      type: "loadRatings";
      mode: Mode;
      /** Full map of ratings for one mode; a plain party value clears a region. */
      assignments: Record<string, Assignment>;
    }
  | { type: "hydrate"; mode?: Mode; assignments: Assignments };

function isEmpty(record: Record<string, Assignment>): boolean {
  return Object.keys(record).length === 0;
}

function pushHistory(state: AppState): Assignments[] {
  return [...state.history, state.assignments].slice(-MAX_HISTORY);
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "setMode":
      return state.mode === action.mode ? state : { ...state, mode: action.mode };

    case "cycle": {
      const region = state.assignments[action.mode];
      const next = nextParty(region[action.id] ?? null);
      const updated: Record<string, Assignment> = { ...region };
      if (next === null) {
        delete updated[action.id];
      } else {
        updated[action.id] = next;
      }
      return {
        ...state,
        assignments: { ...state.assignments, [action.mode]: updated },
        history: pushHistory(state),
      };
    }

    case "set": {
      const region = state.assignments[action.mode];
      if ((region[action.id] ?? null) === action.party) return state;
      const updated: Record<string, Assignment> = { ...region };
      if (action.party === null) {
        delete updated[action.id];
      } else {
        updated[action.id] = action.party;
      }
      return {
        ...state,
        assignments: { ...state.assignments, [action.mode]: updated },
        history: pushHistory(state),
      };
    }

    case "undo": {
      if (state.history.length === 0) return state;
      const history = state.history.slice(0, -1);
      const assignments = state.history[state.history.length - 1];
      return { ...state, assignments, history };
    }

    case "reset": {
      if (isEmpty(state.assignments[action.mode])) return state;
      return {
        ...state,
        assignments: { ...state.assignments, [action.mode]: {} },
        history: pushHistory(state),
      };
    }

    case "resetAll": {
      if (
        isEmpty(state.assignments.president) &&
        isEmpty(state.assignments.senate) &&
        isEmpty(state.assignments.house) &&
        isEmpty(state.assignments.governor)
      ) {
        return state;
      }
      return {
        ...state,
        assignments: emptyAssignments(),
        history: pushHistory(state),
      };
    }

    case "loadRatings": {
      if (state.assignments[action.mode] === action.assignments) return state;
      return {
        ...state,
        assignments: {
          ...state.assignments,
          [action.mode]: action.assignments,
        },
        history: pushHistory(state),
      };
    }

    case "hydrate":
      return {
        ...state,
        mode: action.mode ?? state.mode,
        assignments: action.assignments,
        history: [],
      };

    default:
      return state;
  }
}
