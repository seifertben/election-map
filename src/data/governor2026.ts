import type { RaceRating } from "../types";

/**
 * The 36 states holding gubernatorial elections on November 3, 2026.
 * See https://en.wikipedia.org/wiki/2026_United_States_gubernatorial_elections
 */
export interface GovernorRace {
  fips: string;
  abbr: string;
  /** Party currently holding the governorship going into the election. */
  incumbentParty: "D" | "R" | "I";
}

export const GOVERNOR_2026_RACES: GovernorRace[] = [
  { fips: "01", abbr: "AL", incumbentParty: "R" },
  { fips: "02", abbr: "AK", incumbentParty: "R" },
  { fips: "04", abbr: "AZ", incumbentParty: "D" },
  { fips: "05", abbr: "AR", incumbentParty: "R" },
  { fips: "06", abbr: "CA", incumbentParty: "D" },
  { fips: "08", abbr: "CO", incumbentParty: "D" },
  { fips: "09", abbr: "CT", incumbentParty: "D" },
  { fips: "12", abbr: "FL", incumbentParty: "R" },
  { fips: "13", abbr: "GA", incumbentParty: "R" },
  { fips: "15", abbr: "HI", incumbentParty: "D" },
  { fips: "16", abbr: "ID", incumbentParty: "R" },
  { fips: "17", abbr: "IL", incumbentParty: "D" },
  { fips: "19", abbr: "IA", incumbentParty: "R" },
  { fips: "20", abbr: "KS", incumbentParty: "D" },
  { fips: "23", abbr: "ME", incumbentParty: "D" },
  { fips: "24", abbr: "MD", incumbentParty: "D" },
  { fips: "25", abbr: "MA", incumbentParty: "D" },
  { fips: "26", abbr: "MI", incumbentParty: "D" },
  { fips: "27", abbr: "MN", incumbentParty: "D" },
  { fips: "31", abbr: "NE", incumbentParty: "R" },
  { fips: "32", abbr: "NV", incumbentParty: "R" },
  { fips: "33", abbr: "NH", incumbentParty: "R" },
  { fips: "35", abbr: "NM", incumbentParty: "D" },
  { fips: "36", abbr: "NY", incumbentParty: "D" },
  { fips: "39", abbr: "OH", incumbentParty: "R" },
  { fips: "40", abbr: "OK", incumbentParty: "R" },
  { fips: "41", abbr: "OR", incumbentParty: "D" },
  { fips: "42", abbr: "PA", incumbentParty: "D" },
  { fips: "44", abbr: "RI", incumbentParty: "D" },
  { fips: "45", abbr: "SC", incumbentParty: "R" },
  { fips: "46", abbr: "SD", incumbentParty: "R" },
  { fips: "47", abbr: "TN", incumbentParty: "R" },
  { fips: "48", abbr: "TX", incumbentParty: "R" },
  { fips: "50", abbr: "VT", incumbentParty: "R" },
  { fips: "55", abbr: "WI", incumbentParty: "D" },
  { fips: "56", abbr: "WY", incumbentParty: "R" },
];

export const GOVERNOR_2026_FIPS: string[] = GOVERNOR_2026_RACES.map(
  (r) => r.fips,
);

export const GOVERNOR_RACE_BY_FIPS: Record<string, GovernorRace> =
  Object.fromEntries(GOVERNOR_2026_RACES.map((r) => [r.fips, r]));

/** Number of governorships up in 2026; a majority of the 50 states is 26. */
export const GOVERNOR_SEATS_UP = GOVERNOR_2026_RACES.length;
export const GOVERNOR_MAJORITY = 26;

/**
 * 2026 gubernatorial race ratings for the 36 states on the ballot, from the
 * Cook Political Report as listed on the Wikipedia "2026 United States
 * gubernatorial elections" predictions table (Cook, September 17, 2026). Each
 * Solid/Likely/Lean tone is kept so the map can shade the state accordingly.
 *
 * Keyed by the two-digit state FIPS code used by states.json.
 */
export const GOVERNOR_2026_RATINGS: Record<string, RaceRating> = {
  "01": "SOLID_R",
  "02": "TOSS",
  "04": "LEAN_D",
  "05": "SOLID_R",
  "06": "SOLID_D",
  "08": "SOLID_D",
  "09": "SOLID_D",
  "12": "LIKELY_R",
  "13": "TOSS",
  "15": "SOLID_D",
  "16": "SOLID_R",
  "17": "SOLID_D",
  "19": "LEAN_D",
  "20": "LEAN_R",
  "23": "SOLID_D",
  "24": "SOLID_D",
  "25": "SOLID_D",
  "26": "LEAN_D",
  "27": "SOLID_D",
  "31": "SOLID_R",
  "32": "TOSS",
  "33": "LIKELY_R",
  "35": "SOLID_D",
  "36": "SOLID_D",
  "39": "TOSS",
  "40": "SOLID_R",
  "41": "LEAN_D",
  "42": "SOLID_D",
  "44": "SOLID_D",
  "45": "SOLID_R",
  "46": "SOLID_R",
  "47": "SOLID_R",
  "48": "LIKELY_R",
  "50": "SOLID_R",
  "55": "TOSS",
  "56": "SOLID_R",
};

/**
 * Governorships not up in 2026, by current party: the 14 states whose next
 * gubernatorial election is after 2026. DE, KY, NC, NJ, VA and WA are held by
 * Democrats; IN, LA, MO, MS, MT, ND, UT and WV by Republicans.
 */
export const GOVERNOR_NOT_UP_D = 6;
export const GOVERNOR_NOT_UP_R = 8;
export const GOVERNOR_NOT_UP_I = 0;
