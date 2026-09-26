// Fetch and parse 2026 general-election polling from Wikipedia.
//
// The app is hermetic, so the polls are compiled into a committed snapshot
// rather than fetched at runtime. This script is the Wikipedia half of that
// snapshot: it downloads each seat's article via the MediaWiki API, scrapes the
// polling tables for the actual general-election matchup, and writes
// scripts/senate-polls-wiki.json (or scripts/governor-polls-wiki.json with
// --governor). scripts/build-polls.mjs then merges that file with the
// electoral-vote.com base (scripts/senate-polls.json) and the hand-scraped
// supplement.
//
// Wikipedia's general-election sections carry several head-to-head tables
// (the nominee matchup plus hypothetical pairings). The actual matchup is the
// one whose two candidates match the article infobox's "Nominee" row; that is
// how this script decides which table to keep.
//
// Wikipedia text is CC BY-SA; the poll numbers themselves are facts reported by
// the pollsters. Attribution lives in the generated module header.
//
// Usage:
//   node scripts/fetch-wiki-polls.mjs             fetch the Senate races
//   node scripts/fetch-wiki-polls.mjs --governor  fetch the Governor races
//   node scripts/fetch-wiki-polls.mjs --refresh   bypass the on-disk cache
//
// Cached responses default to /tmp/opencode/wiki-polls; override with
// WIKI_POLLS_CACHE.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = process.cwd();
const GOVERNOR = process.argv.includes("--governor");
const OUT = resolve(
  ROOT,
  GOVERNOR ? "scripts/governor-polls-wiki.json" : "scripts/senate-polls-wiki.json",
);
const CACHE = process.env.WIKI_POLLS_CACHE ?? "/tmp/opencode/wiki-polls";
const REFRESH = process.argv.includes("--refresh");
const API = "https://en.wikipedia.org/w/api.php";

// The 35 seats on the 2026 Senate ballot, keyed by the two-digit state FIPS
// code used by states.json. Values are the Wikipedia article titles.
const SENATE_RACES = {
  "01": "2026 United States Senate election in Alabama",
  "02": "2026 United States Senate election in Alaska",
  "05": "2026 United States Senate election in Arkansas",
  "08": "2026 United States Senate election in Colorado",
  "10": "2026 United States Senate election in Delaware",
  "12": "2026 United States Senate special election in Florida",
  "13": "2026 United States Senate election in Georgia",
  "16": "2026 United States Senate election in Idaho",
  "17": "2026 United States Senate election in Illinois",
  "19": "2026 United States Senate election in Iowa",
  "20": "2026 United States Senate election in Kansas",
  "21": "2026 United States Senate election in Kentucky",
  "22": "2026 United States Senate election in Louisiana",
  "23": "2026 United States Senate election in Maine",
  "25": "2026 United States Senate election in Massachusetts",
  "26": "2026 United States Senate election in Michigan",
  "27": "2026 United States Senate election in Minnesota",
  "28": "2026 United States Senate election in Mississippi",
  "30": "2026 United States Senate election in Montana",
  "31": "2026 United States Senate election in Nebraska",
  "33": "2026 United States Senate election in New Hampshire",
  "34": "2026 United States Senate election in New Jersey",
  "35": "2026 United States Senate election in New Mexico",
  "37": "2026 United States Senate election in North Carolina",
  "39": "2026 United States Senate special election in Ohio",
  "40": "2026 United States Senate election in Oklahoma",
  "41": "2026 United States Senate election in Oregon",
  "44": "2026 United States Senate election in Rhode Island",
  "45": "2026 United States Senate election in South Carolina",
  "46": "2026 United States Senate election in South Dakota",
  "47": "2026 United States Senate election in Tennessee",
  "48": "2026 United States Senate election in Texas",
  "51": "2026 United States Senate election in Virginia",
  "54": "2026 United States Senate election in West Virginia",
  "56": "2026 United States Senate election in Wyoming",
};

// The 36 states with a 2026 gubernatorial election, by FIPS.
const GOVERNOR_RACES = {
  "01": "2026 Alabama gubernatorial election",
  "02": "2026 Alaska gubernatorial election",
  "04": "2026 Arizona gubernatorial election",
  "05": "2026 Arkansas gubernatorial election",
  "06": "2026 California gubernatorial election",
  "08": "2026 Colorado gubernatorial election",
  "09": "2026 Connecticut gubernatorial election",
  "12": "2026 Florida gubernatorial election",
  "13": "2026 Georgia gubernatorial election",
  "15": "2026 Hawaii gubernatorial election",
  "16": "2026 Idaho gubernatorial election",
  "17": "2026 Illinois gubernatorial election",
  "19": "2026 Iowa gubernatorial election",
  "20": "2026 Kansas gubernatorial election",
  "23": "2026 Maine gubernatorial election",
  "24": "2026 Maryland gubernatorial election",
  "25": "2026 Massachusetts gubernatorial election",
  "26": "2026 Michigan gubernatorial election",
  "27": "2026 Minnesota gubernatorial election",
  "31": "2026 Nebraska gubernatorial election",
  "32": "2026 Nevada gubernatorial election",
  "33": "2026 New Hampshire gubernatorial election",
  "35": "2026 New Mexico gubernatorial election",
  "36": "2026 New York gubernatorial election",
  "39": "2026 Ohio gubernatorial election",
  "40": "2026 Oklahoma gubernatorial election",
  "41": "2026 Oregon gubernatorial election",
  "42": "2026 Pennsylvania gubernatorial election",
  "44": "2026 Rhode Island gubernatorial election",
  "45": "2026 South Carolina gubernatorial election",
  "46": "2026 South Dakota gubernatorial election",
  "47": "2026 Tennessee gubernatorial election",
  "48": "2026 Texas gubernatorial election",
  "50": "2026 Vermont gubernatorial election",
  "55": "2026 Wisconsin gubernatorial election",
  "56": "2026 Wyoming gubernatorial election",
};

const RACES = GOVERNOR ? GOVERNOR_RACES : SENATE_RACES;

const MONTHS = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11",
  december: "12", jan: "01", feb: "02", mar: "03", apr: "04", jun: "06",
  jul: "07", aug: "08", sep: "09", sept: "09", oct: "10", nov: "11", dec: "12",
};

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** Collapse whitespace and drop rendered footnote markers like "[12]" / "[b]". */
function cleanText(raw) {
  return raw
    .replace(/\[\d+\]|\[[A-Za-z0-9]{1,3}\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The party a candidate header cell is labeled with, if any. Independents are
 * returned as "I"; the app records Nebraska's independent challenger (Dan
 * Osborn) in its Democratic column, so I and D are treated the same way.
 */
function candidateParty(label) {
  const m = /\((D|R|Dem|Rep|Democratic|Republican|I|Ind|Independent)\)/i.exec(
    label,
  );
  if (!m) return null;
  const tag = m[1].toLowerCase();
  if (tag === "r") return "R";
  if (tag === "i" || tag === "ind" || tag === "independent") return "I";
  return "D";
}

/** Last name for matching a candidate header against the infobox nominees. */
function surname(label) {
  const name = label.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return name.split(/\s+/).at(-1)?.toLowerCase() ?? "";
}

/** "1,107 (LV)" -> { sample: 1107, population: "LV" }; "– (RV)" -> {population}. */
function parseSample(raw) {
  const out = {};
  const sample = /(\d[\d,]*)/.exec(raw);
  if (sample) out.sample = Number.parseInt(sample[1].replace(/,/g, ""), 10);
  const pop = /\((?:likely voters|LV)\)/i.test(raw)
    ? "LV"
    : /\((?:registered voters|RV)\)/i.test(raw)
      ? "RV"
      : /\((?:adults|A)\)/i.test(raw)
        ? "A"
        : /\((?:voters|V)\)/i.test(raw)
          ? "RV"
          : null;
  if (pop) out.population = pop;
  return out;
}

/** "September 14–21, 2026" / "March 15 – April 13, 2026" -> "2026-09-21". */
function parseDate(raw) {
  const text = cleanText(raw).replace(/[–—]/g, "-").replace(/,/g, " ");
  const year = /(\d{4})/.exec(text)?.[1];
  if (!year) return null;
  const pairs = [
    ...text.matchAll(/([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:\s*-\s*(\d{1,2}))?/g),
  ];
  if (pairs.length === 0) return null;
  const [, monthName, first, rangeEnd] = pairs[pairs.length - 1];
  const month = MONTHS[monthName.toLowerCase()];
  if (!month) return null;
  const day = rangeEnd ?? first;
  return `${year}-${month}-${day.padStart(2, "0")}`;
}

/** First percentage (or bare number) in a candidate cell, e.g. "'''51%'''" -> 51. */
function parseShare(raw) {
  const m = /(\d{1,3})\s*%?/.exec(cleanText(raw));
  if (!m) return null;
  const value = Number.parseInt(m[1], 10);
  return value >= 0 && value <= 100 ? value : null;
}

/** The actual nominees named in the article infobox, by surname. */
function nomineeSurnames(doc) {
  const names = new Set();
  const infobox = doc.querySelector("table.infobox");
  if (!infobox) return names;
  for (const row of infobox.querySelectorAll("tr")) {
    const th = row.querySelector("th");
    if (!th || !/^nominee/i.test(cleanText(th.textContent))) continue;
    for (const cell of row.querySelectorAll("td")) {
      for (const link of cell.querySelectorAll("a")) {
        const text = cleanText(link.textContent);
        if (text) names.add(text.split(/\s+/).at(-1).toLowerCase());
      }
    }
  }
  return names;
}

/** Parse one head-to-head table, returning its candidate columns and rows. */
function parsePollTable(table) {
  const rows = [...table.querySelectorAll("tr")];
  if (rows.length === 0) return null;
  const header = [...rows[0].querySelectorAll("th,td")].map((c) =>
    cleanText(c.textContent),
  );
  // Reject poll-aggregator tables (270toWin, RCP, ...), which also list
  // candidate columns but are not individual polls.
  if (/aggregat/i.test(header[0] ?? "")) return null;
  if (!/poll\s*source|pollster/i.test(header[0] ?? "")) return null;

  const columns = header
    .map((label, index) => ({ party: candidateParty(label), index, label }))
    .filter((c) => c.party);
  // The "d" side is the Democratic nominee, or an independent when the state
  // has no Democratic nominee (Nebraska's Dan Osborn). A third-party
  // independent alongside a Democrat is ignored.
  const dCol = columns.find((c) => c.party === "D") ?? columns.find((c) => c.party === "I");
  const rCol = columns.find((c) => c.party === "R");
  if (!dCol || !rCol) return null;
  // Skip tables that offer several candidates of one party (primaries / fields).
  if (columns.filter((c) => c.party === "D").length > 1) return null;
  if (columns.filter((c) => c.party === "R").length > 1) return null;

  const polls = [];
  for (const row of rows.slice(1)) {
    const cells = [...row.querySelectorAll("th,td")];
    if (cells.length <= Math.max(dCol.index, rCol.index)) continue;
    const pollster = cleanText(cells[0].textContent);
    if (!pollster) continue;
    const date = parseDate(cells[1]?.textContent ?? "");
    const d = parseShare(cells[dCol.index].textContent);
    const r = parseShare(cells[rCol.index].textContent);
    if (date == null || d == null || r == null) continue; // separator/primary row
    if (d + r > 100) continue;
    polls.push({ pollster, date, d, r, ...parseSample(cells[2]?.textContent ?? "") });
  }
  return {
    d: surname(dCol.label),
    r: surname(rCol.label),
    columns: columns.map((c) => ({ party: c.party, surname: surname(c.label) })),
    polls,
  };
}

/** All head-to-head tables in the article's general-election polling section. */
function generalPollTables(doc) {
  const nodes = [...doc.querySelectorAll("body *")];
  const genIndex = nodes.findIndex(
    (n) => n.tagName === "H2" && /^general election$/i.test(cleanText(n.textContent)),
  );
  if (genIndex === -1) return null;

  const tables = [];
  let inPolling = false;
  for (let i = genIndex + 1; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (node.tagName === "H2") break;
    if (node.tagName === "H3") {
      inPolling = /^polling/i.test(cleanText(node.textContent));
      continue;
    }
    if (node.tagName === "H4" || node.tagName === "H5") {
      inPolling = false;
      continue;
    }
    if (inPolling && node.tagName === "TABLE") {
      const parsed = parsePollTable(node);
      if (parsed && parsed.polls.length > 0) tables.push(parsed);
    }
  }
  return tables;
}

/** Extract the real-matchup polls from one rendered article. */
function parseArticle(html) {
  const doc = new JSDOM(html).window.document;
  const tables = generalPollTables(doc);
  if (tables == null) return null;
  const nominees = nomineeSurnames(doc);

  // Keep only tables whose two candidates are both the article's nominees,
  // then prefer the ballot that names the most nominees and the fewest
  // non-nominees (the plain head-to-head rather than a field).
  const qualifying = tables.filter((t) => nominees.has(t.d) && nominees.has(t.r));
  const latest = (t) => t.polls.map((p) => p.date).sort().at(-1) ?? "";
  const score = (t) =>
    t.columns.filter((c) => nominees.has(c.surname)).length -
    t.columns.filter((c) => !nominees.has(c.surname)).length;
  const best = [...qualifying].sort(
    (a, b) =>
      score(b) - score(a) ||
      latest(b).localeCompare(latest(a)) ||
      b.polls.length - a.polls.length,
  )[0];
  // A page may split the same matchup across several tables by date; keep them
  // all, but drop tables naming a different head-to-head.
  const chosen = best
    ? qualifying.filter((t) => t.d === best.d && t.r === best.r)
    : tables.slice(0, 1);

  const polls = chosen.flatMap((t) => t.polls);
  if (polls.length === 0) return [];
  polls.sort((a, b) => b.date.localeCompare(a.date));
  return polls;
}

async function fetchArticle(title) {
  const safe = title.replace(/[^A-Za-z0-9_.-]/g, "_");
  const cached = resolve(CACHE, `${safe}.html`);
  if (!REFRESH && existsSync(cached)) return readFileSync(cached, "utf8");
  const url =
    `${API}?action=parse&prop=text&format=json&formatversion=2&redirects=1` +
    `&page=${encodeURIComponent(title)}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "election-map/0.1 (build script; contact: dev@localhost)",
      },
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

async function main() {
  const data = {};
  const summary = [];
  for (const [fips, title] of Object.entries(RACES)) {
    let html;
    try {
      html = await fetchArticle(title);
    } catch (error) {
      summary.push(`  ${fips} ${title}: FETCH ERROR ${error.message}`);
      continue;
    }
    const polls = parseArticle(html);
    if (polls == null) {
      summary.push(`  ${fips} ${title}: no general-election section`);
      continue;
    }
    if (polls.length === 0) {
      summary.push(`  ${fips} ${title}: no general-election polls`);
      continue;
    }
    // Same pollster can report two candidates in one release; keep one.
    const seen = new Set();
    const unique = polls.filter((p) => {
      const key = `${p.pollster}|${p.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    data[fips] = unique;
    summary.push(`  ${fips} ${title}: ${unique.length} polls`);
    await sleep(700); // be polite to the API on cache misses
  }
  writeFileSync(OUT, `${JSON.stringify(data, null, 2)}\n`);
  console.log(summary.join("\n"));
  const total = Object.values(data).reduce((n, p) => n + p.length, 0);
  console.log(`\nWrote ${OUT} (${Object.keys(data).length} states, ${total} polls).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
