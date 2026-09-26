import { describe, expect, it } from "vitest";
import type { Assignments } from "../types";
import { decodeHash, decodeRegions, encodeHash, encodeRegions } from "./encoding";
import type { RegionIds } from "./encoding";

const ids: RegionIds = {
  president: ["01", "02", "04"],
  senate: ["01", "02"],
  governor: ["04", "06"],
  house: ["0101", "0102", "0200"],
};

describe("encodeRegions / decodeRegions", () => {
  it("encodes party codes in region order and round-trips", () => {
    const assignments = { "01": "D", "04": "R" } as const;
    const encoded = encodeRegions(ids.president, assignments);
    expect(encoded).toBe("102");
    expect(decodeRegions(ids.president, encoded)).toEqual({
      "01": "D",
      "04": "R",
    });
  });

  it("omits cleared regions on decode", () => {
    expect(decodeRegions(ids.president, "000")).toEqual({});
  });

  it("round-trips rating tones", () => {
    const assignments = { "01": "SOLID_D", "04": "LEAN_R" } as const;
    const encoded = encodeRegions(ids.president, assignments);
    expect(encoded).toBe("407");
    expect(decodeRegions(ids.president, encoded)).toEqual({
      "01": "SOLID_D",
      "04": "LEAN_R",
    });
  });
});

describe("encodeHash / decodeHash", () => {
  const assignments: Assignments = {
    president: { "01": "D" },
    senate: { "02": "TOSS" },
    governor: { "04": "LEAN_R" },
    house: { "0101": "R" },
  };

  it("round-trips every map and the mode", () => {
    const hash = encodeHash(assignments, ids, "house");
    const decoded = decodeHash(hash, ids);
    expect(decoded.mode).toBe("house");
    expect(decoded.assignments.president).toEqual({ "01": "D" });
    expect(decoded.assignments.senate).toEqual({ "02": "TOSS" });
    expect(decoded.assignments.governor).toEqual({ "04": "LEAN_R" });
    expect(decoded.assignments.house).toEqual({ "0101": "R" });
  });

  it("ignores encoded strings whose length no longer matches the data", () => {
    const decoded = decodeHash("#m=senate&s=1", ids);
    expect(decoded.mode).toBe("senate");
    expect(decoded.assignments.senate).toEqual({});
  });

  it("returns a null mode for an unknown mode value", () => {
    const decoded = decodeHash("#m=mayor", ids);
    expect(decoded.mode).toBeNull();
  });
});
