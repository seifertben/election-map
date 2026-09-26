import type { RaceRating } from "../types";
import { GOVERNOR_2026_RATINGS } from "./governor2026";
import { HOUSE_2026_RATINGS } from "./house2026";
import { SENATE_2026_RATINGS } from "./senate2026";
import {
  DDHQ_GOVERNOR_RATINGS,
  DDHQ_HOUSE_RATINGS,
  DDHQ_SENATE_RATINGS,
} from "./ratings/ddhq";
import {
  FOX_GOVERNOR_RATINGS,
  FOX_HOUSE_RATINGS,
  FOX_SENATE_RATINGS,
} from "./ratings/fox";
import {
  INSIDEELECTIONS_GOVERNOR_RATINGS,
  INSIDEELECTIONS_HOUSE_RATINGS,
  INSIDEELECTIONS_SENATE_RATINGS,
} from "./ratings/insideElections";
import {
  SABATO_GOVERNOR_RATINGS,
  SABATO_HOUSE_RATINGS,
  SABATO_SENATE_RATINGS,
} from "./ratings/sabato";
import {
  SPLITTICKET_HOUSE_RATINGS,
  SPLITTICKET_SENATE_RATINGS,
} from "./ratings/splitTicket";

export interface RatingsSource {
  id: string;
  label: string;
  url: string;
  /** When the source published its Senate ratings. */
  senateAsOf: string;
  /** When the source published its House ratings. */
  houseAsOf: string;
  /** When the source published its Governor ratings, if it rates governors. */
  governorAsOf?: string;
  /** Full 2026 Senate ratings, keyed by state FIPS. */
  senate: Record<string, RaceRating>;
  /** Full 2026 House ratings, keyed by district GEOID. */
  house: Record<string, RaceRating>;
  /** Full 2026 Governor ratings, keyed by state FIPS; absent for outlets that
   *  do not publish gubernatorial ratings (Split Ticket). */
  governor?: Record<string, RaceRating>;
}

export const DEFAULT_RATINGS_SOURCE = "cook";

export const RATINGS_SOURCES: RatingsSource[] = [
  {
    id: "cook",
    label: "Cook Political Report",
    url: "https://www.cookpolitical.com/ratings",
    senateAsOf: "September 15, 2026",
    houseAsOf: "September 11, 2026",
    governorAsOf: "September 17, 2026",
    senate: SENATE_2026_RATINGS,
    house: HOUSE_2026_RATINGS,
    governor: GOVERNOR_2026_RATINGS,
  },
  {
    id: "insideElections",
    label: "Inside Elections",
    url: "https://insideelections.com/ratings",
    senateAsOf: "September 17, 2026",
    houseAsOf: "September 17, 2026",
    governorAsOf: "September 17, 2026",
    senate: INSIDEELECTIONS_SENATE_RATINGS,
    house: INSIDEELECTIONS_HOUSE_RATINGS,
    governor: INSIDEELECTIONS_GOVERNOR_RATINGS,
  },
  {
    id: "sabato",
    label: "Sabato's Crystal Ball",
    url: "https://centerforpolitics.org/crystalball/",
    senateAsOf: "September 22, 2026",
    houseAsOf: "September 22, 2026",
    governorAsOf: "September 22, 2026",
    senate: SABATO_SENATE_RATINGS,
    house: SABATO_HOUSE_RATINGS,
    governor: SABATO_GOVERNOR_RATINGS,
  },
  {
    id: "splitTicket",
    label: "Split Ticket",
    url: "https://split-ticket.org/",
    senateAsOf: "September 22, 2026",
    houseAsOf: "September 12, 2026",
    senate: SPLITTICKET_SENATE_RATINGS,
    house: SPLITTICKET_HOUSE_RATINGS,
  },
  {
    id: "ddhq",
    label: "Decision Desk HQ",
    url: "https://elections2026.decisiondeskhq.com/",
    senateAsOf: "September 22, 2026",
    houseAsOf: "September 12, 2026",
    governorAsOf: "September 23, 2026",
    senate: DDHQ_SENATE_RATINGS,
    house: DDHQ_HOUSE_RATINGS,
    governor: DDHQ_GOVERNOR_RATINGS,
  },
  {
    id: "fox",
    label: "Fox News Power Rankings",
    url: "https://www.foxnews.com/elections/",
    senateAsOf: "September 22, 2026",
    houseAsOf: "September 22, 2026",
    governorAsOf: "September 22, 2026",
    senate: FOX_SENATE_RATINGS,
    house: FOX_HOUSE_RATINGS,
    governor: FOX_GOVERNOR_RATINGS,
  },
];

export const RATINGS_SOURCE_BY_ID: Record<string, RatingsSource> =
  Object.fromEntries(RATINGS_SOURCES.map((s) => [s.id, s]));

/** The modes a ratings dropdown applies to (President has no race ratings). */
export const RATING_MODES = ["senate", "house", "governor"] as const;

/** Display date for a mode's ratings within a source. */
export function sourceAsOf(
  source: RatingsSource,
  mode: "senate" | "house" | "governor",
) {
  if (mode === "senate") return source.senateAsOf;
  if (mode === "house") return source.houseAsOf;
  return source.governorAsOf ?? "";
}

/** The ratings sources that publish ratings for a mode. */
export function sourcesForMode(
  mode: "senate" | "house" | "governor",
): RatingsSource[] {
  return RATINGS_SOURCES.filter((source) => source[mode] != null);
}