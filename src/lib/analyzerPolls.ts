/**
 * Bridge between a committed poll's demographic crosstabs and the analyzer's
 * category vote splits and composition.
 */

import type { PollCrosstab, PollDemographic } from "../data/analyzerPolls";
import { DIMENSIONS } from "./analyzer";
import type { CompositionMap, GeographyComposition, Splits } from "./analyzer";

/**
 * Turn a poll's crosstab into the analyzer's per-category vote splits. Every
 * category the poll did not break out inherits the poll's overall result, so a
 * partially reported demographic still yields a complete split map. A split
 * whose reported shares fall short of 100 (rounded third-party and undecided
 * rows are omitted from the source) has the remainder assigned to Other, so
 * every category totals 100.
 */
export function splitsFromCrosstab(crosstab: PollCrosstab): Splits {
  const result = {} as Splits;
  for (const dimension of DIMENSIONS) {
    result[dimension.id] = {};
    for (const category of dimension.categories) {
      const split = crosstab[dimension.id]?.[category.id] ?? crosstab.overall;
      result[dimension.id][category.id] = {
        d: split.d,
        r: split.r,
        o: Math.max(0, 100 - split.d - split.r),
      };
    }
  }
  return result;
}

const SEX_IDS: Record<string, string> = { men: "male", women: "female" };
const AGE_IDS = new Set(["18-29", "30-44", "45-64", "65+"]);
const RACE_IDS: Record<string, string> = {
  white: "white",
  black: "black",
  "black/african american": "black",
  "black or african american": "black",
  "african american": "black",
  hispanic: "hispanic",
  latino: "hispanic",
  asian: "asian",
  other: "other",
  "alaska native/ native american": "other",
  "alaska native/native american": "other",
  "native american": "other",
};
/** An "other non-white"/"another race" catch-all column, spread by census. */
const RACE_OTHER = /non.white|another race|other race/;
const RACE_ORDER = ["white", "black", "hispanic", "asian", "other"];
const NON_COLLEGE = ["no-hs", "hs", "some-college"];

/**
 * Spread `amount` across `ids` proportionally to their census weights. When the
 * weights are unavailable (all zero) it falls back to an even split.
 */
function distribute(
  ids: string[],
  amount: number,
  weights: Record<string, number>,
): Record<string, number> {
  const total = ids.reduce((sum, id) => sum + (weights[id] ?? 0), 0);
  const result: Record<string, number> = {};
  for (const id of ids) {
    const weight = total > 0 ? (weights[id] ?? 0) / total : 1 / ids.length;
    result[id] = amount * weight;
  }
  return result;
}

/**
 * Turn a poll's "Percentage of total electorate" rows into the analyzer's
 * composition, using the census only to split categories the poll reported as
 * an aggregate:
 *   - Education: a single "No B.A." total is divided among the three
 *     non-college bands in proportion to their census shares.
 *   - Race: a "Non-white" total (which includes any listed groups) or an
 *     "Other non-white" column (which excludes them) is spread across the
 *     groups the poll did not list, again in proportion to the census.
 *
 * The result is left unnormalized, mirroring the poll's printed shares (which
 * round to a total near — but not always exactly — 100).
 */
export function compositionFromCrosstab(
  rows: PollDemographic[],
  census: GeographyComposition,
): CompositionMap {
  const sex: Record<string, number> = {};
  const age: Record<string, number> = {};
  const race: Record<string, number> = {};
  const education: Record<string, number> = {};
  const party: Record<string, number> = {};
  let raceTotalNonWhite = 0;
  let raceOtherNonWhite = 0;
  let noBa = 0;
  // Three-band age columns (18-39 / 40-64) that span the analyzer's bands.
  let age1839 = 0;
  let age4064 = 0;

  for (const row of rows) {
    const label = row.label.trim();
    const lower = label.toLowerCase();
    const value = row.pct / 100;
    if (row.group === "sex") {
      const id = SEX_IDS[lower];
      if (id) sex[id] = value;
    } else if (row.group === "age") {
      if (AGE_IDS.has(label)) age[label] = value;
      else if (/18\s*[-–—]\s*39/.test(label)) age1839 += value;
      else if (/40\s*[-–—]\s*64/.test(label)) age4064 += value;
    } else if (row.group === "race") {
      const id = RACE_IDS[lower];
      if (id) {
        race[id] = value;
      } else if (lower === "non-white") {
        raceTotalNonWhite += value;
      } else if (RACE_OTHER.test(lower)) {
        raceOtherNonWhite += value;
      }
    } else if (row.group === "education") {
      if (/b\.?a\.?\+|bachelor/i.test(label)) {
        education["bachelors-plus"] = value;
      } else if (/no\s*b\.?a/i.test(label)) {
        noBa += value;
      }
    } else if (row.group === "party") {
      if (/democrat|^dem\.?$/.test(lower)) party.democrat = value;
      else if (/republican|^rep\.?$/.test(lower)) party.republican = value;
      else if (/independ|^ind\.?$|other/.test(lower)) party.independent = value;
    }
  }

  // A three-band "18-39" column splits across the analyzer's 18-29 and 30-44
  // bands in proportion to the census; "40-64" maps onto 45-64.
  if (age1839 > 0) {
    const split = distribute(["18-29", "30-44"], age1839, census.age);
    for (const id of ["18-29", "30-44"]) {
      age[id] = (age[id] ?? 0) + (split[id] ?? 0);
    }
  }
  if (age4064 > 0) age["45-64"] = (age["45-64"] ?? 0) + age4064;

  const missingRace = RACE_ORDER.filter((id) => !(id in race));
  if (missingRace.length) {
    const explicitNonWhite = ["black", "hispanic", "asian", "other"].reduce(
      (sum, id) => sum + (race[id] ?? 0),
      0,
    );
    const remainder =
      Math.max(0, raceTotalNonWhite - explicitNonWhite) + raceOtherNonWhite;
    Object.assign(race, distribute(missingRace, remainder, census.race));
  }

  const missingEducation = NON_COLLEGE.filter((id) => !(id in education));
  if (missingEducation.length) {
    Object.assign(
      education,
      distribute(missingEducation, noBa, census.education),
    );
  }

  const filled = (m: Record<string, number>, fallback: Record<string, number>) =>
    Object.keys(m).length ? m : fallback;

  return {
    sex: filled(sex, census.sex),
    age: filled(age, census.age),
    race: filled(race, census.race),
    education: filled(education, census.education),
    party: filled(party, census.party),
  };
}
