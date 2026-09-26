// Fetch the demographic composition used by the State Analyzer and write it to
// public/data/demographics.json.
//
//   node scripts/fetch-demographics.mjs
//
// Source: U.S. Census Bureau, American Community Survey 2024 5-year estimates
// (2020-2024), served by the keyless Census Reporter API
// (https://api.censusreporter.org). Three tables are used:
//
//   B01001  Sex by age            -> sex shares and 18+ age bands
//   B03002  Hispanic origin by race -> White/Black/Asian/Hispanic/Other shares
//   B15003  Educational attainment (25+) -> four education bands
//
// The output is committed so production builds never touch the network. Re-run
// this only when the Census publishes a newer 5-year release.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CD_PATH = resolve(__dirname, "../public/data/cd120.json");
const OUT_PATH = resolve(__dirname, "../public/data/demographics.json");

const RELEASE = "acs2024_5yr";
const TABLES = ["B01001", "B03002", "B15003"];
const API = "https://api.censusreporter.org/1.0/data/show";
const BATCH_SIZE = 40;
const ROUND = 10000;

/** State FIPS codes that have a statewide analysis geography (50 states + DC). */
const STATE_FIPS = [
  "01", "02", "04", "05", "06", "08", "09", "10", "11", "12", "13", "15",
  "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27",
  "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39",
  "40", "41", "42", "44", "45", "46", "47", "48", "49", "50", "51", "53",
  "54", "55", "56",
];

const MALES = {
  "18-29": ["B01001007", "B01001008", "B01001009", "B01001010", "B01001011"],
  "30-44": ["B01001012", "B01001013", "B01001014"],
  "45-64": [
    "B01001015", "B01001016", "B01001017", "B01001018", "B01001019",
  ],
  "65+": [
    "B01001020", "B01001021", "B01001022", "B01001023", "B01001024",
    "B01001025",
  ],
};
const FEMALES = {
  "18-29": ["B01001031", "B01001032", "B01001033", "B01001034", "B01001035"],
  "30-44": ["B01001036", "B01001037", "B01001038"],
  "45-64": [
    "B01001039", "B01001040", "B01001041", "B01001042", "B01001043",
  ],
  "65+": [
    "B01001044", "B01001045", "B01001046", "B01001047", "B01001048",
    "B01001049",
  ],
};

const AGE_BANDS = ["18-29", "30-44", "45-64", "65+"];

const EDUCATION = {
  "no-hs": [
    "B15003002", "B15003003", "B15003004", "B15003005", "B15003006",
    "B15003007", "B15003008", "B15003009", "B15003010", "B15003011",
    "B15003012", "B15003013", "B15003014", "B15003015", "B15003016",
  ],
  hs: ["B15003017", "B15003018"],
  "some-college": ["B15003019", "B15003020", "B15003021"],
  "bachelors-plus": [
    "B15003022", "B15003023", "B15003024", "B15003025",
  ],
};

function sum(estimate, ids) {
  return ids.reduce((total, id) => total + (estimate[id] ?? 0), 0);
}

/** Normalize a map of counts into shares that sum to 1. */
function shares(counts) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  const result = {};
  for (const [key, value] of Object.entries(counts)) {
    result[key] = Math.round((value / total) * ROUND) / ROUND;
  }
  return result;
}

function compose(estimate) {
  const maleByBand = {};
  const femaleByBand = {};
  for (const band of AGE_BANDS) {
    maleByBand[band] = sum(estimate, MALES[band]);
    femaleByBand[band] = sum(estimate, FEMALES[band]);
  }
  const votingAgePopulation =
    Object.values(maleByBand).reduce((a, b) => a + b, 0) +
    Object.values(femaleByBand).reduce((a, b) => a + b, 0);
  if (votingAgePopulation <= 0) return null;

  const sex = shares({
    male: Object.values(maleByBand).reduce((a, b) => a + b, 0),
    female: Object.values(femaleByBand).reduce((a, b) => a + b, 0),
  });
  const age = shares(
    Object.fromEntries(
      AGE_BANDS.map((band) => [band, maleByBand[band] + femaleByBand[band]]),
    ),
  );

  const raceTotal = estimate.B03002001 ?? 0;
  const whiteNH = estimate.B03002003 ?? 0;
  const blackNH = estimate.B03002004 ?? 0;
  const asianNH = estimate.B03002006 ?? 0;
  const hispanic = estimate.B03002012 ?? 0;
  const other = Math.max(
    0,
    raceTotal - whiteNH - blackNH - asianNH - hispanic,
  );
  const race = shares({
    white: whiteNH,
    black: blackNH,
    hispanic,
    asian: asianNH,
    other,
  });

  const education = shares({
    "no-hs": sum(estimate, EDUCATION["no-hs"]),
    hs: sum(estimate, EDUCATION.hs),
    "some-college": sum(estimate, EDUCATION["some-college"]),
    "bachelors-plus": sum(estimate, EDUCATION["bachelors-plus"]),
  });

  if (!sex || !age || !race || !education) return null;
  return {
    population: estimate.B01001001 ?? 0,
    votingAgePopulation,
    sex,
    age,
    race,
    education,
  };
}

async function fetchBatch(geoIds) {
  const url =
    `${API}/${RELEASE}?table_ids=${TABLES.join(",")}` +
    `&geo_ids=${geoIds.join(",")}`;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      // Census Reporter rejects requests without a User-Agent (403).
      const response = await fetch(url, {
        headers: { "User-Agent": "election-map/0.1 (demographics build)" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  return { data: {} };
}

async function main() {
  const cd = JSON.parse(await readFile(CD_PATH, "utf8"));
  const districtGeoids = cd.features.map((f) => f.properties.geoid);

  // Geo entries carry their destination bucket so a single batch loop can
  // cover both states and districts.
  const targets = [
    ...STATE_FIPS.map((fips) => ({
      geoId: `04000US${fips}`,
      key: fips,
      bucket: "states",
    })),
    ...districtGeoids.map((geoid) => ({
      geoId: `50000US${geoid}`,
      key: geoid,
      bucket: "districts",
    })),
  ];

  const states = {};
  const districts = {};
  const missing = [];

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    process.stdout.write(
      `\rFetching ${Math.min(i + BATCH_SIZE, targets.length)}/${targets.length}`,
    );
    const json = await fetchBatch(batch.map((t) => t.geoId));
    for (const target of batch) {
      const entry = json.data?.[target.geoId];
      const estimate = entry?.B01001?.estimate;
      const composition =
        estimate && entry.B03002?.estimate && entry.B15003?.estimate
          ? compose({
              ...estimate,
              ...entry.B03002.estimate,
              ...entry.B15003.estimate,
            })
          : null;
      if (composition) {
        (target.bucket === "states" ? states : districts)[target.key] =
          composition;
      } else {
        missing.push(target.geoId);
      }
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  const output = {
    release: "ACS 2024 5-year estimates (2020-2024)",
    source:
      "U.S. Census Bureau, American Community Survey, via Census Reporter",
    fetched: new Date().toISOString().slice(0, 10),
    states,
    districts,
  };
  await writeFile(`${OUT_PATH}`, `${JSON.stringify(output)}\n`);
  process.stdout.write(
    `\nWrote ${Object.keys(states).length} states and ` +
      `${Object.keys(districts).length} districts to ${OUT_PATH}\n`,
  );
  if (missing.length) {
    console.warn(`Missing data for ${missing.length} geographies:`, missing);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
