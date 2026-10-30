import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import type { CandidateSnapshot } from "./candidates";
import { SENATE_2026_FIPS } from "./senate2026";
import { GOVERNOR_2026_FIPS } from "./governor2026";
import { HOUSE_2026_FIPS } from "./house2026";

const snapshot = JSON.parse(readFileSync("public/data/candidates.json", "utf8")) as CandidateSnapshot;
it("covers all contested Senate, governor and House races", () => {
  expect(Object.keys(snapshot.senate).sort()).toEqual([...SENATE_2026_FIPS].sort());
  expect(Object.keys(snapshot.governor).sort()).toEqual([...GOVERNOR_2026_FIPS].sort());
  expect(Object.keys(snapshot.house).sort()).toEqual([...HOUSE_2026_FIPS].sort());
  for (const mode of ["senate", "governor", "house", "president"] as const) for (const candidates of Object.values(snapshot[mode])) {
    expect(candidates.length).toBeGreaterThan(0);
    expect(new Set(candidates.map(candidate => candidate.name)).size).toBe(candidates.length);
    for (const candidate of candidates) {
      expect(candidate.name.trim().length).toBeGreaterThan(2);
      expect(candidate.party).toBeTruthy();
      expect(new URL(candidate.source).hostname).toBe("en.wikipedia.org");
      if (candidate.photo) {
        expect(new URL(candidate.photo).protocol).toBe("https:");
        expect(candidate.photoSource).toBeTruthy();
        expect(candidate.photo).not.toMatch(/3x4\.svg|placeholder/i);
      }
    }
  }
});
it("preserves same-party and independent races, and historical presidential nominees", () => {
  expect(snapshot.house["0604"].map(candidate => candidate.partyCode)).toEqual(["D", "D"]);
  expect(snapshot.senate["31"].find(candidate => candidate.name === "Dan Osborn")?.partyCode).toBe("I");
  expect(snapshot.president["48"].map(candidate => candidate.name).sort()).toEqual(["Donald Trump", "Kamala Harris"]);
});
