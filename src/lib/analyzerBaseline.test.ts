import { describe, expect, it } from "vitest";
import { DIMENSIONS } from "./analyzer";
import {
  baselineSplitsForState,
  nationalBaselineSplits,
  swingFor,
} from "./analyzerBaseline";
import { NATIONAL_ENV_SHIFT } from "../data/nationalSwing";
import { STATE_SPLITS } from "../data/stateSplits";
import { STATE_LEAN } from "../data/stateLean";

describe("nationalBaselineSplits", () => {
  it("gives every category a valid two-way split", () => {
    const splits = nationalBaselineSplits();
    for (const dimension of DIMENSIONS) {
      for (const category of dimension.categories) {
        const split = splits[dimension.id][category.id];
        expect(split).toBeDefined();
        expect(split.d).toBeGreaterThanOrEqual(0);
        expect(split.d).toBeLessThanOrEqual(100);
        expect(split.o).toBe(0);
        expect(split.d + split.r).toBeCloseTo(100);
      }
    }
  });
});

describe("swingFor", () => {
  it("varies the demographic swing by subgroup", () => {
    const hispanic = swingFor("race", "hispanic");
    const white = swingFor("race", "white");
    expect(hispanic).not.toBe(white);
    expect(hispanic).toBeGreaterThan(white);
  });

  it("keeps Party ID and un-measured categories on the uniform shift", () => {
    expect(swingFor("party", "independent")).toBeCloseTo(NATIONAL_ENV_SHIFT, 5);
    expect(swingFor("race", "other")).toBeCloseTo(NATIONAL_ENV_SHIFT, 5);
  });
});

describe("baselineSplitsForState", () => {
  it("gives every category a valid split for a known state", () => {
    const splits = baselineSplitsForState("06");
    for (const dimension of DIMENSIONS) {
      for (const category of dimension.categories) {
        const split = splits[dimension.id][category.id];
        expect(split.o).toBe(0);
        expect(split.d + split.r).toBeCloseTo(100);
      }
    }
  });

  it("shifts a Democratic state further left than a Republican one", () => {
    const california = baselineSplitsForState("06");
    const wyoming = baselineSplitsForState("56");
    expect(california.race.white.d).toBeGreaterThan(wyoming.race.white.d);
  });

  it("moves each fitted group by its own subgroup swing", () => {
    const splits = baselineSplitsForState("06");
    const fitted = STATE_SPLITS["06"].race.hispanic * 100;
    expect(splits.race.hispanic.d).toBeCloseTo(
      fitted + swingFor("race", "hispanic"),
      5,
    );
  });

  it("gives modeled groups a non-uniform spread across states", () => {
    const california = baselineSplitsForState("06");
    const wyoming = baselineSplitsForState("56");
    const white = california.race.white.d - wyoming.race.white.d;
    const hispanic = california.race.hispanic.d - wyoming.race.hispanic.d;
    expect(white).not.toBeCloseTo(hispanic);
  });

  it("keeps Party ID on the uniform state-lean shift", () => {
    const splits = baselineSplitsForState("56");
    const national = nationalBaselineSplits();
    const lean = STATE_LEAN["56"] * 100;
    expect(splits.party.independent.d).toBeCloseTo(
      national.party.independent.d + lean + NATIONAL_ENV_SHIFT,
      1,
    );
  });

  it("falls back to the national baseline for an unknown state", () => {
    const national = nationalBaselineSplits();
    const unknown = baselineSplitsForState("99");
    expect(unknown.race.white.d).toBeCloseTo(
      national.race.white.d + swingFor("race", "white"),
    );
  });
});
