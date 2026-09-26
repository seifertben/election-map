// Compile the committed 2026 Governor polling snapshot from real sources.
//
// The app is hermetic: it never calls a polling API at runtime, so polls are
// compiled into src/data/polling/governor2026.ts from the Wikipedia scrape
// produced by scripts/fetch-wiki-polls.mjs --governor.
//
// Usage:
//   node scripts/build-gov-polls.mjs

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const WIKI = resolve(ROOT, "scripts/governor-polls-wiki.json");
const TS_OUT = resolve(ROOT, "src/data/polling/governor2026.ts");

/** Normalize pollster names so the pollster dropdown groups them cleanly. */
const POLLSTER_RENAMES = {
  "U. of New Hampshire": "University of New Hampshire",
  "U. New Hampshire": "University of New Hampshire",
  "U. of Massachusetts": "University of Massachusetts",
  "Siena U.": "Siena College",
  "Emerson Coll.": "Emerson College",
  "Marist Coll.": "Marist College",
  "High Point U.": "High Point University",
  PPP: "Public Policy Polling",
  "The Trafalgar Group": "Trafalgar Group",
};

function cleanPollster(raw) {
  let name = raw.replace(/-\d{1,3}$/, "").trim();
  if (POLLSTER_RENAMES[name]) return POLLSTER_RENAMES[name];
  name = name.replace(/\s+\((?:R|D|I)\)\s*$/i, "").trim();
  return name
    .replace(/\bU\./g, "University")
    .replace(/\bColl\./g, "College")
    .replace(/\bRes\./g, "Research")
    .replace(/\bInst\./g, "Institute");
}

function normalizePoll(poll) {
  const out = {
    pollster: cleanPollster(poll.pollster),
    date: poll.date,
    d: poll.d,
    r: poll.r,
  };
  if (poll.sample != null) out.sample = poll.sample;
  if (["LV", "RV", "A"].includes(poll.population)) {
    out.population = poll.population;
  }
  return out;
}

function load() {
  if (!existsSync(WIKI)) return {};
  const raw = JSON.parse(readFileSync(WIKI, "utf8"));
  const data = {};
  for (const [fips, polls] of Object.entries(raw)) {
    data[fips] = polls.map(normalizePoll);
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
  "  - Wikipedia per-state general-election polling tables (the primary source),",
  "    scraped for the 36 states on the 2026 ballot; see",
  "    scripts/fetch-wiki-polls.mjs --governor and",
  "    scripts/governor-polls-wiki.json.",
  "",
  "Notes:",
  "  - Only states with at least one real poll are listed; the rest render",
  "    grey. Alaska, Colorado, Hawaii, Minnesota, Oklahoma, South Dakota and",
  "    Wyoming have no public 2026 general-election polling.",
  "  - Some Wikipedia pollster names carry a partisan (R)/(D) tag; it is",
  "    dropped so the pollster dropdown groups them.",
];

function render(data) {
  const latest = Object.values(data)
    .flat()
    .map((poll) => poll.date)
    .sort()
    .at(-1);
  const parts = [
    "/**",
    " * 2026 U.S. Governor general-election polling, committed so the app stays",
    " * hermetic (no runtime polling API).",
    " *",
    ...SOURCE_HEADER.map((line) => (line === "" ? " *" : ` * ${line}`)),
    " *",
    " * Regenerate with `npm run build:gov-polls` (see scripts/build-gov-polls.mjs).",
    " * Keyed by the two-digit state FIPS code used by states.json.",
    " */",
    "export interface GovernorPoll {",
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
    '  population?: "LV" | "RV" | "A";',
    "}",
    "",
    "/** Date of the most recent poll in the committed snapshot. */",
    `export const GOVERNOR_POLLS_AS_OF = ${JSON.stringify(latest)};`,
    "",
    "export const GOVERNOR_2026_POLLS: Record<string, GovernorPoll[]> = {",
  ];

  for (const fips of Object.keys(data).sort()) {
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
  const data = load();
  validate(data);
  writeFileSync(TS_OUT, render(data));
  const count = Object.values(data).reduce((n, polls) => n + polls.length, 0);
  console.log(
    `Wrote ${TS_OUT} (${Object.keys(data).length} states, ${count} polls).`,
  );
}

main();
