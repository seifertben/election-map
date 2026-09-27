import { describe, expect, it } from "vitest";
import { splitsFromCrosstab, compositionFromCrosstab } from "./analyzerPolls";
import type { PollCrosstab } from "../data/analyzerPolls";
import type { GeographyComposition } from "./analyzer";

const CENSUS: GeographyComposition = {
  population: 1,
  votingAgePopulation: 1,
  sex: { male: 0.5, female: 0.5 },
  age: { "18-29": 0.2, "30-44": 0.25, "45-64": 0.3, "65+": 0.25 },
  race: { white: 0.6, black: 0.15, hispanic: 0.15, asian: 0.05, other: 0.05 },
  education: { "no-hs": 0.1, hs: 0.3, "some-college": 0.3, "bachelors-plus": 0.3 },
  party: { democrat: 0.4, republican: 0.35, independent: 0.25 },
};

function crosstab(overall: { d: number; r: number }): PollCrosstab {
  return {
    overall,
    sex: { male: { d: 40, r: 60 } },
    age: {},
    race: {},
    education: {},
    party: {},
    composition: [],
  };
}

function totals(crosstab: PollCrosstab): number[] {
  const splits = splitsFromCrosstab(crosstab);
  return Object.values(splits)
    .flatMap((dimension) => Object.values(dimension))
    .map((split) => split.d + split.r + split.o);
}

describe("splitsFromCrosstab", () => {
  it("fills a short split's remainder into other so it totals 100", () => {
    const splits = splitsFromCrosstab(crosstab({ d: 47, r: 47 }));
    expect(splits.race.white.o).toBeCloseTo(6);
    expect(splits.race.white.d + splits.race.white.r + splits.race.white.o).toBe(
      100,
    );
  });

  it("leaves an already-complete split with no other", () => {
    const splits = splitsFromCrosstab(crosstab({ d: 52, r: 48 }));
    expect(splits.sex.male.o).toBe(0);
  });

  it("gives every category a split that totals 100", () => {
    for (const total of totals(crosstab({ d: 46.6, r: 44.7 }))) {
      expect(total).toBeCloseTo(100);
    }
  });

  it("gives categories the poll did not break out the overall split", () => {
    const splits = splitsFromCrosstab(crosstab({ d: 45, r: 47 }));
    expect(splits.race.black.d).toBe(45);
    expect(splits.race.black.r).toBe(47);
    expect(splits.race.black.o).toBeCloseTo(8);
    // ...while a reported category keeps its own split.
    expect(splits.sex.male.d).toBe(40);
    expect(splits.sex.male.r).toBe(60);
  });
});

describe("compositionFromCrosstab", () => {
  it("falls back to the census for a poll with no composition rows", () => {
    const comp = compositionFromCrosstab([], CENSUS);
    expect(comp.race).toEqual(CENSUS.race);
    expect(comp.education).toEqual(CENSUS.education);
  });

  it("spreads a reported non-white total across the census race weights", () => {
    const comp = compositionFromCrosstab(
      [
        { group: "race", label: "White", pct: 70 },
        { group: "race", label: "Non-white", pct: 20 },
      ],
      CENSUS,
    );
    // The 20% non-white total is split over Black/Hispanic/Asian/Other in
    // proportion to the census, and White keeps its reported share.
    expect(comp.race.white).toBeCloseTo(0.7);
    const total = Object.values(comp.race).reduce((sum, v) => sum + v, 0);
    expect(total).toBeCloseTo(0.9);
  });
});
