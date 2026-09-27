/**
 * The State Analyzer's no-poll baseline: a national 2024 exit-poll vote split
 * for each demographic category, shifted by the active state's 2024
 * presidential lean and by the national move into the 2026 environment.
 *
 * This seeds the sliders for a state with no crosstab poll (or before one is
 * loaded), replacing the random placeholder so the projection starts from a
 * plausible result rather than noise. Loading a poll still overrides it.
 */

import {
  GENERIC_2026_D,
  NATIONAL_EXIT_SPLITS,
  PRES_2024_NATIONAL_D,
} from "../data/nationalDemographics";
import { STATE_LEAN } from "../data/stateLean";
import { DIMENSIONS } from "./analyzer";
import type { Split, Splits } from "./analyzer";

/**
 * National 2024-to-2026 environment shift, in percentage points. The baseline
 * is a 2024 vote result shown in a 2026 race; this matches the generic-ballot
 * move build-party.mjs applies to party ID.
 */
const ENV_SHIFT = (GENERIC_2026_D - PRES_2024_NATIONAL_D) * 100;

/** A category's national two-way D/R split, percent, with no other share. */
function nationalSplit(d: number, r: number): Split {
  const total = d + r;
  const dd = total > 0 ? (d / total) * 100 : 50;
  return { d: dd, r: 100 - dd, o: 0 };
}

/** Shift a split by `points` toward the Democrats, clamping and keeping o=0. */
function shiftSplit(split: Split, points: number): Split {
  const d = Math.max(0, Math.min(100, split.d + points));
  return { d: Math.round(d * 10) / 10, r: Math.round((100 - d) * 10) / 10, o: 0 };
}

/** Every category split shifted by the same number of points. */
function shiftSplits(base: Splits, points: number): Splits {
  const result = {} as Splits;
  for (const dimension of DIMENSIONS) {
    result[dimension.id] = {};
    for (const category of dimension.categories) {
      const split = base[dimension.id][category.id];
      if (split) result[dimension.id][category.id] = shiftSplit(split, points);
    }
  }
  return result;
}

/** The national baseline splits, before any state lean is applied. */
export function nationalBaselineSplits(): Splits {
  const base = {} as Splits;
  for (const dimension of DIMENSIONS) {
    base[dimension.id] = {};
    for (const category of dimension.categories) {
      const split = NATIONAL_EXIT_SPLITS[dimension.id]?.[category.id];
      if (split) base[dimension.id][category.id] = nationalSplit(split.d, split.r);
    }
  }
  return shiftSplits(base, 0);
}

/**
 * The baseline splits for a state: the national exit-poll splits shifted by the
 * state's 2024 presidential lean (relative to the nation) and the national move
 * to the 2026 environment. An unknown state falls back to the plain national
 * baseline.
 */
export function baselineSplitsForState(fips: string): Splits {
  const lean = STATE_LEAN[fips] ?? 0;
  return shiftSplits(nationalBaselineSplits(), lean * 100 + ENV_SHIFT);
}
