// Compile the 2026 race ratings the app ships from Wikipedia's predictions
// tables for the six outlets shown in the ratings dropdown.
//
// The app is hermetic, so ratings are committed rather than fetched at runtime.
// This script is the generator for those committed snapshots. It reads the
// "Predictions" table on each of three Wikipedia pages:
//
//   - "2026 United States Senate elections"            (35 seats)
//   - "2026 United States House of Representatives      (all 435 districts)
//      election ratings"                               (competitive only)
//   - "2026 United States gubernatorial elections"      (36 states)
//
// and rewrites src/data/ratings/*.ts plus the Cook ratings blocks in
// src/data/senate2026.ts, house2026.ts and governor2026.ts.
//
// Wikipedia text is CC BY-SA; the ratings themselves are the outlets' facts.
//
// Usage:
//   node scripts/build-ratings.mjs             write the rating modules
//   node scripts/build-ratings.mjs --dump      print parsed maps, write nothing
//   node scripts/build-ratings.mjs --refresh   bypass the on-disk cache
//
// Cached responses default to /tmp/opencode/wiki-ratings; override with
// WIKI_RATINGS_CACHE.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = process.cwd();
const DUMP = process.argv.includes("--dump");
const REFRESH = process.argv.includes("--refresh");
const CACHE = process.env.WIKI_RATINGS_CACHE ?? "/tmp/opencode/wiki-ratings";
const API = "https://en.wikipedia.org/w/api.php";

// ---------------------------------------------------------------------------
// Reference data (kept in step with src/data/states.ts and the race modules).
// ---------------------------------------------------------------------------

const STATE_FIPS = {
  Alabama: "01", Alaska: "02", Arizona: "04", Arkansas: "05",
  California: "06", Colorado: "08", Connecticut: "09", Delaware: "10",
  Florida: "12", Georgia: "13", Hawaii: "15", Idaho: "16", Illinois: "17",
  Indiana: "18", Iowa: "19", Kansas: "20", Kentucky: "21", Louisiana: "22",
  Maine: "23", Maryland: "24", Massachusetts: "25", Michigan: "26",
  Minnesota: "27", Mississippi: "28", Missouri: "29", Montana: "30",
  Nebraska: "31", Nevada: "32", "New Hampshire": "33", "New Jersey": "34",
  "New Mexico": "35", "New York": "36", "North Carolina": "37",
  "North Dakota": "38", Ohio: "39", Oklahoma: "40", Oregon: "41",
  Pennsylvania: "42", "Rhode Island": "44", "South Carolina": "45",
  "South Dakota": "46", Tennessee: "47", Texas: "48", Utah: "49",
  Vermont: "50", Virginia: "51", Washington: "53", "West Virginia": "54",
  Wisconsin: "55", Wyoming: "56",
};

// States that elect their House delegation at large (geoid district "00").
const AT_LARGE = new Set(["02", "10", "38", "46", "50", "56"]);

// The six seats no outlet lists as competitive that the app rates Safe for a
// deliberate party (four new 2026 districts, plus the CA-1 / LA-6 mid-decade
// redistricting flips). Mirrors the expectation in ratingsSources.test.ts.
const SAFE_OVERRIDES = {
  "0101": "SOLID_R",
  "0638": "SOLID_D",
  "4830": "SOLID_D",
  "4901": "SOLID_D",
  "0601": "SOLID_D",
  "2206": "SOLID_R",
};

const OUTLETS = [
  { id: "cook", label: "Cook Political Report", url: "https://www.cookpolitical.com/ratings", column: "Cook" },
  { id: "insideElections", label: "Inside Elections", url: "https://insideelections.com/ratings", column: "IE" },
  { id: "sabato", label: "Sabato's Crystal Ball", url: "https://centerforpolitics.org/crystalball/", column: "Sabato" },
  { id: "splitTicket", label: "Split Ticket", url: "https://split-ticket.org/", column: "ST", noGovernor: true },
  { id: "ddhq", label: "Decision Desk HQ", url: "https://elections2026.decisiondeskhq.com/", column: "DDHQ" },
  { id: "fox", label: "Fox News Power Rankings", url: "https://www.foxnews.com/elections/", column: "Fox" },
];

// The outlet modules and their exported constant prefixes.
const MODULE = {
  cook: "COOK",
  insideElections: "INSIDEELECTIONS",
  sabato: "SABATO",
  splitTicket: "SPLITTICKET",
  ddhq: "DDHQ",
  fox: "FOX",
};

// ---------------------------------------------------------------------------
// Parsing helpers.
// ---------------------------------------------------------------------------

const PAGE = {
  senate: "2026 United States Senate elections",
  house: "2026 United States House of Representatives election ratings",
  governor: "2026 United States gubernatorial elections",
};

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function clean(raw) {
  return raw.replace(/\[\d+\]|\[[A-Za-z0-9]{1,3}\]/g, "").replace(/\s+/g, " ").trim();
}

async function fetchPage(title) {
  const safe = title.replace(/[^A-Za-z0-9_.-]/g, "_");
  const cached = resolve(CACHE, `${safe}.html`);
  if (!REFRESH && existsSync(cached)) return readFileSync(cached, "utf8");
  const url =
    `${API}?action=parse&prop=text&format=json&formatversion=2&redirects=1` +
    `&page=${encodeURIComponent(title)}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetch(url, {
      headers: { "User-Agent": "election-map/0.1 (build script; contact: dev@localhost)" },
    });
    if (res.status === 429) {
      const wait = 2000 * 2 ** attempt;
      console.warn(`  rate limited on "${title}", retrying in ${wait}ms`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${title}`);
    const json = await res.json();
    if (json.error) throw new Error(`${title}: ${json.error.info}`);
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(cached, json.parse.text);
    return json.parse.text;
  }
  throw new Error(`giving up on ${title} after repeated 429s`);
}

/** A rating cell ("Solid R", "Likely D (flip)", "Tossup") -> the app's tone. */
function toRating(raw) {
  const text = clean(raw);
  if (!text || /^[–—-]+$/.test(text)) return null;
  if (/toss\s*up/i.test(text)) return "TOSS";
  const party = /(?:\b|.*?)(Democrat|Democratic|Dem|\bD\b)/i.test(text)
    ? "D"
    : /(?:\b|.*?)(Republican|Rep|\bR\b)/i.test(text)
      ? "R"
      : null;
  // Strip the party word so "Likely D" doesn't read as "lean".
  const tone = text.replace(/[^A-Za-z ]/g, "").toLowerCase();
  let band = null;
  if (/solid|safe/.test(tone)) band = "SOLID";
  else if (/likely/.test(tone)) band = "LIKELY";
  else if (/lean|tilt/.test(tone)) band = "LEAN";
  if (!party || !band) return null;
  return `${band}_${party}`;
}

/**
 * Build a column-index -> header-label map from a table's header row,
 * following the recognized outlet columns. `headerMatch` returns a short
 * outlet key for a header cell, or null.
 */
function headerColumns(table, headerMatch) {
  const rows = [...table.querySelectorAll("tr")];
  // The label row is the one whose cells name the outlets (the last header row).
  let labelRow = null;
  for (const tr of rows) {
    const cells = [...tr.children].filter((c) => ["TH", "TD"].includes(c.tagName));
    if (cells.some((c) => headerMatch(clean(c.textContent)) != null)) {
      labelRow = cells;
      break;
    }
  }
  if (!labelRow) throw new Error("no outlet header row found");
  const map = {};
  labelRow.forEach((cell, index) => {
    const key = headerMatch(clean(cell.textContent));
    if (key) map[key] = index;
  });
  return map;
}

function outletHeader(column) {
  return (text) => {
    // Headers look like "CookOct. 9,2026[3]"; match the leading name.
    if (text.startsWith(column)) return column;
    if (column === "IE" && /^IEOct/i.test(text)) return column;
    if (column === "ST" && /^STOct/i.test(text)) return column;
    return null;
  };
}

function rowCells(tr) {
  return [...tr.children].filter((c) => ["TH", "TD"].includes(c.tagName));
}

// ---------------------------------------------------------------------------
// Senate / Governor: one row per race; the first cell names the state.
// ---------------------------------------------------------------------------

function parseStateRatings(html, { expectColumn }) {
  const doc = new JSDOM(html).window.document;
  // Pick the predictions table explicitly: the one whose header row carries
  // all the recognized outlet columns.
  const tables = [...doc.querySelectorAll("table")];
  let chosen = null;
  for (const t of tables) {
    const labels = [...t.querySelectorAll("tr")]
      .flatMap((tr) => [...tr.children])
      .map((c) => clean(c.textContent));
    if (expectColumn.every((col) => labels.some((l) => l.startsWith(col)))) {
      chosen = t;
      break;
    }
  }
  if (!chosen) throw new Error("predictions table not found");

  const colMap = headerColumns(chosen, (text) =>
    expectColumn.find((col) => text.startsWith(col)) ?? null,
  );
  const out = Object.fromEntries(expectColumn.map((col) => [col, {}]));
  for (const tr of chosen.querySelectorAll("tr")) {
    const cells = rowCells(tr);
    if (cells.length === 0) continue;
    if (cells[0].tagName !== "TH") continue; // header row
    const rawName = clean(cells[0].textContent);
    const name = rawName.replace(/\s*\(.*\)\s*$/, "");
    const fips = STATE_FIPS[name];
    if (!fips) continue;
    for (const col of expectColumn) {
      const value = toRating(cells[colMap[col]]?.textContent ?? "");
      if (value) out[col][fips] = value;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// House: one row per competitive district; first cell is "Alabama 2".
// ---------------------------------------------------------------------------

function parseDistrictId(raw) {
  const text = clean(raw);
  const atLarge = /at-large$/i.test(text);
  const name = text.replace(/ at-large$/i, "").replace(/\s+\d+$/, "").trim();
  const fips = STATE_FIPS[name];
  if (!fips) return null;
  if (atLarge) return AT_LARGE.has(fips) ? `${fips}00` : null;
  const num = /(\d+)\s*$/.exec(text)?.[1];
  if (!num) return null;
  return `${fips}${num.padStart(2, "0")}`;
}

function parseHouseRatings(html, expectColumn) {
  const doc = new JSDOM(html).window.document;
  const tables = [...doc.querySelectorAll("table")];
  let chosen = null;
  for (const t of tables) {
    const labels = [...t.querySelectorAll("tr")]
      .flatMap((tr) => [...tr.children])
      .map((c) => clean(c.textContent));
    if (expectColumn.every((col) => labels.some((l) => l.startsWith(col)))) {
      chosen = t;
      break;
    }
  }
  if (!chosen) throw new Error("house predictions table not found");

  const colMap = headerColumns(chosen, (text) =>
    expectColumn.find((col) => text.startsWith(col)) ?? null,
  );
  const out = Object.fromEntries(expectColumn.map((col) => [col, {}]));
  for (const tr of chosen.querySelectorAll("tr")) {
    const cells = rowCells(tr);
    if (cells.length === 0) continue;
    if (cells[0].tagName !== "TH") continue;
    const geoid = parseDistrictId(cells[0].textContent);
    if (!geoid) continue;
    for (const col of expectColumn) {
      const value = toRating(cells[colMap[col]]?.textContent ?? "");
      if (value) out[col][geoid] = value;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Filling out the full House map and emitting modules.
// ---------------------------------------------------------------------------

const HOUSE_HOLDERS = parseHolderModule(
  readFileSync(resolve(ROOT, "src/data/house2026Holder.ts"), "utf8"),
);
const ALL_DISTRICTS = JSON.parse(
  readFileSync(resolve(ROOT, "public/data/cd120.json"), "utf8"),
).features.map((f) => f.properties.geoid);
const ALL_DISTRICTS_SORTED = [...ALL_DISTRICTS].sort();

function parseHolderModule(source) {
  const block = source.match(/HOUSE_2026_HOLDER[^{]*\{([\s\S]*?)\};/)[1];
  const map = {};
  for (const [, key, value] of block.matchAll(/"(\d{4})":\s*(?:"([DRI])"|null)/g)) {
    map[key] = value ?? null;
  }
  return map;
}

/** Turn one outlet's competitive-district map into the full 435-district map. */
function fillHouse(partial, outlet) {
  const out = {};
  const missing = [];
  for (const geoid of ALL_DISTRICTS) {
    if (partial[geoid]) {
      out[geoid] = partial[geoid];
      continue;
    }
    if (SAFE_OVERRIDES[geoid]) {
      out[geoid] = SAFE_OVERRIDES[geoid];
      continue;
    }
    const holder = HOUSE_HOLDERS[geoid];
    if (holder === "D" || holder === "R") {
      out[geoid] = `SOLID_${holder}`;
      continue;
    }
    missing.push(geoid);
  }
  if (missing.length) {
    throw new Error(
      `${outlet}: no rating for ${missing.length} unheld district(s): ${missing.join(", ")}`,
    );
  }
  return out;
}

function renderRatings(map, order) {
  return order.map((key) => `  ${JSON.stringify(key)}: ${JSON.stringify(map[key])},`).join("\n");
}

function outletModule(outlet, senate, house, governor, dates, orders) {
  const prefix = MODULE[outlet.id];
  const lines = [
    'import type { RaceRating } from "../../types";',
    "",
    "/**",
    ` * 2026 race ratings from ${outlet.label}`,
    ` * Source: ${outlet.url}`,
    " *",
    ` * - Senate ratings as of ${dates.senate} (35 seats on the 2026 ballot),`,
    ' *   compiled from the Wikipedia "2026 United States Senate elections"',
    " *   predictions table.",
    ` * - House ratings as of ${dates.house} (all 435 districts), compiled from`,
    ' *   the Wikipedia "2026 United States House of Representatives election',
    ' *   ratings" page. Districts not listed as competitive there are rated',
    " *   Safe/Solid, so this file shades them Solid for the party currently",
    " *   holding the seat.",
    " *",
    ' *   Solid/Safe reads as Solid; a "flip" rating is kept as the party it favors.',
    " *",
    " * Each Solid/Likely/Lean tone maps to the app's race-rating colors.",
    " * Keyed by state FIPS (senate) / district GEOID (house).",
    " */",
    "",
    `export const ${prefix}_SENATE_RATINGS: Record<string, RaceRating> = {`,
    renderRatings(senate, orders.senate),
    "};",
    "",
    `export const ${prefix}_HOUSE_RATINGS: Record<string, RaceRating> = {`,
    renderRatings(house, orders.house),
    "};",
    "",
  ];
  if (governor) {
    lines.push(
      "/**",
      ` * 2026 Governor race ratings for the 36 states on the ballot, as of`,
      ` * ${dates.governor}, compiled from the Wikipedia "2026 United States`,
      ' * gubernatorial elections" predictions table. Keyed by state FIPS.',
      " */",
      `export const ${prefix}_GOVERNOR_RATINGS: Record<string, RaceRating> = {`,
      renderRatings(governor, orders.governor),
      "};",
      "",
    );
  }
  return lines.join("\n");
}

function raceOrder(file) {
  const src = readFileSync(resolve(ROOT, file), "utf8");
  return [...src.matchAll(/fips:\s*"(\d+)"/g)].map((m) => m[1]);
}

const SENATE_ORDER = raceOrder("src/data/senate2026.ts");
const GOVERNOR_ORDER = raceOrder("src/data/governor2026.ts");

function replaceRatingsBlock(source, constName, map, order) {
  const re = new RegExp(`(export const ${constName}[^=]*=\\s*\\{)[\\s\\S]*?(\\};)`);
  return source.replace(re, `$1\n${renderRatings(map, order)}\n$2`);
}

function replaceAsOf(source, oldDate, newDate) {
  return source.split(oldDate).join(newDate);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function headerDate(header) {
  // "CookOct. 9,2026[3]" -> "October 9, 2026"
  const m =
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),\s*(\d{4})/i.exec(
      header,
    );
  if (!m) return null;
  const idx = MONTH_NAMES.findIndex((name) =>
    name.toLowerCase().startsWith(m[1].slice(0, 3).toLowerCase()),
  );
  if (idx < 0) return null;
  return `${MONTH_NAMES[idx]} ${Number(m[2])}, ${m[3]}`;
}

/** Map an outlet column to the as-of date read from the page header. */
function columnDate(html, expectColumn) {
  const doc = new JSDOM(html).window.document;
  for (const t of doc.querySelectorAll("table")) {
    const labels = [...t.querySelectorAll("tr")]
      .flatMap((tr) => [...tr.children])
      .map((c) => clean(c.textContent));
    if (!expectColumn.every((col) => labels.some((l) => l.startsWith(col)))) continue;
    for (const label of labels) {
      if (label.startsWith(expectColumn)) return headerDate(label);
    }
  }
  return null;
}

async function main() {
  const [senateHtml, houseHtml, governorHtml] = await Promise.all([
    fetchPage(PAGE.senate),
    fetchPage(PAGE.house),
    fetchPage(PAGE.governor),
  ]);

  const senateCols = ["Cook", "DDHQ", "Fox", "IE", "Sabato", "ST"];
  const houseCols = ["Cook", "IE", "Sabato", "ST", "DDHQ", "Fox"];
  const governorCols = ["Cook", "DDHQ", "Fox", "IE", "Sabato"];

  const senate = parseStateRatings(senateHtml, { expectColumn: senateCols });
  const house = parseHouseRatings(houseHtml, houseCols);
  const governor = parseStateRatings(governorHtml, { expectColumn: governorCols });

  const dates = {};
  for (const outlet of OUTLETS) {
    dates[outlet.id] = {
      senate: columnDate(senateHtml, [outlet.column]),
      house: columnDate(houseHtml, [outlet.column]),
      governor: outlet.noGovernor ? null : columnDate(governorHtml, [outlet.column]),
    };
  }

  if (DUMP) {
    for (const outlet of OUTLETS) {
      const fullHouse = fillHouse(house[outlet.column], outlet.id);
      console.log(`\n=== ${outlet.id} (${dates[outlet.id].senate} / ${dates[outlet.id].house}) ===`);
      console.log(`senate keys: ${Object.keys(senate[outlet.column]).length}, house competitive: ${Object.keys(house[outlet.column]).length}, house keys: ${Object.keys(fullHouse).length}`);
      console.log(`gov: ${outlet.noGovernor ? "n/a" : Object.keys(governor[outlet.column]).length}`);
    }
    return;
  }

  // Per-outlet modules. Cook is not written here: its ratings live in the
  // three "default" modules (senate2026.ts etc.) that also carry the race lists.
  const orders = {
    senate: SENATE_ORDER,
    house: ALL_DISTRICTS_SORTED,
    governor: GOVERNOR_ORDER,
  };
  for (const outlet of OUTLETS) {
    if (outlet.id === "cook") continue;
    const senateMap = senate[outlet.column];
    const houseMap = fillHouse(house[outlet.column], outlet.id);
    const governorMap = outlet.noGovernor ? null : governor[outlet.column];
    const file = resolve(ROOT, `src/data/ratings/${outlet.id}.ts`);
    writeFileSync(
      file,
      outletModule(outlet, senateMap, houseMap, governorMap, dates[outlet.id], orders),
    );
    console.log(`wrote ${file}`);
  }

  // Cook also lives in the three "default" modules, which keep the race lists.
  const cookSenate = senate.Cook;
  const cookHouse = fillHouse(house.Cook, "cook");
  const cookGovernor = governor.Cook;

  const senateFile = resolve(ROOT, "src/data/senate2026.ts");
  let senateSrc = readFileSync(senateFile, "utf8");
  senateSrc = replaceRatingsBlock(senateSrc, "SENATE_2026_RATINGS", cookSenate, SENATE_ORDER);
  senateSrc = replaceAsOf(senateSrc, "September 15, 2026", dates.cook.senate);
  writeFileSync(senateFile, senateSrc);

  const houseFile = resolve(ROOT, "src/data/house2026.ts");
  let houseSrc = readFileSync(houseFile, "utf8");
  houseSrc = replaceRatingsBlock(houseSrc, "HOUSE_2026_RATINGS", cookHouse, ALL_DISTRICTS_SORTED);
  houseSrc = replaceAsOf(houseSrc, "September 11, 2026", dates.cook.house);
  writeFileSync(houseFile, houseSrc);

  const governorFile = resolve(ROOT, "src/data/governor2026.ts");
  let governorSrc = readFileSync(governorFile, "utf8");
  governorSrc = replaceRatingsBlock(governorSrc, "GOVERNOR_2026_RATINGS", cookGovernor, GOVERNOR_ORDER);
  governorSrc = replaceAsOf(governorSrc, "September 17, 2026", dates.cook.governor);
  writeFileSync(governorFile, governorSrc);

  // Registry dates.
  const registryFile = resolve(ROOT, "src/data/ratingsSources.ts");
  let registry = readFileSync(registryFile, "utf8");
  const OLD_DATES = {
    cook: { senate: "September 15, 2026", house: "September 11, 2026", governor: "September 17, 2026" },
    insideElections: { senate: "September 17, 2026", house: "September 17, 2026", governor: "September 17, 2026" },
    sabato: { senate: "September 22, 2026", house: "September 22, 2026", governor: "September 22, 2026" },
    splitTicket: { senate: "September 22, 2026", house: "September 12, 2026" },
    ddhq: { senate: "September 22, 2026", house: "September 12, 2026", governor: "September 23, 2026" },
    fox: { senate: "September 22, 2026", house: "September 22, 2026", governor: "September 22, 2026" },
  };
  for (const outlet of OUTLETS) {
    const old = OLD_DATES[outlet.id];
    const next = dates[outlet.id];
    registry = registry.replace(
      new RegExp(`(id: "${outlet.id}"[\\s\\S]*?)senateAsOf: "${old.senate}"`),
      `$1senateAsOf: "${next.senate}"`,
    );
    registry = registry.replace(
      new RegExp(`(id: "${outlet.id}"[\\s\\S]*?)houseAsOf: "${old.house}"`),
      `$1houseAsOf: "${next.house}"`,
    );
    if (old.governor && next.governor) {
      registry = registry.replace(
        new RegExp(`(id: "${outlet.id}"[\\s\\S]*?)governorAsOf: "${old.governor}"`),
        `$1governorAsOf: "${next.governor}"`,
      );
    }
  }
  writeFileSync(registryFile, registry);
  console.log(`updated ${registryFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
