/**
 * Hand-curated demographic crosstabs for the State Analyzer's "Load a poll"
 * dropdown.
 *
 * Every number below is transcribed from the source files committed under
 * `crosstabs/`. These pages reject automated requests (and the JPEG/PDF sources
 * are not machine-readable tables), so the values are read out by hand and
 * committed rather than scraped at build time, matching the repo's
 * hermetic-data convention. Re-run only by re-reading the source pages.
 *
 * Sources:
 *   - NYT/Siena "Cross-Tabs: June 2026 Times/Siena Polls of Likely Voters in
 *     Battleground Senate Races" (times-siena-{alaska,iowa,north-carolina,ohio,
 *     texas}-poll-crosstabs.html) and the Times/Portland Press Herald/Siena
 *     Maine page (times-pph-siena-maine-poll-crosstabs.html). Each page's
 *     "Combined Senate ballot" and governor ballot tables were read, along with
 *     the "Percentage of total electorate" row. Field dates: AK/IA/NC/TX Jun
 *     15-27/29, ME Jun 19-26, OH Jun 15-28.
 *   - InsiderAdvantage Senate surveys (michigan.jpg, nh_senate.jpg,
 *     north_carolina.jpg, ohio.jpg, texas.jpg, IA_FLPOLL_SEP21-1-2048x1539.jpg
 *     — the latter is actually Florida). Gender / Race / Age / Party tables,
 *     1,200 likely voters (600 in Florida).
 *   - YouGov crosstab books (ttw_ga_20260915.pdf, ttw_nc_20260915.pdf),
 *     September 15-18, 2026, for the Georgia and North Carolina Senate races
 *     (Georgia also has a governor ballot). The Iowa book
 *     (iowa_election_20260903.pdf) is a toplines-only document with no
 *     vote-by-demographic table, so it is not represented here.
 *
 * Caveats:
 *   - Polls report a binary education split (B.A.+ / No B.A.); the three
 *     non-college census bands inherit the "No B.A." result. InsiderAdvantage
 *     and YouGov do not break education out of the vote at all.
 *   - Race columns vary by poll. Groups a poll did not break out inherit its
 *     broadest non-white column (e.g. "Other non-white"), so Asian and Other
 *     are approximate outside the states that report them.
 *   - InsiderAdvantage reports age as three bands (18-39 / 40-64 / 65+); both
 *     18-29 and 30-44 inherit the 18-39 result, and the electorate share is
 *     split across those two bands by census. ReconMR-style band remapping is
 *     not needed here.
 *   - Vote shares are rounded to whole (or tenth) percents, so d + r may not
 *     total 100. Third-party and undecided rows are omitted from the source and
 *     folded into the analyzer's Other share, leaving each split at 100.
 *   - The June NYT/Siena book is a Senate and Governor poll; no crosstab exists
 *     for the House races. The analyzer may still apply a poll to another race
 *     in the same state as an extrapolation, flagging it in the UI.
 */

export interface CrosstabSplit {
  d: number;
  r: number;
}

/** One "share of the electorate" row as reported by the poll. */
export interface PollDemographic {
  group: "sex" | "age" | "race" | "education" | "party";
  /** Label as printed by the poll, e.g. "Men", "B.A.+", "Other non-white". */
  label: string;
  /** Share of the poll's likely electorate, percent. */
  pct: number;
}

export interface PollCrosstab {
  /** Full-sample result, used for any category the poll did not break out. */
  overall: CrosstabSplit;
  sex: Record<string, CrosstabSplit>;
  age: Record<string, CrosstabSplit>;
  race: Record<string, CrosstabSplit>;
  education: Record<string, CrosstabSplit>;
  /** Party ID (Dem/Rep/Ind incl. leaners); empty when the poll omits it. */
  party: Record<string, CrosstabSplit>;
  /** Share of the electorate, as printed under "Percentage of total electorate". */
  composition: PollDemographic[];
}

export interface AnalyzerPoll {
  id: string;
  /** Dropdown label, including the field dates. */
  label: string;
  pollster: string;
  /** Last day in the field, ISO YYYY-MM-DD. */
  date: string;
  source: string;
  /** The race the crosstabs were published for. Applying it to another race
   *  in the same state is an extrapolation flagged by the analyzer. */
  election: "senate" | "governor" | "house";
  /** Crosstabs keyed by the two-digit state FIPS code used by states.json. */
  states: Record<string, PollCrosstab>;
}

const s = (d: number, r: number): CrosstabSplit => ({ d, r });

/** The poll's binary education split, spread over the census bands. */
const edu = (
  baD: number,
  baR: number,
  noBaD: number,
  noBaR: number,
): Record<string, CrosstabSplit> => ({
  "no-hs": s(noBaD, noBaR),
  hs: s(noBaD, noBaR),
  "some-college": s(noBaD, noBaR),
  "bachelors-plus": s(baD, baR),
});

/** InsiderAdvantage's three age bands mapped onto the analyzer's four; the
 *  18-39 result fills both 18-29 and 30-44. */
const age3 = (
  loD: number,
  loR: number,
  midD: number,
  midR: number,
  hiD: number,
  hiR: number,
): Record<string, CrosstabSplit> => ({
  "18-29": s(loD, loR),
  "30-44": s(loD, loR),
  "45-64": s(midD, midR),
  "65+": s(hiD, hiR),
});

const NYT_SIENA_ID = "nyt-siena-2026-06-29";
const NYT_SIENA_GOV_ID = "nyt-siena-2026-06-29-gov";
const INSIDER_EARLY_ID = "insideradvantage-2026-09-09";
const INSIDER_MID_ID = "insideradvantage-2026-09-17";
const INSIDER_LATE_ID = "insideradvantage-2026-09-21";
const YOUGOV_ID = "yougov-2026-09-18";
const YOUGOV_GOV_ID = "yougov-2026-09-18-gov";

/** The June NYT/Siena "Percentage of total electorate" rows shared by a state's
 *  Senate and governor tables. */
const NYT_COMPOSITION: Record<string, PollDemographic[]> = {
  // Alaska.
  "02": [
    { group: "sex", label: "Men", pct: 49 },
    { group: "sex", label: "Women", pct: 50 },
    { group: "age", label: "18-29", pct: 9 },
    { group: "age", label: "30-44", pct: 22 },
    { group: "age", label: "45-64", pct: 31 },
    { group: "age", label: "65+", pct: 34 },
    { group: "race", label: "White", pct: 71 },
    { group: "race", label: "Alaska Native/ Native American", pct: 10 },
    { group: "race", label: "Other non-white", pct: 15 },
    { group: "education", label: "B.A.+", pct: 38 },
    { group: "education", label: "No B.A.", pct: 62 },
    { group: "party", label: "Democrat", pct: 14 },
    { group: "party", label: "Republican", pct: 29 },
    { group: "party", label: "Independent", pct: 44 },
  ],
  // Iowa.
  "19": [
    { group: "sex", label: "Men", pct: 47 },
    { group: "sex", label: "Women", pct: 53 },
    { group: "age", label: "18-29", pct: 12 },
    { group: "age", label: "30-44", pct: 20 },
    { group: "age", label: "45-64", pct: 32 },
    { group: "age", label: "65+", pct: 33 },
    { group: "race", label: "White", pct: 90 },
    { group: "race", label: "Non-white", pct: 8 },
    { group: "education", label: "B.A.+", pct: 34 },
    { group: "education", label: "No B.A.", pct: 65 },
    { group: "party", label: "Democrat", pct: 27 },
    { group: "party", label: "Republican", pct: 33 },
    { group: "party", label: "Independent", pct: 36 },
  ],
  // Maine.
  "23": [
    { group: "sex", label: "Men", pct: 48 },
    { group: "sex", label: "Women", pct: 51 },
    { group: "age", label: "18-29", pct: 8 },
    { group: "age", label: "30-44", pct: 19 },
    { group: "age", label: "45-64", pct: 32 },
    { group: "age", label: "65+", pct: 39 },
    { group: "race", label: "White", pct: 91 },
    { group: "race", label: "Other non-white", pct: 7 },
    { group: "education", label: "B.A.+", pct: 41 },
    { group: "education", label: "No B.A.", pct: 59 },
    { group: "party", label: "Democrat", pct: 33 },
    { group: "party", label: "Republican", pct: 27 },
    { group: "party", label: "Independent", pct: 35 },
  ],
  // North Carolina.
  "37": [
    { group: "sex", label: "Men", pct: 45 },
    { group: "sex", label: "Women", pct: 54 },
    { group: "age", label: "18-29", pct: 12 },
    { group: "age", label: "30-44", pct: 20 },
    { group: "age", label: "45-64", pct: 33 },
    { group: "age", label: "65+", pct: 32 },
    { group: "race", label: "White", pct: 69 },
    { group: "race", label: "Black", pct: 18 },
    { group: "race", label: "Other non-white", pct: 10 },
    { group: "education", label: "B.A.+", pct: 43 },
    { group: "education", label: "No B.A.", pct: 55 },
    { group: "party", label: "Democrat", pct: 31 },
    { group: "party", label: "Republican", pct: 31 },
    { group: "party", label: "Independent", pct: 33 },
  ],
  // Ohio.
  "39": [
    { group: "sex", label: "Men", pct: 48 },
    { group: "sex", label: "Women", pct: 51 },
    { group: "age", label: "18-29", pct: 10 },
    { group: "age", label: "30-44", pct: 19 },
    { group: "age", label: "45-64", pct: 34 },
    { group: "age", label: "65+", pct: 33 },
    { group: "race", label: "White", pct: 77 },
    { group: "race", label: "Black", pct: 11 },
    { group: "race", label: "Other non-white", pct: 7 },
    { group: "education", label: "B.A.+", pct: 37 },
    { group: "education", label: "No B.A.", pct: 62 },
    { group: "party", label: "Democrat", pct: 29 },
    { group: "party", label: "Republican", pct: 41 },
    { group: "party", label: "Independent", pct: 27 },
  ],
  // Texas.
  "48": [
    { group: "sex", label: "Men", pct: 45 },
    { group: "sex", label: "Women", pct: 54 },
    { group: "age", label: "18-29", pct: 11 },
    { group: "age", label: "30-44", pct: 22 },
    { group: "age", label: "45-64", pct: 34 },
    { group: "age", label: "65+", pct: 30 },
    { group: "race", label: "White", pct: 59 },
    { group: "race", label: "Black", pct: 12 },
    { group: "race", label: "Hispanic", pct: 20 },
    // "Non-white" is the total, so the mapper keeps only the remainder after
    // the listed Black and Hispanic shares.
    { group: "race", label: "Non-white", pct: 38 },
    { group: "education", label: "B.A.+", pct: 43 },
    { group: "education", label: "No B.A.", pct: 56 },
    { group: "party", label: "Democrat", pct: 30 },
    { group: "party", label: "Republican", pct: 39 },
    { group: "party", label: "Independent", pct: 25 },
  ],
};

export const ANALYZER_POLLS: AnalyzerPoll[] = [
  {
    id: NYT_SIENA_ID,
    label: "NYT/Siena — June 15–29, 2026 (Senate)",
    pollster: "New York Times/Siena College",
    date: "2026-06-29",
    source:
      "https://www.nytimes.com/interactive/2026/07/01/polls/times-siena-battleground-poll-crosstabs.html",
    election: "senate",
    states: {
      // Alaska — Peltola (D) 45 / Sullivan (R) 47.
      "02": {
        overall: s(45, 47),
        sex: { male: s(37, 56), female: s(53, 39) },
        age: {
          "18-29": s(47, 49),
          "30-44": s(49, 38),
          "45-64": s(41, 53),
          "65+": s(45, 48),
        },
        // Race curve: White, Alaska Native/Native American, Other non-white.
        race: {
          white: s(44, 50),
          other: s(51, 32),
          black: s(50, 42),
          hispanic: s(50, 42),
          asian: s(50, 42),
        },
        education: edu(58, 37, 37, 54),
        party: { democrat: s(93, 5), republican: s(6, 93), independent: s(54, 38) },
        composition: NYT_COMPOSITION["02"],
      },
      // Iowa — Turek (D) 46 / Hinson (R) 48.
      "19": {
        overall: s(46, 48),
        sex: { male: s(37, 56), female: s(54, 42) },
        age: {
          "18-29": s(59, 35),
          "30-44": s(44, 48),
          "45-64": s(42, 55),
          "65+": s(47, 49),
        },
        race: {
          white: s(45, 50),
          black: s(62, 24),
          hispanic: s(62, 24),
          asian: s(62, 24),
          other: s(62, 24),
        },
        education: edu(54, 38, 42, 54),
        party: { democrat: s(98, 1), republican: s(3, 95), independent: s(48, 42) },
        composition: NYT_COMPOSITION["19"],
      },
      // Maine — Platner (D) 49 / Collins (R) 47.
      "23": {
        overall: s(49, 47),
        sex: { male: s(45, 52), female: s(52, 44) },
        age: {
          "18-29": s(59, 32),
          "30-44": s(64, 33),
          "45-64": s(46, 53),
          "65+": s(44, 51),
        },
        race: {
          white: s(49, 48),
          black: s(60, 36),
          hispanic: s(60, 36),
          asian: s(60, 36),
          other: s(60, 36),
        },
        education: edu(66, 32, 37, 58),
        party: { democrat: s(88, 8), republican: s(2, 98), independent: s(51, 45) },
        composition: NYT_COMPOSITION["23"],
      },
      // North Carolina — Cooper (D) 50 / Whatley (R) 43.
      "37": {
        overall: s(50, 43),
        sex: { male: s(44, 49), female: s(54, 39) },
        age: {
          "18-29": s(54, 29),
          "30-44": s(59, 35),
          "45-64": s(47, 47),
          "65+": s(45, 50),
        },
        // Race curve: White, Black, Other non-white.
        race: {
          white: s(42, 53),
          black: s(88, 7),
          hispanic: s(44, 37),
          asian: s(44, 37),
          other: s(44, 37),
        },
        education: edu(59, 35, 43, 50),
        party: { democrat: s(96, 2), republican: s(4, 91), independent: s(52, 40) },
        composition: NYT_COMPOSITION["37"],
      },
      // Ohio — Brown (D) 47 / Husted (R) 50.
      "39": {
        overall: s(47, 50),
        sex: { male: s(39, 56), female: s(55, 44) },
        age: {
          "18-29": s(61, 36),
          "30-44": s(52, 41),
          "45-64": s(40, 58),
          "65+": s(49, 50),
        },
        race: {
          white: s(41, 56),
          black: s(90, 9),
          hispanic: s(61, 36),
          asian: s(61, 36),
          other: s(61, 36),
        },
        education: edu(57, 40, 41, 56),
        party: { democrat: s(96, 2), republican: s(5, 95), independent: s(58, 36) },
        composition: NYT_COMPOSITION["39"],
      },
      // Texas — Talarico (D) 47 / Paxton (R) 47.
      "48": {
        overall: s(47, 47),
        sex: { male: s(36, 57), female: s(56, 38) },
        age: {
          "18-29": s(62, 32),
          "30-44": s(53, 38),
          "45-64": s(44, 52),
          "65+": s(41, 53),
        },
        // Race curve: White, Black, Hispanic, Non-white. Asian and Other
        // inherit the Non-white column.
        race: {
          white: s(37, 59),
          black: s(80, 13),
          hispanic: s(61, 29),
          asian: s(64, 27),
          other: s(64, 27),
        },
        education: edu(53, 42, 42, 50),
        party: { democrat: s(94, 3), republican: s(5, 91), independent: s(58, 31) },
        composition: NYT_COMPOSITION["48"],
      },
    },
  },
  {
    id: NYT_SIENA_GOV_ID,
    label: "NYT/Siena — June 15–29, 2026 (Governor)",
    pollster: "New York Times/Siena College",
    date: "2026-06-29",
    source:
      "https://www.nytimes.com/interactive/2026/07/01/polls/times-siena-battleground-poll-crosstabs.html",
    election: "governor",
    states: {
      // Iowa — Sand (D) 48 / Lahn (R) 47.
      "19": {
        overall: s(48, 47),
        sex: { male: s(40, 55), female: s(55, 39) },
        age: {
          "18-29": s(63, 32),
          "30-44": s(48, 47),
          "45-64": s(46, 50),
          "65+": s(44, 49),
        },
        race: {
          white: s(47, 48),
          black: s(71, 24),
          hispanic: s(71, 24),
          asian: s(71, 24),
          other: s(71, 24),
        },
        education: edu(58, 37, 43, 51),
        party: { democrat: s(96, 4), republican: s(6, 89), independent: s(53, 40) },
        composition: NYT_COMPOSITION["19"],
      },
      // Maine — Pingree (D) 55 / Charles (R) 40. The combined major-party
      // ballot (the third-party candidate dropped) is used for the split.
      "23": {
        overall: s(55, 40),
        sex: { male: s(49, 47), female: s(61, 33) },
        age: {
          "18-29": s(55, 33),
          "30-44": s(64, 33),
          "45-64": s(48, 48),
          "65+": s(59, 36),
        },
        race: {
          white: s(55, 41),
          black: s(61, 24),
          hispanic: s(61, 24),
          asian: s(61, 24),
          other: s(61, 24),
        },
        education: edu(69, 26, 46, 50),
        party: { democrat: s(99, 0), republican: s(3, 95), independent: s(58, 33) },
        composition: NYT_COMPOSITION["23"],
      },
      // Ohio — Acton (D) 47 / Ramaswamy (R) 47.
      "39": {
        overall: s(47, 47),
        sex: { male: s(39, 53), female: s(53, 41) },
        age: {
          "18-29": s(60, 36),
          "30-44": s(54, 36),
          "45-64": s(41, 52),
          "65+": s(46, 49),
        },
        race: {
          white: s(41, 52),
          black: s(89, 8),
          hispanic: s(53, 41),
          asian: s(53, 41),
          other: s(53, 41),
        },
        education: edu(59, 32, 39, 56),
        party: { democrat: s(93, 4), republican: s(6, 88), independent: s(59, 31) },
        composition: NYT_COMPOSITION["39"],
      },
      // Texas — Hinojosa (D) 44 / Abbott (R) 51.
      "48": {
        overall: s(44, 51),
        sex: { male: s(34, 60), female: s(53, 43) },
        age: {
          "18-29": s(63, 36),
          "30-44": s(52, 38),
          "45-64": s(39, 55),
          "65+": s(39, 60),
        },
        race: {
          white: s(35, 62),
          black: s(76, 18),
          hispanic: s(58, 37),
          asian: s(60, 34),
          other: s(60, 34),
        },
        education: edu(51, 44, 39, 56),
        party: { democrat: s(94, 5), republican: s(4, 94), independent: s(48, 41) },
        composition: NYT_COMPOSITION["48"],
      },
    },
  },
  {
    id: INSIDER_EARLY_ID,
    label: "InsiderAdvantage — Sept 8–9, 2026 (Senate)",
    pollster: "InsiderAdvantage",
    date: "2026-09-09",
    source: "https://insideradvantage.com/",
    election: "senate",
    states: {
      // Texas — Paxton (R) 45.6 / Talarico (D) 47.1 / Brown (L) 2.2.
      "48": {
        overall: s(47.1, 45.6),
        sex: { male: s(43.0, 50.2), female: s(50.7, 41.6) },
        age: age3(55.8, 32.7, 46.8, 45.9, 41.2, 54.5),
        race: {
          white: s(40.3, 53.8),
          black: s(85.6, 25.2),
          hispanic: s(55.3, 35.1),
          asian: s(35.0, 59.1),
          other: s(35.0, 59.1),
        },
        education: {},
        party: { democrat: s(93.5, 4.0), republican: s(9.2, 83.9), independent: s(48.0, 38.6) },
        composition: [
          { group: "sex", label: "Men", pct: 47 },
          { group: "sex", label: "Women", pct: 53 },
          { group: "age", label: "18-39", pct: 24 },
          { group: "age", label: "40-64", pct: 42 },
          { group: "age", label: "65+", pct: 34 },
          { group: "race", label: "White", pct: 57 },
          { group: "race", label: "African American", pct: 13 },
          { group: "race", label: "Hispanic", pct: 25 },
          { group: "race", label: "Another Race", pct: 5 },
          { group: "party", label: "Democrat", pct: 32 },
          { group: "party", label: "Republican", pct: 40 },
          { group: "party", label: "Independent", pct: 28 },
        ],
      },
      // Ohio — Brown (D) 47.3 / Husted (R) 41.9.
      "39": {
        overall: s(47.3, 41.9),
        sex: { male: s(41.6, 47.4), female: s(52.2, 36.9) },
        age: age3(44.8, 34.9, 46.7, 41.9, 48.9, 45.2),
        race: {
          white: s(44.6, 45.4),
          black: s(77.2, 16.0),
          hispanic: s(39.2, 60.5),
          asian: s(13.7, 41.8),
          other: s(13.7, 41.8),
        },
        education: {},
        party: { democrat: s(93.8, 2.0), republican: s(9.2, 80.0), independent: s(56.1, 29.5) },
        composition: [
          { group: "sex", label: "Men", pct: 47 },
          { group: "sex", label: "Women", pct: 53 },
          { group: "age", label: "18-39", pct: 20 },
          { group: "age", label: "40-64", pct: 40 },
          { group: "age", label: "65+", pct: 40 },
          { group: "race", label: "White", pct: 83 },
          { group: "race", label: "African American", pct: 12 },
          { group: "race", label: "Hispanic", pct: 1 },
          { group: "race", label: "Another Race", pct: 4 },
          { group: "party", label: "Democrat", pct: 28 },
          { group: "party", label: "Republican", pct: 40 },
          { group: "party", label: "Independent", pct: 30 },
        ],
      },
    },
  },
  {
    id: INSIDER_MID_ID,
    label: "InsiderAdvantage — Sept 16–17, 2026 (Senate)",
    pollster: "InsiderAdvantage",
    date: "2026-09-17",
    source: "https://insideradvantage.com/",
    election: "senate",
    states: {
      // North Carolina — Cooper (D) 48.4 / Whatley (R) 42.5.
      "37": {
        overall: s(48.4, 42.5),
        sex: { male: s(45.4, 47.9), female: s(51.2, 37.4) },
        age: age3(50.5, 28.5, 46.5, 46.8, 49.8, 48.2),
        race: {
          white: s(42.5, 48.9),
          black: s(72.5, 16.6),
          hispanic: s(43.5, 45.0),
          asian: s(50.9, 44.3),
          other: s(50.9, 44.3),
        },
        education: {},
        party: { democrat: s(86.3, 8.0), republican: s(6.0, 86.1), independent: s(53.7, 32.4) },
        composition: [
          { group: "sex", label: "Men", pct: 47 },
          { group: "sex", label: "Women", pct: 53 },
          { group: "age", label: "18-39", pct: 27 },
          { group: "age", label: "40-64", pct: 45 },
          { group: "age", label: "65+", pct: 28 },
          { group: "race", label: "White", pct: 69 },
          { group: "race", label: "African American", pct: 19 },
          { group: "race", label: "Hispanic", pct: 8 },
          { group: "race", label: "Another Race", pct: 4 },
          { group: "party", label: "Democrat", pct: 32 },
          { group: "party", label: "Republican", pct: 34 },
          { group: "party", label: "Independent", pct: 34 },
        ],
      },
      // New Hampshire — Pappas (D) 47.8 / Sununu (R) 39.9.
      "33": {
        overall: s(47.8, 39.9),
        sex: { male: s(40.5, 49.0), female: s(54.7, 31.2) },
        age: age3(49.4, 33.0, 44.5, 41.9, 50.7, 42.4),
        race: {
          white: s(48.9, 39.2),
          black: s(49.2, 43.4),
          hispanic: s(53.8, 20.8),
          asian: s(15.0, 72.8),
          other: s(15.0, 72.8),
        },
        education: {},
        party: { democrat: s(88.7, 9.2), republican: s(5.4, 81.6), independent: s(43.2, 35.1) },
        composition: [
          { group: "sex", label: "Men", pct: 49 },
          { group: "sex", label: "Women", pct: 51 },
          { group: "age", label: "18-39", pct: 24 },
          { group: "age", label: "40-64", pct: 42 },
          { group: "age", label: "65+", pct: 34 },
          { group: "race", label: "White", pct: 90 },
          { group: "race", label: "African American", pct: 2 },
          { group: "race", label: "Hispanic", pct: 4 },
          { group: "race", label: "Another Race", pct: 4 },
          { group: "party", label: "Democrat", pct: 34 },
          { group: "party", label: "Republican", pct: 32 },
          { group: "party", label: "Independent", pct: 34 },
        ],
      },
      // Michigan — El-Sayed (D) 46.6 / Rogers (R) 44.7. Race is reported as
      // White / African American / Other only.
      "26": {
        overall: s(46.6, 44.7),
        sex: { male: s(43.2, 47.7), female: s(49.7, 42.0) },
        age: age3(55.2, 33.0, 44.9, 46.4, 41.7, 52.3),
        race: {
          white: s(43.8, 48.3),
          black: s(60.5, 22.6),
          hispanic: s(56.0, 38.9),
          asian: s(56.0, 38.9),
          other: s(56.0, 38.9),
        },
        education: {},
        party: { democrat: s(89.2, 8.9), republican: s(6.8, 85.1), independent: s(40.1, 43.1) },
        composition: [
          { group: "sex", label: "Men", pct: 47 },
          { group: "sex", label: "Women", pct: 53 },
          { group: "age", label: "18-39", pct: 26 },
          { group: "age", label: "40-64", pct: 44 },
          { group: "age", label: "65+", pct: 30 },
          { group: "race", label: "White", pct: 81 },
          { group: "race", label: "African American", pct: 11 },
          // The poll's "Other" column is its broadest non-white group.
          { group: "race", label: "Other non-white", pct: 8 },
          { group: "party", label: "Democrat", pct: 35 },
          { group: "party", label: "Republican", pct: 34 },
          { group: "party", label: "Independent", pct: 31 },
        ],
      },
    },
  },
  {
    id: INSIDER_LATE_ID,
    label: "InsiderAdvantage — Sept 20–21, 2026 (Senate)",
    pollster: "InsiderAdvantage",
    date: "2026-09-21",
    source: "https://insideradvantage.com/",
    election: "senate",
    states: {
      // Florida — Moody (R) 49.3 / Nixon (D) 41.8.
      "12": {
        overall: s(41.8, 49.3),
        sex: { male: s(36.3, 53.3), female: s(46.8, 45.6) },
        age: age3(45.2, 40.1, 40.1, 48.5, 41.4, 57.3),
        race: {
          white: s(36.7, 53.6),
          black: s(47.2, 38.3),
          hispanic: s(52.3, 42.7),
          asian: s(45.2, 52.0),
          other: s(45.2, 52.0),
        },
        education: {},
        party: { democrat: s(88.1, 11.6), republican: s(5.7, 93.3), independent: s(47.1, 27.1) },
        composition: [
          { group: "sex", label: "Men", pct: 48 },
          { group: "sex", label: "Women", pct: 52 },
          { group: "age", label: "18-39", pct: 24 },
          { group: "age", label: "40-64", pct: 44 },
          { group: "age", label: "65+", pct: 32 },
          { group: "race", label: "White", pct: 62 },
          { group: "race", label: "African American", pct: 12 },
          { group: "race", label: "Hispanic", pct: 22 },
          { group: "race", label: "Another Race", pct: 4 },
          { group: "party", label: "Democrat", pct: 27 },
          { group: "party", label: "Republican", pct: 40 },
          { group: "party", label: "Independent", pct: 33 },
        ],
      },
    },
  },
  {
    id: YOUGOV_ID,
    label: "YouGov — Sept 15–18, 2026 (Senate)",
    pollster: "YouGov",
    date: "2026-09-18",
    source: "https://today.yougov.com/",
    election: "senate",
    states: {
      // Georgia — Ossoff (D) 51 / Collins (R) 41.
      "13": {
        overall: s(51, 41),
        sex: { male: s(49, 45), female: s(53, 38) },
        age: {
          "18-29": s(67, 24),
          "30-44": s(58, 32),
          "45-64": s(47, 46),
          "65+": s(42, 52),
        },
        race: {
          white: s(35, 57),
          black: s(83, 11),
          hispanic: s(55, 34),
          asian: s(52, 35),
          other: s(52, 35),
        },
        education: {},
        party: {},
        composition: [
          { group: "sex", label: "Men", pct: 45 },
          { group: "sex", label: "Women", pct: 54 },
          { group: "age", label: "18-29", pct: 15 },
          { group: "age", label: "30-44", pct: 24 },
          { group: "age", label: "45-64", pct: 35 },
          { group: "age", label: "65+", pct: 25 },
          { group: "race", label: "White", pct: 59 },
          { group: "race", label: "Black", pct: 29 },
          { group: "race", label: "Hispanic", pct: 5 },
          { group: "race", label: "Other", pct: 6 },
        ],
      },
      // North Carolina — Cooper (D) 52 / Whatley (R) 41.
      "37": {
        overall: s(52, 41),
        sex: { male: s(47, 45), female: s(57, 38) },
        age: {
          "18-29": s(62, 28),
          "30-44": s(61, 32),
          "45-64": s(47, 46),
          "65+": s(47, 47),
        },
        race: {
          white: s(44, 49),
          black: s(85, 8),
          hispanic: s(57, 32),
          asian: s(51, 40),
          other: s(51, 40),
        },
        education: {},
        party: {},
        composition: [
          { group: "sex", label: "Men", pct: 45 },
          { group: "sex", label: "Women", pct: 54 },
          { group: "age", label: "18-29", pct: 14 },
          { group: "age", label: "30-44", pct: 23 },
          { group: "age", label: "45-64", pct: 34 },
          { group: "age", label: "65+", pct: 29 },
          { group: "race", label: "White", pct: 72 },
          { group: "race", label: "Black", pct: 17 },
          { group: "race", label: "Hispanic", pct: 5 },
          { group: "race", label: "Other", pct: 6 },
        ],
      },
    },
  },
  {
    id: YOUGOV_GOV_ID,
    label: "YouGov — Sept 15–18, 2026 (Governor)",
    pollster: "YouGov",
    date: "2026-09-18",
    source: "https://today.yougov.com/",
    election: "governor",
    states: {
      // Georgia — Bottoms (D) 44 / Jackson (R) 45.
      "13": {
        overall: s(44, 45),
        sex: { male: s(40, 50), female: s(46, 42) },
        age: {
          "18-29": s(55, 33),
          "30-44": s(51, 33),
          "45-64": s(41, 50),
          "65+": s(33, 56),
        },
        race: {
          white: s(27, 62),
          black: s(76, 11),
          hispanic: s(51, 40),
          asian: s(45, 40),
          other: s(45, 40),
        },
        education: {},
        party: {},
        composition: [
          { group: "sex", label: "Men", pct: 45 },
          { group: "sex", label: "Women", pct: 54 },
          { group: "age", label: "18-29", pct: 15 },
          { group: "age", label: "30-44", pct: 24 },
          { group: "age", label: "45-64", pct: 35 },
          { group: "age", label: "65+", pct: 25 },
          { group: "race", label: "White", pct: 59 },
          { group: "race", label: "Black", pct: 29 },
          { group: "race", label: "Hispanic", pct: 5 },
          { group: "race", label: "Other", pct: 6 },
        ],
      },
    },
  },
];

export const ANALYZER_POLL_BY_ID: Record<string, AnalyzerPoll> =
  Object.fromEntries(ANALYZER_POLLS.map((poll) => [poll.id, poll]));
