import { describe, expect, it } from "vitest";
import type { Assignments } from "../types";
import { decodeHash, decodeRegions, encodeHash, encodeRegions, encodeShareHash } from "./encoding";
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

describe("compact social map links", () => {
  it("round-trips only the selected race, including rating tones and leading clears", () => {
    const map = { "0102": "LEAN_D", "0200": "SOLID_R" } as const;
    const hash = encodeShareHash(map, ids, "house");
    const result = decodeHash(hash.replace("#", "?"), ids);
    expect(result.mode).toBe("house");
    expect(result.assignments.house).toEqual({ "0101": null, ...map });
    expect(result.assignments.senate).toEqual({});
  });

  it("keeps even a maximum-length 435-district URL below Bluesky's post limit", () => {
    const districtIds = Array.from({ length: 435 }, (_, i) => String(i));
    const houseIds = { ...ids, house: districtIds };
    const map = Object.fromEntries(districtIds.map((id) => [id, "SOLID_R" as const]));
    const hash = encodeShareHash(map, houseIds, "house");
    const url = `https://www.mapelection.com/?${hash.slice(1)}`;
    expect(url.length).toBeLessThanOrEqual(300);
    expect(decodeHash(hash, houseIds).assignments.house).toEqual(map);
  });

  it("preserves fully cleared maps both in social links and after a reload", () => {
    const shared = decodeHash(encodeShareHash({}, ids, "house"), ids);
    const emptyHouse = { "0101": null, "0102": null, "0200": null };
    expect(shared.assignments.house).toEqual(emptyHouse);
    const reloaded = decodeHash(encodeHash(shared.assignments, ids, "house"), ids);
    expect(reloaded.assignments.house).toEqual(emptyHouse);
  });

  it.each([
    "?m=house&n=4&c=B",
    "?m=house&n=3&c=%21",
    "?m=house&n=3&c=___",
    "?m=house&n=3&c=__",
    "?m=house&n=3&c=",
  ])("ignores malformed or stale snapshots: %s", (hash) => {
    expect(decodeHash(hash, ids).assignments.house).toEqual({});
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
