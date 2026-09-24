import type { Assignment, Assignments, Mode } from "../types";

export type RegionIds = Record<Mode, string[]>;

const TO_CHAR: Record<string, string> = {
  none: "0",
  D: "1",
  R: "2",
  TOSS: "3",
  SOLID_D: "4",
  LIKELY_D: "5",
  LEAN_D: "6",
  LEAN_R: "7",
  LIKELY_R: "8",
  SOLID_R: "9",
};

const FROM_CHAR: Record<string, Assignment> = {
  "0": null,
  "1": "D",
  "2": "R",
  "3": "TOSS",
  "4": "SOLID_D",
  "5": "LIKELY_D",
  "6": "LEAN_D",
  "7": "LEAN_R",
  "8": "LIKELY_R",
  "9": "SOLID_R",
};

/** Encode one mode's assignments as a fixed-width string over `ids`. */
export function encodeRegions(
  ids: string[],
  assignments: Record<string, Assignment>,
): string {
  let out = "";
  for (const id of ids) {
    out += TO_CHAR[assignments[id] ?? "none"];
  }
  return out;
}

/** Decode a fixed-width string produced by {@link encodeRegions}. */
export function decodeRegions(
  ids: string[],
  encoded: string,
): Record<string, Assignment> {
  const result: Record<string, Assignment> = {};
  for (let i = 0; i < ids.length; i += 1) {
    const value = FROM_CHAR[encoded[i]];
    if (value) result[ids[i]] = value;
  }
  return result;
}

/** Build a URL hash fragment encoding the whole map state. */
export function encodeHash(
  assignments: Assignments,
  ids: RegionIds,
  mode: Mode,
): string {
  const params = new URLSearchParams();
  params.set("m", mode);
  params.set("p", encodeRegions(ids.president, assignments.president));
  params.set("s", encodeRegions(ids.senate, assignments.senate));
  params.set("h", encodeRegions(ids.house, assignments.house));
  return `#${params.toString()}`;
}

export interface DecodedHash {
  mode: Mode | null;
  assignments: Assignments;
}

/** Parse a URL hash fragment back into assignments, ignoring stale lengths. */
export function decodeHash(hash: string, ids: RegionIds): DecodedHash {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const modeParam = params.get("m");
  const mode: Mode | null =
    modeParam === "president" || modeParam === "senate" || modeParam === "house"
      ? modeParam
      : null;

  const read = (key: keyof RegionIds): Record<string, Assignment> => {
    const raw = params.get(key === "president" ? "p" : key === "senate" ? "s" : "h");
    if (!raw || raw.length !== ids[key].length) return {};
    return decodeRegions(ids[key], raw);
  };

  return {
    mode,
    assignments: {
      president: read("president"),
      senate: read("senate"),
      house: read("house"),
    },
  };
}
