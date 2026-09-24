import type { RaceRating } from "../types";

/**
 * The 35 US Senate seats contested on November 3, 2026:
 * all 33 Class 2 seats plus special elections in Florida and Ohio.
 * See https://en.wikipedia.org/wiki/2026_United_States_Senate_elections
 */
export interface SenateRace {
  fips: string;
  abbr: string;
  /** "2" for a regular Class 2 race, "3s" for a Class 3 special election. */
  seatClass: "2" | "3s";
  /** Party currently holding the seat going into the election. */
  incumbentParty: "D" | "R" | "I";
}

export const SENATE_2026_RACES: SenateRace[] = [
  { fips: "01", abbr: "AL", seatClass: "2", incumbentParty: "R" },
  { fips: "02", abbr: "AK", seatClass: "2", incumbentParty: "R" },
  { fips: "05", abbr: "AR", seatClass: "2", incumbentParty: "R" },
  { fips: "08", abbr: "CO", seatClass: "2", incumbentParty: "D" },
  { fips: "10", abbr: "DE", seatClass: "2", incumbentParty: "D" },
  { fips: "12", abbr: "FL", seatClass: "3s", incumbentParty: "R" },
  { fips: "13", abbr: "GA", seatClass: "2", incumbentParty: "D" },
  { fips: "16", abbr: "ID", seatClass: "2", incumbentParty: "R" },
  { fips: "17", abbr: "IL", seatClass: "2", incumbentParty: "D" },
  { fips: "19", abbr: "IA", seatClass: "2", incumbentParty: "R" },
  { fips: "20", abbr: "KS", seatClass: "2", incumbentParty: "R" },
  { fips: "21", abbr: "KY", seatClass: "2", incumbentParty: "R" },
  { fips: "22", abbr: "LA", seatClass: "2", incumbentParty: "R" },
  { fips: "23", abbr: "ME", seatClass: "2", incumbentParty: "R" },
  { fips: "25", abbr: "MA", seatClass: "2", incumbentParty: "D" },
  { fips: "26", abbr: "MI", seatClass: "2", incumbentParty: "D" },
  { fips: "27", abbr: "MN", seatClass: "2", incumbentParty: "D" },
  { fips: "28", abbr: "MS", seatClass: "2", incumbentParty: "R" },
  { fips: "30", abbr: "MT", seatClass: "2", incumbentParty: "R" },
  { fips: "31", abbr: "NE", seatClass: "2", incumbentParty: "R" },
  { fips: "33", abbr: "NH", seatClass: "2", incumbentParty: "D" },
  { fips: "34", abbr: "NJ", seatClass: "2", incumbentParty: "D" },
  { fips: "35", abbr: "NM", seatClass: "2", incumbentParty: "D" },
  { fips: "37", abbr: "NC", seatClass: "2", incumbentParty: "R" },
  { fips: "39", abbr: "OH", seatClass: "3s", incumbentParty: "R" },
  { fips: "40", abbr: "OK", seatClass: "2", incumbentParty: "R" },
  { fips: "41", abbr: "OR", seatClass: "2", incumbentParty: "D" },
  { fips: "44", abbr: "RI", seatClass: "2", incumbentParty: "D" },
  { fips: "45", abbr: "SC", seatClass: "2", incumbentParty: "R" },
  { fips: "46", abbr: "SD", seatClass: "2", incumbentParty: "R" },
  { fips: "47", abbr: "TN", seatClass: "2", incumbentParty: "R" },
  { fips: "48", abbr: "TX", seatClass: "2", incumbentParty: "R" },
  { fips: "51", abbr: "VA", seatClass: "2", incumbentParty: "D" },
  { fips: "54", abbr: "WV", seatClass: "2", incumbentParty: "R" },
  { fips: "56", abbr: "WY", seatClass: "2", incumbentParty: "R" },
];

export const SENATE_2026_FIPS: string[] = SENATE_2026_RACES.map((r) => r.fips);

export const SENATE_RACE_BY_FIPS: Record<string, SenateRace> =
  Object.fromEntries(SENATE_2026_RACES.map((r) => [r.fips, r]));

/** Number of seats up in 2026; a majority of the full 100-seat chamber is 51. */
export const SENATE_SEATS_UP = SENATE_2026_RACES.length;
export const SENATE_MAJORITY = 51;

/**
 * 2026 Senate race ratings for the 35 seats on the ballot, from the Cook
 * Political Report's 2026 Senate Race Ratings
 * (https://www.cookpolitical.com/ratings/senate-race-ratings) as of
 * September 15, 2026. Each Solid/Likely/Lean tone is kept so the map can
 * shade the seat accordingly:
 *
 *   Solid/Likely/Lean Democrat  -> "SOLID_D" | "LIKELY_D" | "LEAN_D"
 *   Toss Up                     -> "TOSS"
 *   Solid/Likely/Lean Republican -> "SOLID_R" | "LIKELY_R" | "LEAN_R"
 *
 * Keyed by the two-digit state FIPS code used by states.json.
 */
export const SENATE_2026_RATINGS: Record<string, RaceRating> = {
  "01": "SOLID_R",
  "02": "TOSS",
  "05": "SOLID_R",
  "08": "SOLID_D",
  "10": "SOLID_D",
  "12": "SOLID_R",
  "13": "LEAN_D",
  "16": "SOLID_R",
  "17": "SOLID_D",
  "19": "TOSS",
  "20": "LIKELY_R",
  "21": "SOLID_R",
  "22": "SOLID_R",
  "23": "TOSS",
  "25": "SOLID_D",
  "26": "TOSS",
  "27": "LIKELY_D",
  "28": "SOLID_R",
  "30": "SOLID_R",
  "31": "LIKELY_R",
  "33": "TOSS",
  "34": "SOLID_D",
  "35": "SOLID_D",
  "37": "LEAN_D",
  "39": "TOSS",
  "40": "SOLID_R",
  "41": "SOLID_D",
  "44": "SOLID_D",
  "45": "SOLID_R",
  "46": "SOLID_R",
  "47": "SOLID_R",
  "48": "TOSS",
  "51": "SOLID_D",
  "54": "SOLID_R",
  "56": "SOLID_R",
};
