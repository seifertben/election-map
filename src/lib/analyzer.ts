/**
 * Demographic model behind the State Analyzer.
 *
 * The electorate is split along four dimensions (sex, age, race, education).
 * Every category carries a partisan split (how that group votes D vs R), and
 * every geography carries a composition (what share of the electorate falls in
 * each category) from the American Community Survey. A geography's projected
 * result is built from the cross product of the enabled dimensions: segment
 * shares are the product of the category shares (treating the dimensions as
 * independent), and a segment's vote is the mean of its categories' splits.
 */

export type DimensionId = "sex" | "age" | "race" | "education" | "party";

export interface DemographicCategory {
  id: string;
  label: string;
  /** Short label for dense controls. */
  short: string;
}

export interface DemographicDimension {
  id: DimensionId;
  label: string;
  categories: DemographicCategory[];
}

export const DIMENSIONS: DemographicDimension[] = [
  {
    id: "sex",
    label: "Sex",
    categories: [
      { id: "male", label: "Men", short: "Men" },
      { id: "female", label: "Women", short: "Women" },
    ],
  },
  {
    id: "age",
    label: "Age",
    categories: [
      { id: "18-29", label: "18–29", short: "18–29" },
      { id: "30-44", label: "30–44", short: "30–44" },
      { id: "45-64", label: "45–64", short: "45–64" },
      { id: "65+", label: "65+", short: "65+" },
    ],
  },
  {
    id: "race",
    label: "Race / ethnicity",
    categories: [
      { id: "white", label: "White (non-Hispanic)", short: "White" },
      { id: "black", label: "Black", short: "Black" },
      { id: "hispanic", label: "Hispanic", short: "Hispanic" },
      { id: "asian", label: "Asian", short: "Asian" },
      { id: "other", label: "Other", short: "Other" },
    ],
  },
  {
    id: "education",
    label: "Education",
    categories: [
      { id: "no-hs", label: "No high school diploma", short: "No HS" },
      { id: "hs", label: "High school", short: "HS" },
      { id: "some-college", label: "Some college", short: "Some college" },
      {
        id: "bachelors-plus",
        label: "Bachelor's or higher",
        short: "Bachelor's+",
      },
    ],
  },
  {
    id: "party",
    label: "Party ID",
    categories: [
      { id: "democrat", label: "Democrat", short: "Dem" },
      { id: "republican", label: "Republican", short: "Rep" },
      { id: "independent", label: "Independent / other", short: "Ind" },
    ],
  },
];

export const DIMENSION_BY_ID: Record<DimensionId, DemographicDimension> =
  Object.fromEntries(DIMENSIONS.map((d) => [d.id, d])) as Record<
    DimensionId,
    DemographicDimension
  >;

/** Census composition for a state or House district. */
export interface GeographyComposition {
  population: number;
  votingAgePopulation: number;
  sex: Record<string, number>;
  age: Record<string, number>;
  race: Record<string, number>;
  education: Record<string, number>;
  /** Party identification (Democrat/Republican/Independent), from the CES. */
  party: Record<string, number>;
}

export interface DemographicsData {
  release: string;
  source: string;
  fetched: string;
  states: Record<string, GeographyComposition>;
  districts: Record<string, GeographyComposition>;
}

/** Category shares by dimension; each inner record sums to 1. */
export type CompositionMap = Record<DimensionId, Record<string, number>>;

export interface Split {
  /** Democratic share of the group, percent. */
  d: number;
  /** Republican share of the group, percent. */
  r: number;
  /** Third-party / other share of the group, percent. d + r + o = 100. */
  o: number;
}

export type Splits = Record<DimensionId, Record<string, Split>>;

export interface Segment {
  /** Category id per enabled dimension, joined as `dim:cat|...`. */
  key: string;
  parts: { dimension: DimensionId; category: string }[];
  /** Share of the electorate, 0..1. */
  share: number;
  d: number;
  r: number;
  o: number;
}

export interface AnalyzerResult {
  d: number;
  r: number;
  /** Third-party / other share, percent. */
  o: number;
  margin: number;
  winner: "D" | "R" | "TOSS";
  segments: Segment[];
}

export function compositionMap(comp: GeographyComposition): CompositionMap {
  return {
    sex: comp.sex,
    age: comp.age,
    race: comp.race,
    education: comp.education,
    party: comp.party ?? {},
  };
}

/** Normalize a record of shares so it sums to 1 (returns a copy). */
export function normalizeShares(shares: Record<string, number>): Record<string, number> {
  const total = Object.values(shares).reduce((a, b) => a + b, 0);
  if (total <= 0) return { ...shares };
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(shares)) {
    result[key] = value / total;
  }
  return result;
}

// --- Seeded randomness ------------------------------------------------------

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Random per-category vote splits, stable for a given seed. This stands in for
 * a loaded poll's crosstabs until poll loading is wired up.
 */
export function initialSplits(
  seed = "state-analyzer",
  spread = 0.4,
): Splits {
  const result = {} as Splits;
  for (const dimension of DIMENSIONS) {
    result[dimension.id] = {};
    for (const category of dimension.categories) {
      const random = mulberry32(xmur3(`${seed}:${dimension.id}:${category.id}`)());
      const d = (0.5 - spread / 2 + random() * spread) * 100;
      result[dimension.id][category.id] = {
        d: Math.round(d * 10) / 10,
        r: Math.round((100 - d) * 10) / 10,
        o: 0,
      };
    }
  }
  return result;
}

/** The census composition turned into an editable scenario copy. */
export function scenarioFromComposition(comp: GeographyComposition): CompositionMap {
  const map = compositionMap(comp);
  const result = {} as CompositionMap;
  for (const dimension of DIMENSIONS) {
    result[dimension.id] = normalizeShares(map[dimension.id] ?? {});
  }
  return result;
}

/**
 * Apply the statewide scenario to a district: each category is scaled by how
 * much the scenario changed it relative to the census state baseline, then
 * renormalized. A district therefore inherits the scenario proportionally.
 */
export function adjustComposition(
  district: CompositionMap,
  base: CompositionMap,
  scenario: CompositionMap,
): CompositionMap {
  const result = {} as CompositionMap;
  for (const dimension of DIMENSIONS) {
    const dist = district[dimension.id] ?? {};
    const baseline = base[dimension.id] ?? {};
    const target = scenario[dimension.id] ?? {};
    const scaled: Record<string, number> = {};
    for (const category of dimension.categories) {
      const ratio = baseline[category.id] > 0 ? target[category.id] / baseline[category.id] : 1;
      scaled[category.id] = (dist[category.id] ?? 0) * ratio;
    }
    result[dimension.id] = normalizeShares(scaled);
  }
  return result;
}

// --- Result math ------------------------------------------------------------

export function winnerOf(d: number, r: number): "D" | "R" | "TOSS" {
  const margin = d - r;
  if (Math.abs(margin) < 0.05) return "TOSS";
  return margin > 0 ? "D" : "R";
}

/**
 * Project a result from a composition and the per-category splits, over the
 * enabled dimensions. The result is the average of each enabled dimension's
 * standalone result, which falls out of averaging the categories within each
 * cross-product segment.
 */
export function analyze(
  composition: CompositionMap,
  enabled: DimensionId[],
  splits: Splits,
): AnalyzerResult {
  const dimensions = enabled.filter((id) => composition[id]);
  if (dimensions.length === 0) {
    return { d: 50, r: 50, o: 0, margin: 0, winner: "TOSS", segments: [] };
  }

  interface Working {
    key: string;
    parts: { dimension: DimensionId; category: string }[];
    share: number;
  }

  let working: Working[] = [{ key: "", parts: [], share: 1 }];
  for (const dimensionId of dimensions) {
    // Shares are independent editable values and need not total 100%; they are
    // normalized here so the projection treats them as relative weights.
    const shares = normalizeShares(composition[dimensionId]);
    const next: Working[] = [];
    for (const segment of working) {
      for (const [category, share] of Object.entries(shares)) {
        if (share <= 0) continue;
        next.push({
          key: segment.key
            ? `${segment.key}|${dimensionId}:${category}`
            : `${dimensionId}:${category}`,
          parts: [...segment.parts, { dimension: dimensionId, category }],
          share: segment.share * share,
        });
      }
    }
    working = next;
  }

  const segments: Segment[] = working.map((segment) => {
    const count = segment.parts.length || 1;
    let d = 0;
    let r = 0;
    let o = 0;
    for (const part of segment.parts) {
      d += splits[part.dimension]?.[part.category]?.d ?? 50;
      r += splits[part.dimension]?.[part.category]?.r ?? 50;
      o += splits[part.dimension]?.[part.category]?.o ?? 0;
    }
    return { ...segment, d: d / count, r: r / count, o: o / count };
  });

  let d = 0;
  let r = 0;
  let o = 0;
  for (const segment of segments) {
    d += segment.share * segment.d;
    r += segment.share * segment.r;
    o += segment.share * segment.o;
  }
  return {
    d,
    r,
    o,
    margin: d - r,
    winner: winnerOf(d, r),
    segments,
  };
}

/** Project a single dimension on its own, for the per-dimension readouts. */
export function analyzeDimension(
  composition: CompositionMap,
  dimension: DimensionId,
  splits: Splits,
): AnalyzerResult {
  return analyze(composition, [dimension], splits);
}

const MARGIN_CAP = 15;

/** Map a D-R margin to a position on the poll scale, in [-1, 1]. */
export function marginStrength(margin: number): number {
  return Math.max(-1, Math.min(1, -margin / MARGIN_CAP));
}
