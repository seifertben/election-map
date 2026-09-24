import type { RaceRating } from "../types";
import { HOUSE_2026_RATINGS } from "./house2026";
import { SENATE_2026_RATINGS } from "./senate2026";
import { DDHQ_HOUSE_RATINGS, DDHQ_SENATE_RATINGS } from "./ratings/ddhq";
import {
  FOX_HOUSE_RATINGS,
  FOX_SENATE_RATINGS,
} from "./ratings/fox";
import {
  INSIDEELECTIONS_HOUSE_RATINGS,
  INSIDEELECTIONS_SENATE_RATINGS,
} from "./ratings/insideElections";
import {
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
  /** Full 2026 Senate ratings, keyed by state FIPS. */
  senate: Record<string, RaceRating>;
  /** Full 2026 House ratings, keyed by district GEOID. */
  house: Record<string, RaceRating>;
}

export const DEFAULT_RATINGS_SOURCE = "cook";

export const RATINGS_SOURCES: RatingsSource[] = [
  {
    id: "cook",
    label: "Cook Political Report",
    url: "https://www.cookpolitical.com/ratings",
    senateAsOf: "September 15, 2026",
    houseAsOf: "September 11, 2026",
    senate: SENATE_2026_RATINGS,
    house: HOUSE_2026_RATINGS,
  },
  {
    id: "insideElections",
    label: "Inside Elections",
    url: "https://insideelections.com/ratings",
    senateAsOf: "September 17, 2026",
    houseAsOf: "September 17, 2026",
    senate: INSIDEELECTIONS_SENATE_RATINGS,
    house: INSIDEELECTIONS_HOUSE_RATINGS,
  },
  {
    id: "sabato",
    label: "Sabato's Crystal Ball",
    url: "https://centerforpolitics.org/crystalball/",
    senateAsOf: "September 22, 2026",
    houseAsOf: "September 22, 2026",
    senate: SABATO_SENATE_RATINGS,
    house: SABATO_HOUSE_RATINGS,
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
    senate: DDHQ_SENATE_RATINGS,
    house: DDHQ_HOUSE_RATINGS,
  },
  {
    id: "fox",
    label: "Fox News Power Rankings",
    url: "https://www.foxnews.com/elections/",
    senateAsOf: "September 22, 2026",
    houseAsOf: "September 22, 2026",
    senate: FOX_SENATE_RATINGS,
    house: FOX_HOUSE_RATINGS,
  },
];

export const RATINGS_SOURCE_BY_ID: Record<string, RatingsSource> =
  Object.fromEntries(RATINGS_SOURCES.map((s) => [s.id, s]));

/** The modes a ratings dropdown applies to (President has no race ratings). */
export const RATING_MODES = ["senate", "house"] as const;

/** Display date for a mode's ratings within a source. */
export function sourceAsOf(source: RatingsSource, mode: "senate" | "house") {
  return mode === "senate" ? source.senateAsOf : source.houseAsOf;
}