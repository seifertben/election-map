import type { Mode } from "../types";

export interface Candidate {
  name: string;
  party: string;
  partyCode: "D" | "R" | "I" | "O";
  source: string;
  biography?: string;
  photo?: string;
  photoSource?: string;
}

export type CandidateSnapshot = Record<Mode, Record<string, Candidate[]>> & {
  asOf: string;
  source: string;
};
