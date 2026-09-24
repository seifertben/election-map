import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { HOUSE_2026_HOLDER } from "./house2026Holder";
import { HOUSE_2026_RATINGS } from "./house2026";
import { RATINGS } from "./parties";

describe("HOUSE_2026_RATINGS", () => {
  const parsed = JSON.parse(
    readFileSync(resolve(process.cwd(), "public/data/cd120.json"), "utf8"),
  ) as { features: { properties: { geoid: string } }[] };
  const districtIds = parsed.features.map((f) => f.properties.geoid);

  it("rates every one of the 435 voting districts exactly once", () => {
    const ids = Object.keys(HOUSE_2026_RATINGS);
    expect(districtIds).toHaveLength(435);
    expect(ids).toHaveLength(435);
    expect(ids.length).toBe(new Set(ids).size);
    expect([...ids].sort()).toEqual([...districtIds].sort());
  });

  it("uses only valid rating values", () => {
    for (const value of Object.values(HOUSE_2026_RATINGS)) {
      expect(RATINGS).toContain(value);
    }
  });
});

describe("HOUSE_2026_HOLDER", () => {
  const parsed = JSON.parse(
    readFileSync(resolve(process.cwd(), "public/data/cd120.json"), "utf8"),
  ) as { features: { properties: { geoid: string } }[] };
  const districtIds = parsed.features.map((f) => f.properties.geoid);

  it("covers every one of the 435 voting districts exactly once", () => {
    const ids = Object.keys(HOUSE_2026_HOLDER);
    expect(ids).toHaveLength(435);
    expect(ids.length).toBe(new Set(ids).size);
    expect([...ids].sort()).toEqual([...districtIds].sort());
  });

  it("uses only party holders, independents, or null for new seats", () => {
    for (const value of Object.values(HOUSE_2026_HOLDER)) {
      expect(["D", "R", "I", null]).toContain(value);
    }
  });

  it("marks only the eight new 2026 seats as having no incumbent", () => {
    const nulls = Object.entries(HOUSE_2026_HOLDER)
      .filter(([, holder]) => holder === null)
      .map(([geoid]) => geoid)
      .sort();
    expect(nulls).toEqual(["0101", "0638", "1222", "4809", "4830", "4832", "4835", "4901"]);
  });

  it("marks California 6 as the one independent-held seat", () => {
    expect(HOUSE_2026_HOLDER["0606"]).toBe("I");
  });
});