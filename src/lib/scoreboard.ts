import { baseParty, PARTY_COLOR, UNASSIGNED_COLOR } from "../data/parties";
import { SENATE_SEATS_UP, SENATE_2026_FIPS } from "../data/senate2026";
import { STATES } from "../data/states";
import type { Assignment } from "../types";

export interface Segment {
  key: string;
  label: string;
  count: number;
  color: string;
}

export interface ScoreModel {
  segments: Segment[];
  total: number;
  majority: number;
  caption: string;
  /** Headline counts: D, R, and everything else (tossup + uncalled). */
  headline: { D: number; R: number; other: number };
  unit: string;
}

const TOSS_LABEL = "Tossup";
const UNASSIGNED_LABEL = "Uncalled";
const INDEPENDENT_COLOR = "#6b7280";

function segment(
  key: string,
  label: string,
  count: number,
  color: string,
): Segment {
  return { key, label, count, color };
}

export const HOUSE_TOTAL = 435;
export const HOUSE_MAJORITY = 218;

export function presidentScore(
  assignments: Record<string, Assignment>,
): ScoreModel {
  let d = 0;
  let r = 0;
  let toss = 0;
  for (const state of STATES) {
    const party = baseParty(assignments[state.fips] ?? null);
    if (party === "D") d += state.electoralVotes;
    else if (party === "R") r += state.electoralVotes;
    else if (party === "TOSS") toss += state.electoralVotes;
  }
  const total = STATES.reduce((sum, s) => sum + s.electoralVotes, 0);
  const uncalled = total - d - r - toss;
  return {
    segments: [
      segment("D", "Democrat", d, PARTY_COLOR.D),
      segment("R", "Republican", r, PARTY_COLOR.R),
      segment("TOSS", TOSS_LABEL, toss, PARTY_COLOR.TOSS),
      segment("none", UNASSIGNED_LABEL, uncalled, UNASSIGNED_COLOR),
    ],
    total,
    majority: 270,
    caption: "270 electoral votes to win",
    headline: { D: d, R: r, other: toss + uncalled },
    unit: "electoral votes",
  };
}

export function houseScore(
  assignments: Record<string, Assignment>,
): ScoreModel {
  let d = 0;
  let r = 0;
  let toss = 0;
  for (const value of Object.values(assignments)) {
    const party = baseParty(value);
    if (party === "D") d += 1;
    else if (party === "R") r += 1;
    else if (party === "TOSS") toss += 1;
  }
  const uncalled = HOUSE_TOTAL - d - r - toss;
  return {
    segments: [
      segment("D", "Democrat", d, PARTY_COLOR.D),
      segment("R", "Republican", r, PARTY_COLOR.R),
      segment("TOSS", TOSS_LABEL, toss, PARTY_COLOR.TOSS),
      segment("none", UNASSIGNED_LABEL, Math.max(0, uncalled), UNASSIGNED_COLOR),
    ],
    total: HOUSE_TOTAL,
    majority: HOUSE_MAJORITY,
    caption: "218 seats for a majority",
    headline: { D: d, R: r, other: toss + Math.max(0, uncalled) },
    unit: "seats",
  };
}

// Seats not up in 2026, by current caucus (32 D, 31 R, 2 I).
const SENATE_NOT_UP_D = 32;
const SENATE_NOT_UP_R = 31;
const SENATE_NOT_UP_I = 2;

export function senateScore(
  assignments: Record<string, Assignment>,
): ScoreModel {
  let d = 0;
  let r = 0;
  let toss = 0;
  for (const fips of SENATE_2026_FIPS) {
    const party = baseParty(assignments[fips] ?? null);
    if (party === "D") d += 1;
    else if (party === "R") r += 1;
    else if (party === "TOSS") toss += 1;
  }
  const called = d + r + toss;
  const uncalled = SENATE_SEATS_UP - called;
  const dTotal = SENATE_NOT_UP_D + d;
  const rTotal = SENATE_NOT_UP_R + r;
  return {
    segments: [
      segment("D", "Democrat", dTotal, PARTY_COLOR.D),
      segment("R", "Republican", rTotal, PARTY_COLOR.R),
      segment("I", "Independent", SENATE_NOT_UP_I, INDEPENDENT_COLOR),
      segment("TOSS", TOSS_LABEL, toss, PARTY_COLOR.TOSS),
      segment("none", UNASSIGNED_LABEL, uncalled, UNASSIGNED_COLOR),
    ],
    total: 100,
    majority: 51,
    caption: `${SENATE_SEATS_UP} of 100 seats up in 2026 · 51 for a majority`,
    headline: {
      D: dTotal,
      R: rTotal,
      other: SENATE_NOT_UP_I + toss + uncalled,
    },
    unit: "seats",
  };
}
