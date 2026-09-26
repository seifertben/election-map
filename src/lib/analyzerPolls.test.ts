import { describe, expect, it } from "vitest";
import { splitsFromCrosstab } from "./analyzerPolls";
import type { PollCrosstab } from "../data/analyzerPolls";

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
