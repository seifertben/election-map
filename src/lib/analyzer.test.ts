import { describe, expect, it } from "vitest";
import {
  adjustComposition,
  analyze,
  analyzeDimension,
  compositionMap,
  initialSplits,
  normalizeShares,
  scenarioFromComposition,
  winnerOf,
} from "./analyzer";
import type { CompositionMap, GeographyComposition, Splits } from "./analyzer";

const COMPOSITION: GeographyComposition = {
  population: 1000,
  votingAgePopulation: 800,
  sex: { male: 0.6, female: 0.4 },
  age: { "18-29": 0.25, "30-44": 0.25, "45-64": 0.25, "65+": 0.25 },
  race: {
    white: 0.5,
    black: 0.2,
    hispanic: 0.2,
    asian: 0.05,
    other: 0.05,
  },
  education: {
    "no-hs": 0.25,
    hs: 0.25,
    "some-college": 0.25,
    "bachelors-plus": 0.25,
  },
};

const SPLITS: Splits = {
  sex: { male: { d: 60, r: 40 }, female: { d: 40, r: 60 } },
  age: {
    "18-29": { d: 65, r: 35 },
    "30-44": { d: 55, r: 45 },
    "45-64": { d: 45, r: 55 },
    "65+": { d: 35, r: 65 },
  },
  race: {
    white: { d: 40, r: 60 },
    black: { d: 80, r: 20 },
    hispanic: { d: 60, r: 40 },
    asian: { d: 55, r: 45 },
    other: { d: 50, r: 50 },
  },
  education: {
    "no-hs": { d: 55, r: 45 },
    hs: { d: 45, r: 55 },
    "some-college": { d: 50, r: 50 },
    "bachelors-plus": { d: 60, r: 40 },
  },
};

describe("normalizeShares", () => {
  it("scales shares to sum to 1", () => {
    const result = normalizeShares({ a: 2, b: 6, c: 2 });
    expect(result.a).toBeCloseTo(0.2);
    expect(result.b).toBeCloseTo(0.6);
    expect(result.c).toBeCloseTo(0.2);
  });

  it("returns a copy when there is no weight", () => {
    expect(normalizeShares({ a: 0, b: 0 })).toEqual({ a: 0, b: 0 });
  });
});

describe("initialSplits", () => {
  it("is stable for a seed and varies across seeds", () => {
    expect(initialSplits("x")).toEqual(initialSplits("x"));
    expect(initialSplits("x").sex.male.d).not.toBe(
      initialSplits("y").sex.male.d,
    );
  });

  it("gives every category a valid, complementary split", () => {
    const splits = initialSplits();
    for (const dimension of Object.values(splits)) {
      for (const split of Object.values(dimension)) {
        expect(split.d).toBeGreaterThanOrEqual(30);
        expect(split.d).toBeLessThanOrEqual(70);
        expect(split.d + split.r).toBeCloseTo(100);
      }
    }
  });
});

describe("analyze", () => {
  it("averages a single dimension by its composition", () => {
    const result = analyze(compositionMap(COMPOSITION), ["sex"], SPLITS);
    expect(result.d).toBeCloseTo(0.6 * 60 + 0.4 * 40);
    expect(result.r).toBeCloseTo(100 - result.d);
    expect(result.segments).toHaveLength(2);
  });

  it("averages the enabled dimensions' standalone results", () => {
    const comp = compositionMap(COMPOSITION);
    const combined = analyze(comp, ["sex", "age"], SPLITS);
    const sex = analyzeDimension(comp, "sex", SPLITS);
    const age = analyzeDimension(comp, "age", SPLITS);
    expect(combined.d).toBeCloseTo((sex.d + age.d) / 2);
  });

  it("normalizes shares that don't total 100%", () => {
    const comp: CompositionMap = {
      sex: { male: 0.6, female: 0.2 },
      age: { "18-29": 1 },
      race: { white: 1 },
      education: { hs: 1 },
    };
    // Male 0.6 and female 0.2 normalize to 0.75 / 0.25.
    const result = analyze(comp, ["sex"], SPLITS);
    expect(result.d).toBeCloseTo(0.75 * 60 + 0.25 * 40);
  });

  it("returns an even tossup with no dimensions enabled", () => {
    const result = analyze(compositionMap(COMPOSITION), [], SPLITS);
    expect(result.d).toBe(50);
    expect(result.winner).toBe("TOSS");
    expect(result.segments).toHaveLength(0);
  });

  it("builds one segment per cross-product entry", () => {
    const result = analyze(compositionMap(COMPOSITION), ["sex", "race"], SPLITS);
    expect(result.segments).toHaveLength(2 * 5);
    const total = result.segments.reduce((s, seg) => s + seg.share, 0);
    expect(total).toBeCloseTo(1);
  });
});

describe("scenarioFromComposition and adjustComposition", () => {
  it("copies a composition into normalized editable shares", () => {
    const scenario = scenarioFromComposition(COMPOSITION);
    expect(Object.values(scenario.sex).reduce((s, v) => s + v, 0)).toBeCloseTo(1);
    expect(scenario.sex.male).toBeCloseTo(0.6);
  });

  it("applies a scenario shift to a district proportionally", () => {
    const base: CompositionMap = {
      sex: { male: 0.5, female: 0.5 },
      age: { "18-29": 1 },
      race: { white: 1 },
      education: { "no-hs": 1 },
    };
    const scenario: CompositionMap = {
      sex: { male: 0.6, female: 0.4 },
      age: { "18-29": 1 },
      race: { white: 1 },
      education: { "no-hs": 1 },
    };
    const district: CompositionMap = {
      sex: { male: 0.5, female: 0.5 },
      age: { "18-29": 1 },
      race: { white: 1 },
      education: { "no-hs": 1 },
    };
    const adjusted = adjustComposition(district, base, scenario);
    expect(adjusted.sex.male).toBeCloseTo(0.6);
    expect(adjusted.sex.female).toBeCloseTo(0.4);
  });
});

describe("winnerOf", () => {
  it("picks the leader, with near-ties as tossups", () => {
    expect(winnerOf(52, 48)).toBe("D");
    expect(winnerOf(48, 52)).toBe("R");
    expect(winnerOf(50, 50)).toBe("TOSS");
  });
});
