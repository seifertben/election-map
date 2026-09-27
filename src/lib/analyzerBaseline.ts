/**
 * The State Analyzer's no-poll baseline.
 *
 * For sex, age, race and education the baseline is a per-state estimate: each
 * group's Democratic two-party 2024 share is fit by ridge ecological regression
 * of the state's district-level presidential results on its ACS composition,
 * partially pooled toward the national exit-poll pattern and recentered so the
 * state result matches its actual 2024 vote (scripts/build-state-splits.mjs).
 * This replaces the older one-parameter model, which translated the national
 * exit-poll split for every group by the same state lean and so could only ever
 * reproduce the state top-line, never the within-state spread.
 *
 * Party ID is not fit: the map has no independent measure of how
 * party-identified groups voted, and the national party-vote split is stable, so
 * it keeps the national exit-poll split shifted by the state's 2024 presidential
 * lean. Every dimension then gets the national move into the 2026 environment.
 *
 * This seeds the sliders for a state with no crosstab poll (or before one is
 * loaded). Loading a poll still overrides it.
 */

import {
  GENERIC_2026_D,
  NATIONAL_EXIT_SPLITS,
  PRES_2024_NATIONAL_D,
} from "../data/nationalDemographics";
import { STATE_LEAN } from "../data/stateLean";
import { STATE_SPLITS } from "../data/stateSplits";
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
  const d = Math.round(Math.max(0, Math.min(100, split.d + points)) * 10) / 10;
  return { d, r: Math.round((100 - d) * 10) / 10, o: 0 };
}

/** Every category split shifted by the same number of points. */
function shiftSplits(base: Splits, points: number): Splits {
  const result = {} as Splits;
  for (const dimension of DIMENSIONS) {
    result[dimension.id] = {};
    for (const category of dimension.categories) {
      const split = base[dimension.id]?.[category.id];
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
 * The baseline splits for a state. Sex, age, race and education use the fitted
 * per-state group shares when available (a 2024 result), shifted into the 2026
 * environment; every other dimension, including Party ID, uses the national
 * exit-poll split shifted by the state's 2024 presidential lean and the same
 * environment move. An unknown state falls back to the plain national baseline.
 */
export function baselineSplitsForState(fips: string): Splits {
  const lean = STATE_LEAN[fips] ?? 0;
  const base = nationalBaselineSplits();
  const stateSplits = STATE_SPLITS[fips];
  const result = {} as Splits;
  for (const dimension of DIMENSIONS) {
    result[dimension.id] = {};
    for (const category of dimension.categories) {
      const modeled = stateSplits?.[dimension.id]?.[category.id];
      if (modeled !== undefined) {
        // The fitted share already carries the state's lean, so it only needs
        // the national environment move.
        const split: Split = {
          d: modeled * 100,
          r: (1 - modeled) * 100,
          o: 0,
        };
        result[dimension.id][category.id] = shiftSplit(split, ENV_SHIFT);
        continue;
      }
      const split = base[dimension.id]?.[category.id];
      if (split) {
        result[dimension.id][category.id] = shiftSplit(
          split,
          lean * 100 + ENV_SHIFT,
        );
      }
    }
  }
  return result;
}
