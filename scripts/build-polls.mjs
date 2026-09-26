// Compile the committed 2026 Senate polling snapshot from real sources.
//
// The app is hermetic: it never calls a polling API at runtime, so polls are
// compiled into scripts/senate-polls.json and emitted as
// src/data/polling/senate2026.ts.
//
// Usage:
//   node scripts/build-polls.mjs                 re-emit TS from committed JSON
//   node scripts/build-polls.mjs --evp polls.csv compile from an
//                                                electoral-vote.com CSV plus
//                                                scripts/senate-polls-supplement.json
//
// The --evp CSV is the "senate_polls.csv" download from
// https://electoral-vote.com/evp2026/Senate/senate_polls.html. The supplement
// JSON holds general-election polls scraped from Wikipedia for states with no
// nonpartisan polls in the EVP list.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const JSON_OUT = resolve(ROOT, "scripts/senate-polls.json");
const TS_OUT = resolve(ROOT, "src/data/polling/senate2026.ts");
const SUPPLEMENT = resolve(ROOT, "scripts/senate-polls-supplement.json");
const WIKI = resolve(ROOT, "scripts/senate-polls-wiki.json");

// The 35 states with a 2026 Senate election: name (as electoral-vote.com
// writes it) -> FIPS.
const STATE_FIPS = {
  Alabama: "01",
  Alaska: "02",
  Arkansas: "05",
  Colorado: "08",
  Delaware: "10",
  Florida: "12",
  Georgia: "13",
  Idaho: "16",
  Illinois: "17",
  Iowa: "19",
  Kansas: "20",
  Kentucky: "21",
  Louisiana: "22",
  Maine: "23",
  Massachusetts: "25",
  Michigan: "26",
  Minnesota: "27",
  Mississippi: "28",
  Montana: "30",
  Nebraska: "31",
  "New Hampshire": "33",
  "New Jersey": "34",
  "New Mexico": "35",
  "North Carolina": "37",
  Ohio: "39",
  Oklahoma: "40",
  Oregon: "41",
  "Rhode Island": "44",
  "South Carolina": "45",
  "South Dakota": "46",
  Tennessee: "47",
  Texas: "48",
  Virginia: "51",
  "West Virginia": "54",
  Wyoming: "56",
};

const MONTHS = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

/** electoral-vote.com abbreviates pollster names; expand the common ones. */
const POLLSTER_RENAMES = {
  "U. of New Hampshire": "University of New Hampshire",
  "U. New Hampshire": "University of New Hampshire",
  "U. of Massachusetts": "University of Massachusetts",
  "Siena U.": "Siena College",
  "East Carolina U.": "East Carolina University",
  "Saint Anselm Coll.": "Saint Anselm College",
  "Emerson Coll.": "Emerson College",
  "Marist Coll.": "Marist College",
  "High Point U.": "High Point University",
  "Elon U.": "Elon University",
  "U. Texas": "University of Texas",
  "Texas Southern U.": "Texas Southern University",
  "Fabrizio + Anazlone": "Fabrizio + Anzalone",
  // Wikipedia and electoral-vote.com spell some pollsters differently; unify
  // them so the merge below can recognise the same poll from both sources.
  PPP: "Public Policy Polling",
  "Research & Polling Inc.": "Research and Polling",
  "The Trafalgar Group": "Trafalgar Group",
};

function cleanPollster(raw) {
  // The CSV appends the field length, e.g. "AK Survey Research-4".
  let name = raw.replace(/-\d{1,3}$/, "").trim();
  if (POLLSTER_RENAMES[name]) return POLLSTER_RENAMES[name];
  // Remove a "(R)"/"(D)"/"(I)" party tag from Wikipedia pollsters.
  name = name.replace(/\s+\([RDI]\)$/, "").trim();
  return name
    .replace(/\bU\./g, "University")
    .replace(/\bColl\./g, "College")
    .replace(/\bRes\./g, "Research")
    .replace(/\bInst\./g, "Institute")
    .replace(/\bAK Survey Research\b/g, "Alaska Survey Research");
}

function parseEVPDate(raw) {
  // "Sep 12" -> "2026-09-12"
  const match = /^(\w{3})\s+(\d{1,2})$/.exec(raw.trim());
  if (!match) throw new Error(`Unparseable date: ${raw}`);
  const month = MONTHS[match[1]];
  if (!month) throw new Error(`Unparseable month: ${raw}`);
  return `2026-${month}-${match[2].padStart(2, "0")}`;
}

/** Parse one electoral-vote.com CSV row into a normalized poll (or null). */
function parseEVPLine(line, lineNo) {
  const cols = line.split(",");
  const state = (cols[2] ?? "").trim();
  const demRaw = (cols[4] ?? "").trim();
  const gopRaw = (cols[5] ?? "").trim();
  const indRaw = (cols[6] ?? "").trim();
  const pollster = cleanPollster(cols[cols.length - 1]);
  if (!state || !STATE_FIPS[state]) return null;
  if (pollster.startsWith("Election 2020")) return null; // result placeholder

  let dem = Number.parseFloat(demRaw);
  const gop = Number.parseFloat(gopRaw);
  const ind = Number.parseFloat(indRaw);
  if (!Number.isFinite(dem)) dem = 0;
  if (!Number.isFinite(gop)) throw new Error(`Bad GOP share (line ${lineNo})`);
  // Nebraska runs an independent challenger with no Democrat on the ballot;
  // record that challenger in the d column so the seat isn't shown as
  // R +~50.
  if (dem === 0 && Number.isFinite(ind) && ind > 0) dem = ind;

  return {
    pollster,
    date: parseEVPDate(cols[7] ?? ""),
    d: Math.round(dem),
    r: Math.round(gop),
  };
}

function parseEVPCsv(text) {
  const data = {};
  const lines = text.split(/\r?\n/);
  for (let i = 1; i < lines.length; i += 1) {
    if (!lines[i].trim()) continue;
    const poll = parseEVPLine(lines[i], i + 1);
    if (!poll) continue;
    const fips = STATE_FIPS[lines[i].split(",")[2].trim()];
    (data[fips] ??= []).push(poll);
  }
  return data;
}

/** Normalize a supplement/Wikipedia poll into the compiled shape. */
function normalizeSupplementPoll(poll) {
  const population = poll.population === "V" ? "RV" : poll.population;
  const out = {
    pollster: cleanPollster(poll.pollster),
    date: poll.date,
    d: poll.d,
    r: poll.r,
  };
  if (poll.sample != null) out.sample = poll.sample;
  if (population === "LV" || population === "RV" || population === "A") {
    out.population = population;
  }
  return out;
}

function loadSupplement() {
  if (!existsSync(SUPPLEMENT)) return {};
  const raw = JSON.parse(readFileSync(SUPPLEMENT, "utf8"));
  const data = {};
  for (const [fips, polls] of Object.entries(raw)) {
    if (fips === "note") continue;
    data[fips] = polls.map(normalizeSupplementPoll);
  }
  return data;
}

/** The Wikipedia scrape (scripts/fetch-wiki-polls.mjs), normalized. */
function loadWiki() {
  if (!existsSync(WIKI)) return {};
  const raw = JSON.parse(readFileSync(WIKI, "utf8"));
  const data = {};
  for (const [fips, polls] of Object.entries(raw)) {
    data[fips] = polls.map(normalizeSupplementPoll);
  }
  return data;
}

/**
 * Wikipedia is the primary polling source: it lists the actual nominee
 * matchup and carries sample sizes. electoral-vote.com (plus the hand-checked
 * supplement) fills only the seats Wikipedia has no general-election polls
 * for, since the two sources can otherwise disagree about the head-to-head.
 */
function overlayWiki(base, wiki) {
  const data = { ...base };
  for (const [fips, polls] of Object.entries(wiki)) {
    if (polls.length > 0) data[fips] = polls;
  }
  return data;
}

function compileFromEVP(csvPath) {
  const evp = parseEVPCsv(readFileSync(resolve(ROOT, csvPath), "utf8"));
  const supplement = loadSupplement();
  const data = {};
  for (const fips of Object.keys(evp)) {
    data[fips] = [...(data[fips] ?? []), ...evp[fips]];
  }
  for (const [fips, polls] of Object.entries(supplement)) {
    data[fips] = [...(data[fips] ?? []), ...polls];
  }
  return data;
}

function validate(data) {
  for (const [fips, polls] of Object.entries(data)) {
    if (!/^\d{2}$/.test(fips)) throw new Error(`Bad FIPS key: ${fips}`);
    if (!Array.isArray(polls) || polls.length === 0)
      throw new Error(`No polls for ${fips}`);
    for (const poll of polls) {
      if (!poll.pollster) throw new Error(`Missing pollster for ${fips}`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(poll.date))
        throw new Error(`Bad date for ${fips}: ${poll.date}`);
      for (const key of ["d", "r"]) {
        if (!Number.isInteger(poll[key]) || poll[key] < 0 || poll[key] > 100)
          throw new Error(`Bad ${key} for ${fips}: ${poll[key]}`);
      }
      if (poll.d + poll.r > 100)
        throw new Error(`Shares exceed 100 for ${fips}`);
    }
  }
}

const SOURCE_HEADER = [
  "Sources:",
  "  - Wikipedia per-seat general-election polling tables (the primary source),",
  "    scraped for all 35 seats; see scripts/fetch-wiki-polls.mjs and",
  "    scripts/senate-polls-wiki.json.",
  "  - electoral-vote.com Senate polls",
  "    (https://electoral-vote.com/evp2026/Senate/senate_polls.html), used for",
  "    seats Wikipedia has no general-election polls for; fetched September 24,",
  "    2026.",
  "  - Hand-checked Wikipedia polls for Kentucky, Idaho, Oklahoma and Tennessee",
  "    (scripts/senate-polls-supplement.json).",
  "",
  "Notes:",
  "  - Each seat is taken from one coherent source, so the head-to-head does",
  "    not mix candidate matchups: Wikipedia where it has polls, otherwise",
  "    electoral-vote.com plus the supplement.",
  "  - Only states with at least one real poll are listed; the rest render",
  "    grey. Colorado, Delaware, Illinois, New Jersey, Oregon, West Virginia",
  "    and Wyoming have no public 2026 general-election polling.",
  "  - Nebraska's d column is the independent challenger Dan Osborn; the",
  "    state has no Democratic nominee, so its d share is Osborn's.",
  "  - electoral-vote.com rows carry no sample size; Wikipedia rows usually do.",
];


function render(data) {
  const latest = Object.values(data)
    .flat()
    .map((poll) => poll.date)
    .sort()
    .at(-1);
  const parts = [
    "/**",
    " * 2026 U.S. Senate general-election polling, committed so the app stays",
    " * hermetic (no runtime polling API).",
    " *",
    ...SOURCE_HEADER.map((line) => (line === "" ? " *" : ` * ${line}`)),
    " *",
    " * Regenerate with `npm run build:polls` (see scripts/build-polls.mjs).",
    " * Keyed by the two-digit state FIPS code used by states.json.",
    " */",
    "export interface SenatePoll {",
    "  /** Pollster or sponsor that released the poll. */",
    "  pollster: string;",
    "  /** Last day the poll was in the field, ISO YYYY-MM-DD. */",
    "  date: string;",
    "  /** Democratic candidate's share of the vote, percent. */",
    "  d: number;",
    "  /** Republican candidate's share of the vote, percent. */",
    "  r: number;",
    "  /** Number of respondents, when reported. */",
    "  sample?: number;",
    "  /** Likely voters, registered voters, or all adults. */",
    "  population?: \"LV\" | \"RV\" | \"A\";",
    "}",
    "",
    "/** Date of the most recent poll in the committed snapshot. */",
    `export const SENATE_POLLS_AS_OF = ${JSON.stringify(latest)};`,
    "",
    "export const SENATE_2026_POLLS: Record<string, SenatePoll[]> = {",
  ];

  const fipsKeys = Object.keys(data).sort();
  for (const fips of fipsKeys) {
    const polls = [...data[fips]].sort((a, b) => b.date.localeCompare(a.date));
    parts.push(`  "${fips}": [`);
    for (const poll of polls) {
      const bits = [
        `pollster: ${JSON.stringify(poll.pollster)}`,
        `date: ${JSON.stringify(poll.date)}`,
        `d: ${poll.d}`,
        `r: ${poll.r}`,
      ];
      if (poll.sample != null) bits.push(`sample: ${poll.sample}`);
      if (poll.population != null)
        bits.push(`population: ${JSON.stringify(poll.population)}`);
      parts.push(`    { ${bits.join(", ")} },`);
    }
    parts.push("  ],");
  }
  parts.push("};", "");
  return parts.join("\n");
}

function main() {
  const evpArgIndex = process.argv.indexOf("--evp");
  let base;
  if (evpArgIndex !== -1) {
    const csvPath = process.argv[evpArgIndex + 1];
    if (!csvPath) throw new Error("--evp requires a CSV path");
    base = compileFromEVP(csvPath);
    validate(base);
    const json = {
      sources: [
        "electoral-vote.com Senate polls (senate_polls.csv), fetched 2026-09-24",
        "Wikipedia general-election polling (Kentucky, Idaho, Oklahoma, Tennessee)",
      ],
      notes:
        "The electoral-vote.com + supplement base. Wikipedia polls scraped " +
        "across all 35 seats (scripts/senate-polls-wiki.json) are layered on " +
        "top of this at build time. States with no public 2026 general-election " +
        "polling are omitted. Nebraska's d column is the independent challenger " +
        "Dan Osborn.",
      polls: base,
    };
    writeFileSync(JSON_OUT, `${JSON.stringify(json, null, 2)}\n`);
    console.log(`Wrote ${JSON_OUT}.`);
  } else {
    const json = JSON.parse(readFileSync(JSON_OUT, "utf8"));
    base = json.polls;
  }

  const data = overlayWiki(base, loadWiki());
  validate(data);
  writeFileSync(TS_OUT, render(data));
  const count = Object.values(data).reduce((n, polls) => n + polls.length, 0);
  console.log(
    `Wrote ${TS_OUT} (${Object.keys(data).length} states, ${count} polls).`,
  );
}

main();