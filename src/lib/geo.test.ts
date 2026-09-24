import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { geoArea } from "d3-geo";
import { describe, expect, it } from "vitest";
import type { RegionFeature } from "../types";
import { createMapProjection } from "./projection";

function load(name: string): RegionFeature[] {
  const file = resolve(process.cwd(), "public/data", name);
  const parsed = JSON.parse(readFileSync(file, "utf8")) as {
    features: RegionFeature[];
  };
  return parsed.features;
}

describe("committed geography", () => {
  const districts = load("cd120.json");
  const states = load("states.json");

  it("contains exactly 435 voting congressional districts", () => {
    expect(districts).toHaveLength(435);
    const ids = new Set(districts.map((f) => f.properties.geoid));
    expect(ids.size).toBe(435);
  });

  it("contains 50 states plus DC", () => {
    expect(states).toHaveLength(51);
    expect(states.some((f) => f.properties.fips === "11")).toBe(true);
  });

  it("projects every district and state to a non-empty path", () => {
    const districtsPath = createMapProjection(districts).path;
    expect(districts.filter((f) => !districtsPath(f as never))).toHaveLength(0);
    const statesPath = createMapProjection(states).path;
    expect(states.filter((f) => !statesPath(f as never))).toHaveLength(0);
  });

  it("uses the winding order d3-geo expects (no inside-out regions)", () => {
    // Wrongly wound rings make d3-geo render each region's complement: a
    // full-viewport rectangle with the region cut out as a hole. A correctly
    // wound region covers less than a hemisphere.
    for (const f of [...states, ...districts]) {
      expect(geoArea(f as never)).toBeLessThanOrEqual(2 * Math.PI);
    }
  });
});
