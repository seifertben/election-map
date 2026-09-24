export type Party = "D" | "R" | "TOSS";

/**
 * A Cook-style race rating. Rankings default to these so the map can show
 * Solid/Likely/Lean shades; user clicks only ever paint the flat `Party`
 * values above.
 */
export type RaceRating =
  | "SOLID_D"
  | "LIKELY_D"
  | "LEAN_D"
  | "TOSS"
  | "LEAN_R"
  | "LIKELY_R"
  | "SOLID_R";

export type Assignment = Party | RaceRating | null;

export type Mode = "president" | "senate" | "house";

export type Assignments = Record<Mode, Record<string, Assignment>>;

export interface StateInfo {
  /** Two-digit FIPS code, e.g. "01" for Alabama. */
  fips: string;
  /** USPS abbreviation, e.g. "AL". */
  abbr: string;
  /** Display name, e.g. "Alabama". */
  name: string;
  /** Electoral votes for the 2024/2028 cycles (2020 census apportionment). */
  electoralVotes: number;
}

export interface StateFeature {
  type: "Feature";
  id?: string | number;
  properties: {
    fips: string;
    abbr: string;
    name: string;
  };
  geometry: unknown;
}

export interface DistrictFeature {
  type: "Feature";
  id?: string | number;
  properties: {
    geoid: string;
    state: string;
    district: string;
    name: string;
  };
  geometry: unknown;
}

export interface RegionFeature {
  type: "Feature";
  id?: string | number;
  properties: Record<string, unknown>;
  geometry: unknown;
}
