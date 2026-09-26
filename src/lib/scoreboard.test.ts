import { describe, expect, it } from "vitest";
import { GOVERNOR_2026_FIPS } from "../data/governor2026";
import { SENATE_2026_FIPS } from "../data/senate2026";
import {
  chamberSeats,
  governorScore,
  houseScore,
  presidentScore,
  senateScore,
} from "./scoreboard";

describe("presidentScore", () => {
  it("weights states by electoral votes", () => {
    const score = presidentScore({ "06": "D", "48": "R" });
    expect(score.total).toBe(538);
    expect(score.headline.D).toBe(54);
    expect(score.headline.R).toBe(40);
    expect(score.majority).toBe(270);
  });

  it("counts unreported electoral votes as other", () => {
    const score = presidentScore({ "06": "D" });
    expect(score.headline.other).toBe(538 - 54);
  });
});

describe("houseScore", () => {
  it("counts districts by party", () => {
    const score = houseScore({ a: "D", b: "D", c: "R", d: "TOSS" });
    expect(score.total).toBe(435);
    expect(score.majority).toBe(218);
    expect(score.headline.D).toBe(2);
    expect(score.headline.R).toBe(1);
    expect(score.headline.other).toBe(432);
  });

  it("rolls rating tones up into their base party", () => {
    const score = houseScore({
      a: "SOLID_D",
      b: "LIKELY_D",
      c: "LEAN_D",
      d: "LEAN_R",
      e: "LIKELY_R",
      f: "SOLID_R",
      g: "TOSS",
    });
    expect(score.headline.D).toBe(3);
    expect(score.headline.R).toBe(3);
    expect(score.headline.other).toBe(429);
  });
});

describe("senateScore", () => {
  it("includes the 65 seats not up in 2026", () => {
    const score = senateScore({});
    expect(score.total).toBe(100);
    expect(score.majority).toBe(51);
    expect(score.headline.D).toBe(32);
    expect(score.headline.R).toBe(31);
    expect(score.headline.other).toBe(37);
  });

  it("adds called seats to the existing caucus counts", () => {
    const allR = Object.fromEntries(
      SENATE_2026_FIPS.map((fips) => [fips, "R"]),
    );
    const score = senateScore(allR as Record<string, "R">);
    expect(score.headline.R).toBe(31 + 35);
    expect(score.headline.other).toBe(2);
  });
});

describe("governorScore", () => {
  it("includes the 14 governorships not up in 2026", () => {
    const score = governorScore({});
    expect(score.total).toBe(50);
    expect(score.majority).toBe(26);
    expect(score.headline.D).toBe(6);
    expect(score.headline.R).toBe(8);
    expect(score.headline.other).toBe(36);
  });

  it("adds called states to the existing caucus counts", () => {
    const allR = Object.fromEntries(
      GOVERNOR_2026_FIPS.map((fips) => [fips, "R"]),
    );
    const score = governorScore(allR as Record<string, "R">);
    expect(score.headline.R).toBe(8 + 36);
    expect(score.headline.other).toBe(0);
  });
});

describe("chamberSeats", () => {
  it("maps every assigned district to a seat with its state", () => {
    const seats = chamberSeats("house", {
      "0601": "D",
      "4801": "R",
      "0101": "TOSS",
    });
    expect(seats).toEqual([
      { id: "0101", state: "AL", party: "TOSS" },
      { id: "0601", state: "CA", party: "D" },
      { id: "4801", state: "TX", party: "R" },
    ]);
  });

  it("fills the Senate to 100 seats using party lean for seats not up", () => {
    const allR = Object.fromEntries(
      SENATE_2026_FIPS.map((fips) => [fips, "R"]),
    );
    const seats = chamberSeats("senate", allR as Record<string, "R">);
    expect(seats).toHaveLength(100);
    // 35 up (all forced R) + 31 not-up R = 66; 32 not-up D and 2 I.
    expect(seats.filter((s) => s.party === "R")).toHaveLength(66);
    expect(seats.filter((s) => s.party === "D")).toHaveLength(32);
    expect(seats.filter((s) => s.party === "TOSS")).toHaveLength(2);
  });

  it("returns no seats for non-chamber modes", () => {
    expect(chamberSeats("president", { "06": "D" })).toEqual([]);
    expect(chamberSeats("governor", { "06": "D" })).toEqual([]);
  });
});
