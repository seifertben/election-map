import { baseParty, PARTY_COLOR, UNASSIGNED_COLOR } from "../data/parties";
import {
  GOVERNOR_2026_FIPS,
  GOVERNOR_NOT_UP_D,
  GOVERNOR_NOT_UP_I,
  GOVERNOR_NOT_UP_R,
  GOVERNOR_SEATS_UP,
} from "../data/governor2026";
import { PRESIDENT_2024_RESULTS } from "../data/president2024";
import { SENATE_SEATS_UP, SENATE_2026_FIPS } from "../data/senate2026";
import { STATES, STATE_BY_FIPS } from "../data/states";
import type { Assignment, Mode, Party } from "../types";

export interface Segment {
  key: string;
  label: string;
  count: number;
  color: string;
}

/** A single chamber seat: its region id, state abbreviation, and party. */
export interface Seat {
  id: string;
  state: string;
  party: Party | null;
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

export function governorScore(
  assignments: Record<string, Assignment>,
): ScoreModel {
  let d = 0;
  let r = 0;
  let toss = 0;
  for (const fips of GOVERNOR_2026_FIPS) {
    const party = baseParty(assignments[fips] ?? null);
    if (party === "D") d += 1;
    else if (party === "R") r += 1;
    else if (party === "TOSS") toss += 1;
  }
  const called = d + r + toss;
  const uncalled = GOVERNOR_SEATS_UP - called;
  const dTotal = GOVERNOR_NOT_UP_D + d;
  const rTotal = GOVERNOR_NOT_UP_R + r;
  return {
    segments: [
      segment("D", "Democrat", dTotal, PARTY_COLOR.D),
      segment("R", "Republican", rTotal, PARTY_COLOR.R),
      segment("I", "Independent", GOVERNOR_NOT_UP_I, INDEPENDENT_COLOR),
      segment("TOSS", TOSS_LABEL, toss, PARTY_COLOR.TOSS),
      segment("none", UNASSIGNED_LABEL, uncalled, UNASSIGNED_COLOR),
    ],
    total: 50,
    majority: 26,
    caption: `${GOVERNOR_SEATS_UP} of 50 governorships up in 2026 · 26 for a majority`,
    headline: {
      D: dTotal,
      R: rTotal,
      other: GOVERNOR_NOT_UP_I + toss + uncalled,
    },
    unit: "governorships",
  };
}

/**
 * Every seat of a chamber as an unordered list of dots. House seats are keyed
 * by their district GEOID (one dot per district that exists). The Senate is a
 * full 100-seat chamber: the 35 seats up in 2026 use the map's assignments,
 * and the 65 seats not up are given their current caucus party — placed in
 * states by 2024 presidential lean, then reconciled to the known 32 D / 31 R /
 * 2 I not-up totals so the dots always agree with the scoreboard headline.
 * Returns an empty list for other modes.
 */
export function chamberSeats(
  mode: Mode,
  assignments: Record<string, Assignment>,
): Seat[] {
  if (mode === "house") {
    return Object.keys(assignments)
      .sort()
      .map((id) => ({
        id,
        state: STATE_BY_FIPS[id.slice(0, 2)]?.abbr ?? id.slice(0, 2),
        party: baseParty(assignments[id] ?? null),
      }));
  }
  if (mode === "senate") {
    const seats: Seat[] = [];

    // One dot for every seat up in 2026, colored by the map's assignment.
    const upCount = new Map<string, number>();
    for (const fips of SENATE_2026_FIPS) {
      upCount.set(fips, (upCount.get(fips) ?? 0) + 1);
      seats.push({
        id: `up-${fips}`,
        state: STATE_BY_FIPS[fips]?.abbr ?? fips,
        party: baseParty(assignments[fips] ?? null),
      });
    }

    // Every state has two senators (DC has none); the rest are not up in 2026.
    const notUpFips: string[] = [];
    for (const state of STATES) {
      if (state.abbr === "DC") continue;
      const remaining = 2 - (upCount.get(state.fips) ?? 0);
      for (let n = 0; n < remaining; n += 1) notUpFips.push(state.fips);
    }

    // Rank the not-up seats most Republican-leaning state first, then hand out
    // the known 32 D / 31 R / 2 I caucus totals (independents from the bluest).
    const lean = (fips: string) =>
      PRESIDENT_2024_RESULTS[fips] === "D" ? 1 : 0;
    notUpFips.sort((a, b) => lean(a) - lean(b));

    let d = SENATE_NOT_UP_D;
    let r = SENATE_NOT_UP_R;
    let i = SENATE_NOT_UP_I;
    for (const fips of notUpFips) {
      let party: Party;
      if (i > 0 && lean(fips) === 1) {
        party = "TOSS";
        i -= 1;
      } else if (r > 0) {
        party = "R";
        r -= 1;
      } else if (d > 0) {
        party = "D";
        d -= 1;
      } else {
        party = "R";
      }
      seats.push({
        id: `notup-${fips}-${seats.length}`,
        state: STATE_BY_FIPS[fips]?.abbr ?? fips,
        party,
      });
    }
    return seats;
  }
  return [];
}
