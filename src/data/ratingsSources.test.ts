import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RATINGS } from "./parties";
import {
  DEFAULT_RATINGS_SOURCE,
  RATING_MODES,
  RATINGS_SOURCE_BY_ID,
  RATINGS_SOURCES,
  sourceAsOf,
} from "./ratingsSources";
import { GOVERNOR_2026_FIPS } from "./governor2026";
import { SENATE_2026_FIPS } from "./senate2026";

const districtIds = (
  JSON.parse(
    readFileSync(resolve(process.cwd(), "public/data/cd120.json"), "utf8"),
  ) as { features: { properties: { geoid: string } }[] }
).features.map((f) => f.properties.geoid);

describe("RATINGS_SOURCES", () => {
  it("registers the six sources with unique ids and sane metadata", () => {
    expect(RATINGS_SOURCES.map((s) => s.id)).toEqual([
      "cook",
      "insideElections",
      "sabato",
      "splitTicket",
      "ddhq",
      "fox",
    ]);
    expect(new Set(RATINGS_SOURCES.map((s) => s.id)).size).toBe(
      RATINGS_SOURCES.length,
    );
    for (const source of RATINGS_SOURCES) {
      expect(source.label.length).toBeGreaterThan(0);
      expect(source.url).toMatch(/^https:\/\//);
      expect(source.senateAsOf).toMatch(/^\w+ \d+, 2026$/);
      expect(source.houseAsOf).toMatch(/^\w+ \d+, 2026$/);
    }
    expect(DEFAULT_RATINGS_SOURCE).toBe("cook");
    expect(RATING_MODES).toEqual(["senate", "house", "governor"]);
  });

  it("maps every registered source id back to its entry", () => {
    for (const source of RATINGS_SOURCES) {
      expect(RATINGS_SOURCE_BY_ID[source.id]).toBe(source);
    }
  });

  it("rates the same 35 Senate seats and 435 House districts as every other source", () => {
    expect(SENATE_2026_FIPS).toHaveLength(35);
    expect(districtIds).toHaveLength(435);
    for (const source of RATINGS_SOURCES) {
      const senateKeys = Object.keys(source.senate).sort();
      expect(senateKeys).toEqual([...SENATE_2026_FIPS].sort());
      const houseKeys = Object.keys(source.house).sort();
      expect(houseKeys).toEqual([...districtIds].sort());
    }
  });

  it("rates the same 36 Governor states in every source that rates governors", () => {
    expect(GOVERNOR_2026_FIPS).toHaveLength(36);
    const withGovernor = RATINGS_SOURCES.filter((s) => s.governor != null);
    // Split Ticket does not publish 2026 governor ratings.
    expect(withGovernor.length).toBeGreaterThanOrEqual(5);
    for (const source of withGovernor) {
      const keys = Object.keys(source.governor!).sort();
      expect(keys).toEqual([...GOVERNOR_2026_FIPS].sort());
    }
  });

  it("uses only valid rating values", () => {
    for (const source of RATINGS_SOURCES) {
      for (const value of [
        ...Object.values(source.senate),
        ...Object.values(source.house),
        ...Object.values(source.governor ?? {}),
      ]) {
        expect(RATINGS).toContain(value);
      }
    }
  });

  it("rates the six override districts Safe for the same party in every source", () => {
    // Seats every outlet rates Safe and that aren't on Wikipedia's
    // competitive list: the four new 2026 seats plus two mid-decade
    // redistricting flips. Direction comes from the district's design.
    const expected: Record<string, string> = {
      "0101": "SOLID_R", // Alabama 1 (new)
      "0638": "SOLID_D", // California 38 (new)
      "4830": "SOLID_D", // Texas 30 (new)
      "4901": "SOLID_D", // Utah 1 (new)
      "0601": "SOLID_D", // California 1 (flip)
      "2206": "SOLID_R", // Louisiana 6 (flip)
    };
    for (const source of RATINGS_SOURCES) {
      for (const [geoid, rating] of Object.entries(expected)) {
        expect(source.house[geoid]).toBe(rating);
      }
    }
  });

  it("exposes a publish date per mode", () => {
    for (const source of RATINGS_SOURCES) {
      expect(sourceAsOf(source, "senate")).toBe(source.senateAsOf);
      expect(sourceAsOf(source, "house")).toBe(source.houseAsOf);
      if (source.governor) {
        expect(sourceAsOf(source, "governor")).toBe(source.governorAsOf);
      }
    }
  });
});