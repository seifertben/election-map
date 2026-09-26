/**
 * Hand-curated demographic crosstabs for the State Analyzer's "Load a poll"
 * dropdown.
 *
 * Sources (New York Times / Siena College):
 *   - "Cross-Tabs: June 2026 Times/Siena Polls of Likely Voters in Battleground
 *     Senate Races", fielded June 15-29, 2026. Maine is the Times/Portland
 *     Press Herald/Siena poll fielded June 19-26. Each page's "Combined Senate
 *     ballot" table was read and its candidate rows mapped onto the analyzer's
 *     four dimensions.
 *   - "Cross-Tabs: September 2026 Times/Siena Polls of the Likely Electorate"
 *     in Maine, Michigan and New Hampshire, fielded September 15-22, 2026. Each
 *     state page's governor ballot table was read the same way.
 *   - ReconMR, "Texas Poll September Crosstabs", fielded September 8-11, 2026,
 *     for the Texas governor race. Its age bands differ from the analyzer's and
 *     are remapped (see the caveats below).
 *
 * These pages reject automated requests, so the numbers are transcribed by
 * hand and committed rather than scraped at build time, matching the repo's
 * hermetic-data convention. Re-run only by re-reading the source pages.
 *
 * Caveats:
 *   - Polls report a binary education split (B.A.+ / No B.A.); the three
 *     non-college census bands inherit the "No B.A." result.
 *   - Race groups vary by state. Groups the poll did not break out inherit its
 *     broadest non-white column, so Asian and Other are approximate outside
 *     Texas, and Black is approximate in Alaska, Iowa and Maine.
 *   - Vote shares are rounded to whole percents, so d + r may not total 100.
 *   - The June poll is a Senate poll and the September poll is a Governor poll;
 *     no crosstab exists for the House races. The analyzer may still apply a
 *     poll to another race in the same state as an extrapolation, flagging it
 *     in the UI; the crosstabs then describe that race's electorate only by
 *     proxy.
 *   - The September governor poll breaks race out only as White / Other
 *     non-white (Maine), White / Black / Other non-white (Michigan) and White /
 *     Non-white (New Hampshire), so the remaining race groups are approximate.
 *   - Maine's governor ballot includes a third-party candidate; its topline and
 *     splits are the multi-candidate result, so d + r falls well short of 100.
 *   - The ReconMR Texas poll reports age as 18-34 / 35-49 / 50-64 / 65+, which
 *     is mapped onto the analyzer's 18-29 / 30-44 / 45-64 / 65+ bands, and race
 *     only as White / Black / Hispanic, so Asian and Other inherit the topline.
 */

export interface CrosstabSplit {
  d: number;
  r: number;
}

/** One "share of the electorate" row as reported by the poll. */
export interface PollDemographic {
  group: "sex" | "age" | "race" | "education";
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

const NYT_SIENA_ID = "nyt-siena-2026-06-29";
const NYT_SIENA_GOV_ID = "nyt-siena-2026-09-22";
const RECONMR_TX_GOV_ID = "reconmr-texas-2026-09-11";

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
          black: s(50, 42),
          hispanic: s(50, 42),
          asian: s(50, 42),
          other: s(50, 42),
        },
        education: edu(58, 37, 37, 54),
        composition: [
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
        ],
      },
      // Iowa — D 46 / R 48.
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
        composition: [
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
        ],
      },
      // Maine — D 49 / R 47.
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
        composition: [
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
        ],
      },
      // North Carolina — D 50 / R 43.
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
        composition: [
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
        ],
      },
      // Ohio — D 47 / R 50.
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
        composition: [
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
        ],
      },
      // Texas — D 47 / R 47.
      "48": {
        overall: s(47, 47),
        sex: { male: s(36, 57), female: s(56, 38) },
        age: {
          "18-29": s(62, 32),
          "30-44": s(53, 38),
          "45-64": s(44, 52),
          "65+": s(41, 53),
        },
        // Race curve: White, Black, Hispanic, Non-white.
        race: {
          white: s(37, 59),
          black: s(80, 13),
          hispanic: s(61, 29),
          asian: s(64, 27),
          other: s(64, 27),
        },
        education: edu(53, 42, 42, 50),
        composition: [
          { group: "sex", label: "Men", pct: 45 },
          { group: "sex", label: "Women", pct: 54 },
          { group: "age", label: "18-29", pct: 11 },
          { group: "age", label: "30-44", pct: 22 },
          { group: "age", label: "45-64", pct: 34 },
          { group: "age", label: "65+", pct: 30 },
          { group: "race", label: "White", pct: 59 },
          { group: "race", label: "Black", pct: 12 },
          { group: "race", label: "Hispanic", pct: 20 },
          // "Non-white" is the total, so the mapper keeps only the remainder
          // after the listed Black and Hispanic shares.
          { group: "race", label: "Non-white", pct: 38 },
          { group: "education", label: "B.A.+", pct: 43 },
          { group: "education", label: "No B.A.", pct: 56 },
        ],
      },
    },
  },
  {
    id: NYT_SIENA_GOV_ID,
    label: "NYT/Siena — Sept 15–22, 2026 (Governor)",
    pollster: "New York Times/Siena College",
    date: "2026-09-22",
    source:
      "https://www.nytimes.com/interactive/2026/09/24/polls/times-siena-poll-crosstabs.html",
    election: "governor",
    states: {
      // Maine — Pingree (D) 47 / Charles (R) 34 / Bennett (I) 8.
      "23": {
        overall: s(47, 34),
        sex: { male: s(40, 41), female: s(54, 28) },
        age: {
          "18-29": s(43, 34),
          "30-44": s(53, 29),
          "45-64": s(40, 42),
          "65+": s(52, 31),
        },
        // Race curve: White, Other non-white. The other groups are folded into
        // the "Other non-white" column.
        race: {
          white: s(47, 36),
          black: s(29, 27),
          hispanic: s(29, 27),
          asian: s(29, 27),
          other: s(29, 27),
        },
        education: edu(63, 23, 36, 42),
        composition: [
          { group: "sex", label: "Men", pct: 50 },
          { group: "sex", label: "Women", pct: 49 },
          { group: "age", label: "18-29", pct: 10 },
          { group: "age", label: "30-44", pct: 19 },
          { group: "age", label: "45-64", pct: 32 },
          { group: "age", label: "65+", pct: 37 },
          { group: "race", label: "White", pct: 91 },
          { group: "race", label: "Other non-white", pct: 4 },
          { group: "education", label: "B.A.+", pct: 40 },
          { group: "education", label: "No B.A.", pct: 59 },
        ],
      },
      // Michigan — Benson (D) 48 / James (R) 43.
      "26": {
        overall: s(48, 43),
        sex: { male: s(41, 50), female: s(54, 38) },
        age: {
          "18-29": s(60, 16),
          "30-44": s(50, 37),
          "45-64": s(43, 51),
          "65+": s(51, 47),
        },
        // Race curve: White, Black, Other non-white. Hispanic and Asian are
        // folded into the "Other non-white" column.
        race: {
          white: s(45, 48),
          black: s(92, 1),
          hispanic: s(48, 35),
          asian: s(48, 35),
          other: s(48, 35),
        },
        education: edu(59, 34, 43, 47),
        composition: [
          { group: "sex", label: "Men", pct: 46 },
          { group: "sex", label: "Women", pct: 53 },
          { group: "age", label: "18-29", pct: 12 },
          { group: "age", label: "30-44", pct: 21 },
          { group: "age", label: "45-64", pct: 33 },
          { group: "age", label: "65+", pct: 32 },
          { group: "race", label: "White", pct: 76 },
          { group: "race", label: "Black", pct: 10 },
          { group: "race", label: "Other non-white", pct: 10 },
          { group: "education", label: "B.A.+", pct: 36 },
          { group: "education", label: "No B.A.", pct: 63 },
        ],
      },
      // New Hampshire — Warmington (D) 41 / Ayotte (R) 52.
      "33": {
        overall: s(41, 52),
        sex: { male: s(30, 61), female: s(51, 44) },
        age: {
          "18-29": s(31, 57),
          "30-44": s(45, 46),
          "45-64": s(39, 56),
          "65+": s(43, 51),
        },
        // Race curve: White, Non-white. "Non-white" is the total, so the
        // unlisted groups inherit it and its remainder is spread by census.
        race: {
          white: s(42, 52),
          black: s(35, 53),
          hispanic: s(35, 53),
          asian: s(35, 53),
          other: s(35, 53),
        },
        education: edu(49, 45, 35, 58),
        composition: [
          { group: "sex", label: "Men", pct: 47 },
          { group: "sex", label: "Women", pct: 52 },
          { group: "age", label: "18-29", pct: 9 },
          { group: "age", label: "30-44", pct: 17 },
          { group: "age", label: "45-64", pct: 35 },
          { group: "age", label: "65+", pct: 36 },
          { group: "race", label: "White", pct: 90 },
          { group: "race", label: "Non-white", pct: 7 },
          { group: "education", label: "B.A.+", pct: 45 },
          { group: "education", label: "No B.A.", pct: 55 },
        ],
      },
    },
  },
  {
    id: RECONMR_TX_GOV_ID,
    label: "ReconMR — Sept 8–11, 2026 (Governor)",
    pollster: "ReconMR",
    date: "2026-09-11",
    source:
      "https://reconmr.com/wp-content/uploads/2026/09/ReconMR-Texas-Poll-September-Crosstabs.pdf",
    election: "governor",
    states: {
      // Texas — Abbott (R) 45 / Hinojosa (D) 49.
      "48": {
        overall: s(49, 45),
        sex: { male: s(41, 53), female: s(55, 37) },
        // ReconMR age bands (18-34/35-49/50-64/65+) remapped to the analyzer's.
        age: {
          "18-29": s(62, 28),
          "30-44": s(54, 32),
          "45-64": s(53, 43),
          "65+": s(40, 56),
        },
        // Race curve: White, Black, Hispanic. Asian and Other are not broken
        // out, so they inherit the topline.
        race: {
          white: s(38, 55),
          black: s(82, 7),
          hispanic: s(65, 32),
        },
        education: edu(55, 38, 44, 51),
        composition: [
          { group: "sex", label: "Men", pct: 48 },
          { group: "sex", label: "Women", pct: 52 },
          { group: "age", label: "18-29", pct: 8 },
          { group: "age", label: "30-44", pct: 22 },
          { group: "age", label: "45-64", pct: 30 },
          { group: "age", label: "65+", pct: 39 },
          { group: "race", label: "White", pct: 65 },
          { group: "race", label: "Black", pct: 10 },
          { group: "race", label: "Hispanic", pct: 19 },
          { group: "race", label: "Other non-white", pct: 5 },
          { group: "education", label: "B.A.+", pct: 45 },
          { group: "education", label: "No B.A.", pct: 55 },
        ],
      },
    },
  },
];

export const ANALYZER_POLL_BY_ID: Record<string, AnalyzerPoll> =
  Object.fromEntries(ANALYZER_POLLS.map((poll) => [poll.id, poll]));
