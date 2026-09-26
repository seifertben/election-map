import { describe, expect, it } from "vitest";
import {
  GOVERNOR_2026_FIPS,
  GOVERNOR_2026_RACES,
  GOVERNOR_2026_RATINGS,
  GOVERNOR_RACE_BY_FIPS,
} from "./governor2026";
import { RATINGS } from "./parties";

describe("GOVERNOR_2026_RATINGS", () => {
  it("rates each of the 36 governorships on the 2026 ballot exactly once", () => {
    const ids = Object.keys(GOVERNOR_2026_RATINGS);
    expect(GOVERNOR_2026_FIPS).toHaveLength(36);
    expect(ids).toHaveLength(36);
    expect(ids.length).toBe(new Set(ids).size);
    expect([...ids].sort()).toEqual([...GOVERNOR_2026_FIPS].sort());
  });

  it("uses only valid rating values", () => {
    for (const value of Object.values(GOVERNOR_2026_RATINGS)) {
      expect(RATINGS).toContain(value);
    }
  });

  it("lists each contested state's incumbent party once", () => {
    expect(GOVERNOR_2026_RACES).toHaveLength(36);
    for (const race of GOVERNOR_2026_RACES) {
      expect(GOVERNOR_RACE_BY_FIPS[race.fips]).toBe(race);
      expect(["D", "R", "I"]).toContain(race.incumbentParty);
    }
    const d = GOVERNOR_2026_RACES.filter((r) => r.incumbentParty === "D").length;
    const r = GOVERNOR_2026_RACES.filter((r) => r.incumbentParty === "R").length;
    expect(d + r).toBe(36);
  });
});
