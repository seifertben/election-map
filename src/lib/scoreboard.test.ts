import { describe, expect, it } from "vitest";
import { SENATE_2026_FIPS } from "../data/senate2026";
import { houseScore, presidentScore, senateScore } from "./scoreboard";

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
