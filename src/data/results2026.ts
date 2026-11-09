import snapshot from "./results2026.json";
import { PRESIDENT_2024_RESULTS } from "./president2024";
import type { Assignment, Mode } from "../types";

export interface ElectionResult {
  status: "called" | "counting";
  party: "D" | "R" | null;
  candidate: string;
  votes: number;
  reporting: number;
  url: string;
}

export const RESULTS_AS_OF = snapshot.asOf;
export const RESULTS_SOURCE_URL = "https://polling-desk.com/press";
export const RESULTS_BY_MODE = snapshot.races as Record<
  "senate" | "governor" | "house",
  Record<string, ElectionResult>
>;

export const RESULT_ASSIGNMENTS: Record<Mode, Record<string, Assignment>> = {
  president: PRESIDENT_2024_RESULTS,
  senate: Object.fromEntries(Object.entries(RESULTS_BY_MODE.senate).filter(([, result]) => result.party).map(([id, result]) => [id, result.party])),
  governor: Object.fromEntries(Object.entries(RESULTS_BY_MODE.governor).filter(([, result]) => result.party).map(([id, result]) => [id, result.party])),
  house: Object.fromEntries(Object.entries(RESULTS_BY_MODE.house).filter(([, result]) => result.party).map(([id, result]) => [id, result.party])),
};

export function sameAssignments(a: Record<string, Assignment>, b: Record<string, Assignment>): boolean {
  return Object.keys(a).length === Object.keys(b).length &&
    Object.entries(a).every(([id, value]) => b[id] === value);
}
