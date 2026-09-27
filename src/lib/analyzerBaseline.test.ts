import { describe, expect, it } from "vitest";
import { DIMENSIONS } from "./analyzer";
import { baselineSplitsForState, nationalBaselineSplits } from "./analyzerBaseline";
import { GENERIC_2026_D, PRES_2024_NATIONAL_D } from "../data/nationalDemographics";
import { STATE_SPLITS } from "../data/stateSplits";
import { STATE_LEAN } from "../data/stateLean";

const ENV_SHIFT = (GENERIC_2026_D - PRES_2024_NATIONAL_D) * 100;

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

  it("uses the fitted per-state group split, moved only by the environment", () => {
    const splits = baselineSplitsForState("06");
    const fitted = STATE_SPLITS["06"].race.hispanic * 100;
    expect(splits.race.hispanic.d).toBeCloseTo(fitted + ENV_SHIFT, 5);
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
      national.party.independent.d + lean + ENV_SHIFT,
      1,
    );
  });

  it("falls back to the national baseline for an unknown state", () => {
    const national = nationalBaselineSplits();
    const unknown = baselineSplitsForState("99");
    expect(unknown.race.white.d).toBeCloseTo(national.race.white.d + ENV_SHIFT);
  });
});
