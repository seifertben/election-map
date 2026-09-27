import type { DimensionId } from "../lib/analyzer";

/**
 * National 2024 presidential exit-poll vote splits (Democratic / Republican,
 * percent), used as the State Analyzer's no-poll baseline before each state's
 * partisan lean is applied.
 *
 * Source: Roper Center, "How Groups Voted in 2024" (from the CBS News national
 * exit poll, Edison Research), https://ropercenter.cornell.edu/how-groups-voted-2024,
 * except Education, which is the exit poll's binary college / non-college split
 * (College degree 56/42, No college degree 43/56) spread over the analyzer's
 * three non-college bands — matching how the poll crosstab mapper collapses the
 * same bands. Third-party and rounding remainders are dropped; the analyzer
 * normalizes each pair to a two-way D/R split.
 */
export const NATIONAL_EXIT_SPLITS: Record<
  DimensionId,
  Record<string, { d: number; r: number }>
> = {
  sex: {
    male: { d: 43, r: 55 },
    female: { d: 53, r: 45 },
  },
  age: {
    "18-29": { d: 54, r: 43 },
    "30-44": { d: 51, r: 47 },
    "45-64": { d: 44, r: 54 },
    "65+": { d: 49, r: 50 },
  },
  race: {
    white: { d: 42, r: 57 },
    black: { d: 86, r: 13 },
    hispanic: { d: 51, r: 46 },
    asian: { d: 55, r: 40 },
    other: { d: 41, r: 55 },
  },
  education: {
    "no-hs": { d: 43, r: 56 },
    hs: { d: 43, r: 56 },
    "some-college": { d: 43, r: 56 },
    "bachelors-plus": { d: 56, r: 42 },
  },
  party: {
    democrat: { d: 95, r: 4 },
    republican: { d: 5, r: 94 },
    independent: { d: 49, r: 46 },
  },
};

/**
 * National 2024 two-party presidential Democratic share: Harris 75,017,613 of
 * the 152,320,193 two-party votes (mirrors build-party.mjs and
 * build-state-lean.mjs).
 */
export const PRES_2024_NATIONAL_D = 0.4925;

/**
 * Silver Bulletin's 2026 generic congressional ballot average, D+7.5 as of
 * 2026-09-21, i.e. a 53.75% Democratic two-party share. The baseline is a 2024
 * result shown in a 2026 race, so the same national environment shift applied
 * to party ID in build-party.mjs anchors the no-poll baseline here. Sex, age,
 * race and education move by their own subgroup swings around this topline
 * (`nationalSwing.ts`); Party ID keeps the uniform shift.
 */
export const GENERIC_2026_D = 0.5375;
