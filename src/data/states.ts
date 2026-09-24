import type { StateInfo } from "../types";

/**
 * Fifty states plus the District of Columbia.
 * Electoral votes reflect the 2020 census apportionment used for the
 * 2024 and 2028 presidential elections (total: 538).
 */
export const STATES: StateInfo[] = [
  { fips: "01", abbr: "AL", name: "Alabama", electoralVotes: 9 },
  { fips: "02", abbr: "AK", name: "Alaska", electoralVotes: 3 },
  { fips: "04", abbr: "AZ", name: "Arizona", electoralVotes: 11 },
  { fips: "05", abbr: "AR", name: "Arkansas", electoralVotes: 6 },
  { fips: "06", abbr: "CA", name: "California", electoralVotes: 54 },
  { fips: "08", abbr: "CO", name: "Colorado", electoralVotes: 10 },
  { fips: "09", abbr: "CT", name: "Connecticut", electoralVotes: 7 },
  { fips: "10", abbr: "DE", name: "Delaware", electoralVotes: 3 },
  { fips: "11", abbr: "DC", name: "District of Columbia", electoralVotes: 3 },
  { fips: "12", abbr: "FL", name: "Florida", electoralVotes: 30 },
  { fips: "13", abbr: "GA", name: "Georgia", electoralVotes: 16 },
  { fips: "15", abbr: "HI", name: "Hawaii", electoralVotes: 4 },
  { fips: "16", abbr: "ID", name: "Idaho", electoralVotes: 4 },
  { fips: "17", abbr: "IL", name: "Illinois", electoralVotes: 19 },
  { fips: "18", abbr: "IN", name: "Indiana", electoralVotes: 11 },
  { fips: "19", abbr: "IA", name: "Iowa", electoralVotes: 6 },
  { fips: "20", abbr: "KS", name: "Kansas", electoralVotes: 6 },
  { fips: "21", abbr: "KY", name: "Kentucky", electoralVotes: 8 },
  { fips: "22", abbr: "LA", name: "Louisiana", electoralVotes: 8 },
  { fips: "23", abbr: "ME", name: "Maine", electoralVotes: 4 },
  { fips: "24", abbr: "MD", name: "Maryland", electoralVotes: 10 },
  { fips: "25", abbr: "MA", name: "Massachusetts", electoralVotes: 11 },
  { fips: "26", abbr: "MI", name: "Michigan", electoralVotes: 15 },
  { fips: "27", abbr: "MN", name: "Minnesota", electoralVotes: 10 },
  { fips: "28", abbr: "MS", name: "Mississippi", electoralVotes: 6 },
  { fips: "29", abbr: "MO", name: "Missouri", electoralVotes: 10 },
  { fips: "30", abbr: "MT", name: "Montana", electoralVotes: 4 },
  { fips: "31", abbr: "NE", name: "Nebraska", electoralVotes: 5 },
  { fips: "32", abbr: "NV", name: "Nevada", electoralVotes: 6 },
  { fips: "33", abbr: "NH", name: "New Hampshire", electoralVotes: 4 },
  { fips: "34", abbr: "NJ", name: "New Jersey", electoralVotes: 14 },
  { fips: "35", abbr: "NM", name: "New Mexico", electoralVotes: 5 },
  { fips: "36", abbr: "NY", name: "New York", electoralVotes: 28 },
  { fips: "37", abbr: "NC", name: "North Carolina", electoralVotes: 16 },
  { fips: "38", abbr: "ND", name: "North Dakota", electoralVotes: 3 },
  { fips: "39", abbr: "OH", name: "Ohio", electoralVotes: 17 },
  { fips: "40", abbr: "OK", name: "Oklahoma", electoralVotes: 7 },
  { fips: "41", abbr: "OR", name: "Oregon", electoralVotes: 8 },
  { fips: "42", abbr: "PA", name: "Pennsylvania", electoralVotes: 19 },
  { fips: "44", abbr: "RI", name: "Rhode Island", electoralVotes: 4 },
  { fips: "45", abbr: "SC", name: "South Carolina", electoralVotes: 9 },
  { fips: "46", abbr: "SD", name: "South Dakota", electoralVotes: 3 },
  { fips: "47", abbr: "TN", name: "Tennessee", electoralVotes: 11 },
  { fips: "48", abbr: "TX", name: "Texas", electoralVotes: 40 },
  { fips: "49", abbr: "UT", name: "Utah", electoralVotes: 6 },
  { fips: "50", abbr: "VT", name: "Vermont", electoralVotes: 3 },
  { fips: "51", abbr: "VA", name: "Virginia", electoralVotes: 13 },
  { fips: "53", abbr: "WA", name: "Washington", electoralVotes: 12 },
  { fips: "54", abbr: "WV", name: "West Virginia", electoralVotes: 4 },
  { fips: "55", abbr: "WI", name: "Wisconsin", electoralVotes: 10 },
  { fips: "56", abbr: "WY", name: "Wyoming", electoralVotes: 3 },
];

export const STATE_BY_FIPS: Record<string, StateInfo> = Object.fromEntries(
  STATES.map((s) => [s.fips, s]),
);

export const TOTAL_ELECTORAL_VOTES = STATES.reduce(
  (sum, s) => sum + s.electoralVotes,
  0,
);
