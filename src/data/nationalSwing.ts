import { DIMENSIONS } from "../lib/analyzer";
import type { DimensionId } from "../lib/analyzer";
import {
  GENERIC_2026_D,
  NATIONAL_EXIT_SPLITS,
  PRES_2024_NATIONAL_D,
} from "./nationalDemographics";

/**
 * National 2024-to-2026 demographic swing for the State Analyzer's no-poll
 * baseline, in percentage points of the Democratic two-party vote share.
 *
 * The baseline for sex, age, race and education is a 2024 estimate (per-state
 * ecological regression, `stateSplits.ts`; the national fallback is the exit
 * poll). Until now every category was moved into the 2026 environment by one
 * uniform national shift — the Silver Bulletin generic-ballot move. That could
 * not represent the composition of the 2026 swing: the crosstabs below show
 * Democrats recovering among Hispanic and Asian voters and losing ground among
 * seniors and men, all under the same national top line. This table lets the
 * swing vary by category.
 *
 * Derivation. Let poll26(g) and exit24(g) be group g's Democratic two-party
 * share in the 2026 national generic ballot and the 2024 national exit poll.
 * The differential swing — how much further a group moved than the country —
 * is poll26(g) - poll26(overall) minus exit24(g) - exit24(overall). Adding the
 * uniform environment shift (ENV_SHIFT) anchors the topline to the Silver
 * Bulletin average while letting the groups move differentially:
 *
 *   swing(g) = ENV_SHIFT
 *            + [poll26(g) - poll26(overall)]
 *            - [exit24(g) - exit24(overall)]
 *
 * A category the poll did not break out keeps the uniform ENV_SHIFT (not a
 * differential), since no 2026 measurement of it exists.
 *
 * Sources:
 *   - 2026: USPollingData, "Demographic Crosstabs 2026"
 *     (https://uspollingdata.com/polls/demographic-crosstabs), a national
 *     generic-congressional-ballot crosstab aggregated from April 2026 Pew,
 *     NYT/Siena, Quinnipiac and Fox News polling. Topline 49.3% D / 41.9% R.
 *     Values are transcribed by hand into the analyzer's bands, mirroring the
 *     poll mapper in `analyzerPolls.ts`: the poll's binary "College degree+ /
 *     No college degree" split fills bachelors-plus and the three non-college
 *     bands, with "Some college, no degree" refining the some-college band. The
 *     poll reports no "Other race" column, so that category keeps ENV_SHIFT.
 *   - 2024: NATIONAL_EXIT_SPLITS (Roper Center / CBS News-Edison).
 *
 * Party ID is absent by design. The 2024 exit poll's party-vote split and a
 * 2026 party-identification crosstab measure different things, so Party ID
 * keeps the uniform shift of `analyzerBaseline.ts` (and `build-party.mjs`).
 */

/** The 2026 national generic-ballot crosstab, in the analyzer's categories. */
const POLL_2026: Record<DimensionId, Record<string, { d: number; r: number }>> = {
  sex: {
    male: { d: 43, r: 51 },
    female: { d: 57, r: 39 },
  },
  age: {
    "18-29": { d: 59, r: 37 },
    "30-44": { d: 51, r: 46 },
    "45-64": { d: 46, r: 50 },
    "65+": { d: 47, r: 50 },
  },
  race: {
    white: { d: 40, r: 56 },
    black: { d: 82, r: 14 },
    hispanic: { d: 56, r: 38 },
    asian: { d: 60, r: 34 },
    // No "Other race" column; the category keeps the uniform shift.
  },
  education: {
    "bachelors-plus": { d: 57, r: 41 },
    "some-college": { d: 46, r: 50 },
    hs: { d: 43, r: 53 },
    "no-hs": { d: 43, r: 53 },
  },
  party: {},
};

/** The crosstab's full-sample generic-ballot result. */
const POLL_2026_OVERALL = { d: 49.3, r: 41.9 };

/** The uniform national environment shift, matching `analyzerBaseline.ts`. */
export const NATIONAL_ENV_SHIFT = (GENERIC_2026_D - PRES_2024_NATIONAL_D) * 100;

/** Democratic share of the two-party vote, percent. */
function twoPartyD(split: { d: number; r: number }): number {
  const total = split.d + split.r;
  return total > 0 ? (split.d / total) * 100 : 50;
}

const POLL_OVERALL_D = twoPartyD(POLL_2026_OVERALL);
const EXIT_OVERALL_D = PRES_2024_NATIONAL_D * 100;

const round1 = (x: number) => Math.round(x * 10) / 10;

function buildSwing(): Partial<Record<DimensionId, Record<string, number>>> {
  const result: Partial<Record<DimensionId, Record<string, number>>> = {};
  for (const dimension of DIMENSIONS) {
    const swing: Record<string, number> = {};
    for (const category of dimension.categories) {
      const poll = POLL_2026[dimension.id]?.[category.id];
      const exit = NATIONAL_EXIT_SPLITS[dimension.id]?.[category.id];
      if (!poll || !exit) {
        // No 2026 measurement for this category: stay on the uniform shift.
        swing[category.id] = round1(NATIONAL_ENV_SHIFT);
        continue;
      }
      const differential =
        (twoPartyD(poll) - POLL_OVERALL_D) - (twoPartyD(exit) - EXIT_OVERALL_D);
      swing[category.id] = round1(NATIONAL_ENV_SHIFT + differential);
    }
    result[dimension.id] = swing;
  }
  return result;
}

export const NATIONAL_SWING_2026: Partial<
  Record<DimensionId, Record<string, number>>
> = buildSwing();
