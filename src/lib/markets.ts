import { GOVERNOR_2026_FIPS } from "../data/governor2026";
import { HOUSE_2026_FIPS } from "../data/house2026";
import { SENATE_2026_FIPS } from "../data/senate2026";
import { STATES } from "../data/states";
import { colorForStrength } from "./polling";
import type { PollOverlay, PollSummary } from "./polling";

/** The "no market overlay" placeholder — the ratings map is shown. */
export const MARKET_NONE_ID = "";

/** Modes that can show a live market overlay. */
export type MarketMode = "senate" | "house" | "governor";

/** How often an active market source is refetched while selected. */
export const MARKET_REFRESH_MS = 30_000;

/** A candidate's implied win probability, taken from a market's Yes price. */
export interface MarketFavorite {
  name: string;
  /** The candidate's party code when the market labels it, else null. */
  party: string | null;
  /** Implied win probability, 0..1. */
  price: number;
}

/**
 * One race's live market read. `fips` is the map's region id: a state FIPS for
 * Senate/Governor, or a district GEOID for the House.
 */
export interface MarketQuote {
  fips: string;
  /** Combined implied probability (0..1) the seat goes Democratic. */
  d: number;
  /** Combined implied probability (0..1) the seat goes Republican. */
  r: number;
  /** Top-priced candidate, for the tooltip. */
  favorite: MarketFavorite | null;
  /** ISO timestamp of the market's last update. */
  updatedAt: string;
}

export interface MarketSnapshot {
  /** Live quotes by state FIPS. Races without usable data are omitted. */
  quotes: Record<string, MarketQuote>;
  /** Most recent ISO update across the quotes, or "" when empty. */
  asOf: string;
}

export interface MarketSource {
  id: string;
  label: string;
  url: string;
  /** Fetches the current snapshot; rejects on network/API errors. */
  fetch: (signal?: AbortSignal) => Promise<MarketSnapshot>;
}

const STATE_FIPS_BY_NAME: Record<string, string> = Object.fromEntries(
  STATES.map((state) => [state.name.toLowerCase(), state.fips]),
);

const STATE_FIPS_BY_ABBR: Record<string, string> = Object.fromEntries(
  STATES.map((state) => [state.abbr.toUpperCase(), state.fips]),
);

/** Polymarket groups the 2026 races under this tag ("Senate Elections"). */
const POLYMARKET_SENATE_TAG_ID = "104093";

/** Polymarket's tag for the 2026 governor races ("Governor Elections"). */
const POLYMARKET_GOVERNOR_TAG_ID = "104094";

/** Polymarket's tag for the 2026 House races ("House Elections"). */
const POLYMARKET_HOUSE_TAG_ID = "103899";

const GAMMA_BASE = "https://gamma-api.polymarket.com";

/** The winner event title patterns, e.g. "Georgia Senate Election Winner". */
const WINNER_TITLE = /^(.+?) Senate Election Winner\s*$/;
const GOVERNOR_WINNER_TITLE = /^(.+?) Governor Election Winner\s*$/;
/**
 * House winner events are titled by district, e.g. "TX-05 House Election
 * Winner" or "AK-AL House Election Winner". A few seats (California's 40th)
 * only carry the "(Individual)" variant.
 */
const HOUSE_WINNER_TITLE =
  /^([A-Za-z]{2})-(\d{1,2}|AL) House Election Winner(?:\s*\((?:by individual|Individual)\))?\s*$/;

const PARTY_BY_LABEL: Record<string, string> = {
  D: "D",
  DEM: "D",
  DEMOCRAT: "D",
  DEMOCRATS: "D",
  DEMOCRATIC: "D",
  "DEMOCRATIC PARTY": "D",
  R: "R",
  REP: "R",
  REPUBLICAN: "R",
  REPUBLICANS: "R",
  "REPUBLICAN PARTY": "R",
  I: "I",
  IND: "I",
  INDEPENDENT: "I",
  L: "L",
  LIBERTARIAN: "L",
  G: "G",
  GREEN: "G",
};

/**
 * Some races (notably Alaska's ranked-choice field) list candidates without a
 * party tag, so their markets carry no way to total D vs R. These well-known
 * candidates are mapped explicitly; anyone else in such a race is ignored.
 */
const MARKET_PARTY_OVERRIDES: Record<string, string> = {
  "sen. dan sullivan": "R",
  "dan sullivan": "R",
  "mary peltola": "D",
};

/**
 * Polymarket's gubernatorial candidate markets list candidates without a party
 * tag, so the Democratic/Republican columns can't be totaled from the label
 * alone. This maps each race's candidates (lowercased full name, plus the
 * surname when it is unambiguous within the state) to their party, taken from
 * the Wikipedia "2026 United States gubernatorial elections" race summary.
 */
const GOVERNOR_MARKET_PARTY: Record<string, Record<string, string>> = {
  "01": { "doug jones": "D", "tommy tuberville": "R", jones: "D", tuberville: "R" },
  "02": { "dave bronson": "R", "treg taylor": "R", "bernadette wilson": "R", "jonathan kreiss-tomkins": "D", bronson: "R", taylor: "R", wilson: "R", kreisstomkins: "D" },
  "04": { "andy biggs": "R", "katie hobbs": "D", "risa lombardo": "G", biggs: "R", hobbs: "D", lombardo: "G" },
  "05": { "fredrick love": "D", "sarah huckabee sanders": "R", "colt shelby": "L", love: "D", sanders: "R", shelby: "L" },
  "06": { "xavier becerra": "D", "steve hilton": "R", becerra: "D", hilton: "R" },
  "08": { "greg lopez": "I", "victor marx": "R", "eric mulder": "L", "phil weiser": "D", lopez: "I", marx: "R", mulder: "L", weiser: "D" },
  "09": { "ryan fazio": "R", "ned lamont": "D", fazio: "R", lamont: "D" },
  "12": { "dean abrams": "I", "charles burkett": "I", "jeffrey datto": "I", "moe dimanche": "I", "frank russo": "I", "byron donalds": "R", "scott jewett": "L", "david jolly": "D", abrams: "I", burkett: "I", datto: "I", dimanche: "I", russo: "I", donalds: "R", jewett: "L", jolly: "D" },
  "13": { "keisha lance bottoms": "D", "rick jackson": "R", bottoms: "D", jackson: "R" },
  "15": { "gary cordery": "R", "josh green": "D", cordery: "R", green: "D" },
  "16": { "brad little": "R", "terri pickens": "D", "paul sand": "L", "john stegner": "I", little: "R", pickens: "D", sand: "L", stegner: "I" },
  "17": { "darren bailey": "R", "collin corbett": "I", "jb pritzker": "D", bailey: "R", corbett: "I", pritzker: "D" },
  "19": { "zach lahn": "R", "rob sand": "D", "sondra wilson": "I", lahn: "R", sand: "D", wilson: "I" },
  "20": { "cindy holscher": "D", "ty masterson": "R", holscher: "D", masterson: "R" },
  "23": { "rick bennett": "I", "robert b. charles": "R", "hannah pingree": "D", bennett: "I", charles: "R", pingree: "D" },
  "24": { "dan cox": "R", "andy ellis": "G", "wes moore": "D", cox: "R", ellis: "G", moore: "D" },
  "25": { "maura healey": "D", "andrea james": "I", "mike minogue": "R", healey: "D", james: "I", minogue: "R" },
  "26": { "jocelyn benson": "D", "douglas campbell": "G", "anthony hudson": "L", "john james": "R", benson: "D", campbell: "G", hudson: "L", james: "R" },
  "27": { "lisa demuth": "R", "amy klobuchar": "D", "steven young": "G", demuth: "R", klobuchar: "D", young: "G" },
  "31": { "jim pillen": "R", "lynne walz": "D", pillen: "R", walz: "D" },
  "32": { "aaron ford": "D", "danielle ford": "I", "joe lombardo": "R", lombardo: "R" },
  "33": { "kelly ayotte": "R", "cinde warmington": "D", ayotte: "R", warmington: "D" },
  "35": { "deb haaland": "D", "gregg hull": "R", haaland: "D", hull: "R" },
  "36": { "bruce blakeman": "R", "kathy hochul": "D", blakeman: "R", hochul: "D" },
  "39": { "amy acton": "D", "donald kissick": "L", "vivek ramaswamy": "R", acton: "D", kissick: "L", ramaswamy: "R" },
  "40": { "robert brooks sr.": "I", "orlando bush": "I", "jerry griffin": "I", "mike mazzei": "R", "cyndi munson": "D", sr: "I", bush: "I", griffin: "I", mazzei: "R", munson: "D" },
  "41": { "christine drazan": "R", "tina kotek": "D", drazan: "R", kotek: "D" },
  "42": { "stacy garrity": "R", "ken krawchuk": "L", "josh shapiro": "D", garrity: "R", krawchuk: "L", shapiro: "D" },
  "44": { "ken block": "I", "jasjit gotra": "I", "cd reynolds": "I", "helena foulkes": "D", "aaron guckian": "R", block: "I", gotra: "I", reynolds: "I", foulkes: "D", guckian: "R" },
  "45": { "walid hakim": "G", "jermaine johnson": "D", "alan wilson": "R", hakim: "G", johnson: "D", wilson: "R" },
  "46": { "dan ahlers": "D", "larry rhoden": "R", ahlers: "D", rhoden: "R" },
  "47": { "misam abidi": "I", "santiago asconape": "I", "dean brewer": "I", "ray brown": "I", "taylor hafley": "I", "david hatley": "I", "wendell jackson": "I", "charles van morgan": "I", "eddie lee murphy": "I", "lauren pinkston": "I", "karl smithson": "I", "l. webb taylor": "I", "robert vick": "I", "marsha blackburn": "R", "jerri green": "D", abidi: "I", asconape: "I", brewer: "I", brown: "I", hafley: "I", hatley: "I", jackson: "I", morgan: "I", murphy: "I", pinkston: "I", smithson: "I", taylor: "I", vick: "I", blackburn: "R", green: "D" },
  "48": { "greg abbott": "R", "pat dixon": "L", "gina hinojosa": "D", abbott: "R", dixon: "L", hinojosa: "D" },
  "50": { "amanda janoo": "D", "brian judd": "I", "phil scott": "R", janoo: "D", judd: "I", scott: "R" },
  "55": { "david crowley": "D", "tom tiffany": "R", crowley: "D", tiffany: "R" },
  "56": { "eric barlow": "R", "kenneth casner": "D", barlow: "R", casner: "D" },
};

/** Party for a Governor market candidate, via the per-state override map. */
function governorPartyFromName(fips: string, label: string): string | null {
  const table = GOVERNOR_MARKET_PARTY[fips];
  if (!table) return null;
  const name = label.trim().toLowerCase();
  if (table[name]) return table[name];
  const surname = name.split(/\s+/).pop() ?? "";
  return table[surname.replace(/[^a-z]/g, "")] ?? null;
}

/**
 * Most House markets label candidates with a party tag (or a generic
 * "Democratic Party"/"Republican Party" market), but California's 40th — the
 * one seat whose winner event exists only as an "(Individual)" market — lists
 * candidates by name alone. Map those names so the race can still be totaled.
 */
const HOUSE_MARKET_PARTY: Record<string, Record<string, string>> = {
  "0640": {
    "ken calvert": "R",
    "young kim": "R",
    calvert: "R",
    kim: "R",
  },
};

/** Party for a House market candidate, via the per-district override map. */
function housePartyFromName(geoid: string, label: string): string | null {
  const table = HOUSE_MARKET_PARTY[geoid];
  if (!table) return null;
  const name = label.trim().toLowerCase();
  if (table[name]) return table[name];
  const surname = name.split(/\s+/).pop() ?? "";
  return table[surname.replace(/[^a-z]/g, "")] ?? null;
}

/**
 * Resolve a House winner event title ("TX-05", "AK-AL") to the four-digit
 * district geoid used by the map (state FIPS + two-digit district, "00" for
 * at-large seats).
 */
function houseKeyFor(match: RegExpExecArray): string | null {
  const fips = STATE_FIPS_BY_ABBR[match[1].toUpperCase()];
  if (!fips) return null;
  const district = match[2].toUpperCase();
  if (district === "AL") return `${fips}00`;
  const number = Number.parseInt(district, 10);
  if (!Number.isFinite(number)) return null;
  return `${fips}${String(number).padStart(2, "0")}`;
}

/** A subset of Polymarket's Gamma market/event fields we rely on. */
export interface GammaMarket {
  groupItemTitle?: string | null;
  outcomePrices?: string | null;
}

export interface GammaEvent {
  title?: string | null;
  updatedAt?: string | null;
  markets?: GammaMarket[] | null;
}

/**
 * Read a binary market's Yes price. Gamma encodes `outcomePrices` as a JSON
 * string (e.g. `["0.945","0.055"]`), so it must be parsed.
 */
function yesPrice(market: GammaMarket): number | null {
  if (!market.outcomePrices) return null;
  try {
    const parsed: unknown = JSON.parse(market.outcomePrices);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const value = Number(parsed[0]);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/** Party code for a market's candidate label, or null when unlabeled. */
export function partyFromLabel(label: string): string | null {
  const trimmed = label.trim();
  const paren = /\(([A-Za-z]+)\)\s*$/.exec(trimmed);
  if (paren) return PARTY_BY_LABEL[paren[1].toUpperCase()] ?? null;
  const alias = PARTY_BY_LABEL[trimmed.toUpperCase()];
  if (alias) return alias;
  return MARKET_PARTY_OVERRIDES[trimmed.toLowerCase()] ?? null;
}

/** How a tag's winner events map onto the map's region ids. */
interface MarketParseOptions {
  /** Selects the winner events and captures their region identifiers. */
  pattern: RegExp;
  /** Resolves an event-title match to a map region id, or null to skip it. */
  keyFor: (match: RegExpExecArray) => string | null;
  /** Party for a candidate the label doesn't identify, keyed by region id. */
  partyFor?: (key: string, name: string) => string | null;
}

const SENATE_PARSE: MarketParseOptions = {
  pattern: WINNER_TITLE,
  keyFor: (match) =>
    STATE_FIPS_BY_NAME[match[1].trim().toLowerCase()] ?? null,
};

const GOVERNOR_PARSE: MarketParseOptions = {
  pattern: GOVERNOR_WINNER_TITLE,
  keyFor: (match) =>
    STATE_FIPS_BY_NAME[match[1].trim().toLowerCase()] ?? null,
  partyFor: governorPartyFromName,
};

const HOUSE_PARSE: MarketParseOptions = {
  pattern: HOUSE_WINNER_TITLE,
  keyFor: houseKeyFor,
  partyFor: housePartyFromName,
};

/**
 * Fold one Gamma event into an accumulating snapshot's quotes. Winner events
 * are matched by {@link MarketParseOptions.pattern} and keyed to a map region
 * (state FIPS for Senate/Governor, district GEOID for House); candidate prices
 * are summed by party, and the top-priced candidate is kept for the tooltip.
 * Events with no priced, party-labeled candidates are skipped, and duplicated
 * events for a seat keep the one that prices the most of the field. Returns the
 * event's update timestamp when it contributed a quote, else null.
 */
function addPolymarketEvent(
  quotes: Record<string, MarketQuote>,
  event: GammaEvent,
  options: MarketParseOptions,
): string | null {
  const { pattern, keyFor, partyFor } = options;
  const match = pattern.exec(event.title ?? "");
  if (!match) return null;
  const key = keyFor(match);
  if (!key) return null;
  let d = 0;
  let r = 0;
  let favorite: MarketFavorite | null = null;
  for (const market of event.markets ?? []) {
    const price = yesPrice(market);
    if (price === null || price <= 0) continue;
    const name = (market.groupItemTitle ?? "").trim();
    if (!name) continue;
    const party = partyFromLabel(name) ?? partyFor?.(key, name) ?? null;
    if (party === "D") d += price;
    else if (party === "R") r += price;
    if (!favorite || price > favorite.price) favorite = { name, party, price };
  }
  if (d + r <= 0) return null;
  // A seat can have both a party-tagged winner event and an unlabeled
  // "(by individual)" one; keep whichever prices more of the field.
  const existing = quotes[key];
  if (existing && existing.d + existing.r >= d + r) return null;
  const updatedAt = event.updatedAt ?? "";
  quotes[key] = { fips: key, d, r, favorite, updatedAt };
  return updatedAt;
}

/**
 * Reduce Polymarket Gamma events to per-region implied probabilities.
 */
export function parsePolymarketEvents(
  events: GammaEvent[],
  options: MarketParseOptions = SENATE_PARSE,
): MarketSnapshot {
  const quotes: Record<string, MarketQuote> = {};
  let asOf = "";
  for (const event of events) {
    const updatedAt = addPolymarketEvent(quotes, event, options);
    if (updatedAt && updatedAt > asOf) asOf = updatedAt;
  }
  return { quotes, asOf };
}

async function fetchGammaPage(
  tagId: string,
  offset: number,
  signal?: AbortSignal,
): Promise<GammaEvent[]> {
  const url =
    `${GAMMA_BASE}/events?tag_id=${tagId}` +
    `&active=true&closed=false&limit=100&offset=${offset}`;
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Polymarket request failed (${response.status})`);
  }
  const body: unknown = await response.json();
  return Array.isArray(body) ? (body as GammaEvent[]) : [];
}

/** Fetch winner markets for a tag, paginating until the expected regions or
 * the tag's events are exhausted. */
async function fetchPolymarketOdds(
  tagId: string,
  options: MarketParseOptions,
  expected: number,
  signal?: AbortSignal,
  maxEvents = 500,
): Promise<MarketSnapshot> {
  // Fold each page into a running snapshot instead of re-parsing every event
  // collected so far on each page (which was quadratic and leaked CPU on the
  // House tag, whose ~4k events span up to 40 pages).
  const quotes: Record<string, MarketQuote> = {};
  let asOf = "";
  for (let offset = 0; offset < maxEvents; offset += 100) {
    const page = await fetchGammaPage(tagId, offset, signal);
    for (const event of page) {
      const updatedAt = addPolymarketEvent(quotes, event, options);
      if (updatedAt && updatedAt > asOf) asOf = updatedAt;
    }
    // Gamma caps a page at 100; stop once every race is accounted for or the
    // tag runs out of events.
    if (Object.keys(quotes).length >= expected || page.length < 100) break;
  }
  return { quotes, asOf };
}

/** Fetch all 2026 Senate winner markets from Polymarket's Gamma API. */
export function fetchPolymarketSenateOdds(
  signal?: AbortSignal,
): Promise<MarketSnapshot> {
  return fetchPolymarketOdds(
    POLYMARKET_SENATE_TAG_ID,
    SENATE_PARSE,
    SENATE_2026_FIPS.length,
    signal,
  );
}

/** Fetch all 2026 Governor winner markets from Polymarket's Gamma API. */
export function fetchPolymarketGovernorOdds(
  signal?: AbortSignal,
): Promise<MarketSnapshot> {
  return fetchPolymarketOdds(
    POLYMARKET_GOVERNOR_TAG_ID,
    GOVERNOR_PARSE,
    GOVERNOR_2026_FIPS.length,
    signal,
  );
}

/** Fetch all 2026 House winner markets from Polymarket's Gamma API. */
export function fetchPolymarketHouseOdds(
  signal?: AbortSignal,
): Promise<MarketSnapshot> {
  // The House tag interleaves 435 winner events with margin markets, so allow
  // many more pages than the Senate/Governor tags need before giving up.
  return fetchPolymarketOdds(
    POLYMARKET_HOUSE_TAG_ID,
    HOUSE_PARSE,
    HOUSE_2026_FIPS.length,
    signal,
    4000,
  );
}

const SENATE_MARKET_SOURCES: MarketSource[] = [
  {
    id: "polymarket",
    label: "Polymarket",
    url: "https://polymarket.com/predictions/elections",
    fetch: fetchPolymarketSenateOdds,
  },
];

const GOVERNOR_MARKET_SOURCES: MarketSource[] = [
  {
    id: "polymarket",
    label: "Polymarket",
    url: "https://polymarket.com/predictions/elections",
    fetch: fetchPolymarketGovernorOdds,
  },
];

const HOUSE_MARKET_SOURCES: MarketSource[] = [
  {
    id: "polymarket",
    label: "Polymarket",
    url: "https://polymarket.com/predictions/elections",
    fetch: fetchPolymarketHouseOdds,
  },
];

/** Market sources available per race mode. */
export const MARKET_SOURCES_BY_MODE: Record<MarketMode, MarketSource[]> = {
  senate: SENATE_MARKET_SOURCES,
  governor: GOVERNOR_MARKET_SOURCES,
  house: HOUSE_MARKET_SOURCES,
};

/** Senate market sources, kept for the existing Senate call sites. */
export const MARKET_SOURCES: MarketSource[] = SENATE_MARKET_SOURCES;

export const MARKET_SOURCE_BY_ID: Record<string, MarketSource> =
  Object.fromEntries(MARKET_SOURCES.map((source) => [source.id, source]));

/**
 * Position on the diverging scale for a market quote, in [-1, 1] where -1 is
 * the deepest blue and +1 the deepest red.
 *
 * A market price is already a probability, so the two parties' implied shares
 * map directly: 55/45 is a near-toss-up and stays a faint lean, while only
 * lopsided markets (roughly 80/20 and beyond) reach the deep shades. This is
 * deliberately harsher than {@link pollStrength}, which rewards a poll leader
 * for merely clearing 50%.
 */
export function marketStrength(quote: MarketQuote): number {
  const total = quote.d + quote.r;
  if (total <= 0) return 0;
  const margin = (quote.d - quote.r) / total;
  return Math.max(-1, Math.min(1, -margin));
}

/** Color for a market quote, using {@link marketStrength} to place it. */
export function marketColor(quote: MarketQuote): string {
  return colorForStrength(marketStrength(quote));
}

/** A market quote as a poll-style summary so the map can shade it. */
function quoteSummary(quote: MarketQuote): PollSummary {
  const d = quote.d * 100;
  const r = quote.r * 100;
  return {
    d,
    r,
    margin: d - r,
    leader: d >= r ? "D" : "R",
    polls: 0,
    latest: quote.updatedAt.slice(0, 10),
  };
}

/** Tooltip detail for a market quote, e.g. "Ossoff (D) 94% · D 94% / R 5% · Polymarket". */
export function describeQuote(quote: MarketQuote, sourceLabel: string): string {
  const d = Math.round(quote.d * 100);
  const r = Math.round(quote.r * 100);
  const favorite = quote.favorite;
  const name = favorite?.name ?? "";
  const tagged = /\([A-Za-z]+\)\s*$/.test(name);
  const lead = favorite
    ? `${tagged || !favorite.party ? name : `${name} (${favorite.party})`} ` +
      `${Math.round(favorite.price * 100)}% · `
    : "";
  return `${lead}D ${d}% / R ${r}% · ${sourceLabel}`;
}

/**
 * Adapt live market quotes to the map's color-overlay shape. States without a
 * usable quote are left out and fall back to the unassigned color.
 */
export function marketOverlayFor(
  quotes: Record<string, MarketQuote>,
  sourceLabel: string,
  isPainted: (id: string) => boolean,
): PollOverlay {
  const fills: Record<string, string> = {};
  for (const [fips, quote] of Object.entries(quotes)) {
    fills[fips] = marketColor(quote);
  }
  return {
    fills,
    summaryFor: (id) => (quotes[id] ? quoteSummary(quotes[id]) : null),
    optionLabel: sourceLabel,
    isPainted,
    describe: (id) => (quotes[id] ? describeQuote(quotes[id], sourceLabel) : null),
  };
}
