// Add a per-geography party composition (Democrat / Republican / Independent)
// to public/data/demographics.json.
//
//   node scripts/build-party.mjs
//
// The census has no party field, so this blends two real sources:
//
//   scripts/party/ces2024_party.json  Cooperative Election Study (CES) Common
//       Content 2024 (doi:10.7910/DVN/X11EP6): the weighted share of likely
//       voters identifying or leaning Democratic / Republican / Independent per
//       state and per congressional district (cdid119), with sample sizes. See
//       scripts/party/aggregate-ces.py for the aggregation.
//   scripts/party/pres_by_cd.csv      The Downballot's 2024 presidential results
//       for every district on the 2026 (120th Congress) lines. Only the
//       Harris/Trump two-party share is used, shifted by the difference between
//       the 2026 generic congressional ballot and the 2024 national
//       presidential result to approximate the 2026 environment.
//
// Method: party ID is far noisier than vote at the district level, so each
// district's Democratic-minus-Republican identification gap is regressed on its
// 2026-adjusted two-party share (weighted by CES sample size). Only the noisy
// tail is anchored: a district at or above FLOOR respondents keeps its raw CES
// gap, while a smaller one is shrunk toward that fit (k = SHRINK, so it keeps
// n/(n+k) of its raw value, and a larger k pulls it further). The Independent
// share is taken from the state CES estimate, which is well-measured.
//
// Caveat: CES reports districts on the 119th-Congress lines while the committed
// map is the 120th, so the ten mid-decade-redistricted states are approximate.
// Re-run this after scripts/fetch-demographics.mjs, which rewrites the file
// without party.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMO_PATH = resolve(__dirname, "../public/data/demographics.json");
const CES_PATH = resolve(__dirname, "party/ces2024_party.json");
const PRES_PATH = resolve(__dirname, "party/pres_by_cd.csv");

/** Respondents at or above which a district's raw CES gap is trusted outright. */
const FLOOR = 120;
/** Prior strength for the districts below FLOOR (weight of k raw observations). */
const SHRINK = 150;
const ROUND = 10000;

/**
 * National 2024 two-party presidential Democratic share: Harris 75,017,613 of
 * the 152,320,193 two-party votes.
 */
const PRES_2024_NATIONAL_D = 0.4925;
/**
 * Silver Bulletin's 2026 generic congressional ballot average, D+7.5 as of
 * 2026-09-21, i.e. a 53.75% Democratic two-party share.
 */
const GENERIC_2026_D = 0.5375;
/**
 * Uniform shift from the 2024 presidential environment to the 2026 generic
 * ballot, added to every district's 2024 two-party share.
 */
const SHIFT = GENERIC_2026_D - PRES_2024_NATIONAL_D;

const ABBR_TO_FIPS = {
  AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09",
  DE: "10", DC: "11", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17",
  IN: "18", IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24",
  MA: "25", MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31",
  NV: "32", NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38",
  OH: "39", OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46",
  TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54",
  WI: "55", WY: "56",
};

const pad2 = (n) => String(n).padStart(2, "0");
const round = (x) => Math.round(x * ROUND) / ROUND;
const gapOf = (p) => {
  const dr = p.d + p.r;
  return dr > 0 ? (p.d - p.r) / dr : 0;
};

/** The Downballot table, keyed to the app's district geoid. */
function readPres(text) {
  const pres = {};
  const lines = text.split(/\r?\n/);
  const header = lines.findIndex((l) => l.startsWith("District,"));
  for (const line of lines.slice(header + 2)) {
    const parts = line.split(",");
    if (parts.length < 5) continue;
    const [code, , , harris, trump] = parts;
    const m = /^([A-Z]{2})-(AL|\d{2})$/.exec(code);
    if (!m) continue;
    const fips = ABBR_TO_FIPS[m[1]];
    if (!fips) continue;
    const h = Number(harris);
    const t = Number(trump);
    if (!harris || !trump || !(h + t > 0)) continue;
    const dist = m[2] === "AL" ? 0 : Number(m[2]);
    pres[`${fips}${pad2(dist)}`] = h / (h + t);
  }
  return pres;
}

/**
 * Anchor share for a district: its 2024 two-party Democratic share shifted by
 * the national move to the 2026 generic congressional ballot.
 */
function anchorFor(share) {
  if (share === undefined) return undefined;
  return Math.max(0, Math.min(1, share + SHIFT));
}

function weightedFit(points) {
  let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const { x, y, w } of points) {
    sw += w; sx += w * x; sy += w * y; sxx += w * x * x; sxy += w * x * y;
  }
  const beta = (sw * sxy - sx * sy) / (sw * sxx - sx * sx);
  const alpha = (sy - beta * sx) / sw;
  return { alpha, beta };
}

async function main() {
  const ces = JSON.parse(await readFile(CES_PATH, "utf8"));
  const pres = readPres(await readFile(PRES_PATH, "utf8"));
  const demo = JSON.parse(await readFile(DEMO_PATH, "utf8"));

  // At-large states appear as the "01" district in CES but as "00" in the map.
  const atLarge = new Set(
    Object.keys(demo.districts)
      .filter((g) => g.slice(2) === "00")
      .map((g) => g.slice(0, 2)),
  );
  const cesByGeoid = {};
  for (const [key, p] of Object.entries(ces.districts)) {
    const [fips, dd] = key.split("-");
    const geoid =
      atLarge.has(fips) && dd === "01" ? `${fips}00` : `${fips}${dd}`;
    cesByGeoid[geoid] = p;
  }

  const points = [];
  for (const [geoid, p] of Object.entries(cesByGeoid)) {
    const x = anchorFor(pres[geoid]);
    if (x === undefined || p.n < 15) continue;
    points.push({ x, y: gapOf(p), w: p.n });
  }
  const { alpha, beta } = weightedFit(points);

  const partyFor = (p, x) => {
    if (!p) return null;
    const n = p.n ?? 0;
    const w = n >= FLOOR ? 1 : n / (n + SHRINK);
    const prior = x === undefined ? gapOf(p) : alpha + beta * x;
    const gap = Math.max(-0.95, Math.min(0.95, w * gapOf(p) + (1 - w) * prior));
    const ind = p.i;
    return {
      democrat: round(((1 - ind) * (1 + gap)) / 2),
      republican: round(((1 - ind) * (1 - gap)) / 2),
      independent: round(ind),
    };
  };

  for (const [fips, comp] of Object.entries(demo.states)) {
    const p = ces.states[fips];
    if (!p) continue;
    const base = p.d + p.r + p.i;
    if (base <= 0) continue;
    comp.party = {
      democrat: round(p.d / base),
      republican: round(p.r / base),
      independent: round(p.i / base),
    };
  }
  for (const geoid of Object.keys(demo.districts)) {
    const fips = geoid.slice(0, 2);
    const comp = demo.districts[geoid];
    const seeded = partyFor(cesByGeoid[geoid], anchorFor(pres[geoid]));
    if (seeded) {
      comp.party = seeded;
    } else if (demo.states[fips]?.party) {
      comp.party = demo.states[fips].party;
    }
  }

  demo.partySource =
    "Party ID: Cooperative Election Study 2024 (Dem/Rep incl. leaners, " +
    "shrunk toward the district's 2024 presidential two-party share from The " +
    "Downballot, shifted by the 2026 generic congressional ballot)";
  await writeFile(DEMO_PATH, `${JSON.stringify(demo)}\n`);

  const withParty = Object.values(demo.districts).filter((d) => d.party).length;
  console.log(
    `party fit: gap = ${alpha.toFixed(3)} + ${beta.toFixed(3)} * presDemShare ` +
      `(${points.length} districts; 2024-to-2026 shift +${SHIFT.toFixed(3)})`,
  );
  console.log(
    `wrote party to ${Object.keys(demo.states).length} states and ` +
      `${withParty} districts`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
