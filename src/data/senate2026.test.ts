import { describe, expect, it } from "vitest";
import { RATINGS } from "./parties";
import { SENATE_2026_FIPS, SENATE_2026_RATINGS } from "./senate2026";

describe("SENATE_2026_RATINGS", () => {
  it("rates each of the 35 seats on the 2026 ballot exactly once", () => {
    const ids = Object.keys(SENATE_2026_RATINGS);
    expect(SENATE_2026_FIPS).toHaveLength(35);
    expect(ids).toHaveLength(35);
    expect(ids.length).toBe(new Set(ids).size);
    expect([...ids].sort()).toEqual([...SENATE_2026_FIPS].sort());
  });

  it("uses only valid rating values", () => {
    for (const value of Object.values(SENATE_2026_RATINGS)) {
      expect(RATINGS).toContain(value);
    }
  });
});
