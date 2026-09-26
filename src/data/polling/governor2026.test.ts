import { describe, expect, it } from "vitest";
import { GOVERNOR_2026_FIPS } from "../governor2026";
import { GOVERNOR_2026_POLLS, GOVERNOR_POLLS_AS_OF } from "./governor2026";

const entries = Object.entries(GOVERNOR_2026_POLLS);
const everyPoll = entries.flatMap(([, polls]) => polls);

describe("GOVERNOR_2026_POLLS", () => {
  it("only lists states on the 2026 ballot", () => {
    for (const fips of Object.keys(GOVERNOR_2026_POLLS)) {
      expect(GOVERNOR_2026_FIPS).toContain(fips);
    }
  });

  it("has at least one real poll for every listed state", () => {
    for (const [fips, polls] of entries) {
      expect(polls.length, `state ${fips}`).toBeGreaterThan(0);
    }
  });

  it("documents which states have no public polling", () => {
    expect(GOVERNOR_2026_FIPS).toHaveLength(36);
    const unpolled = GOVERNOR_2026_FIPS.filter((f) => !GOVERNOR_2026_POLLS[f]);
    expect(unpolled.sort()).toEqual([
      "02",
      "08",
      "15",
      "27",
      "40",
      "46",
      "56",
    ]);
  });

  it("has well-formed polls with shares that do not exceed 100", () => {
    for (const poll of everyPoll) {
      expect(poll.pollster.length).toBeGreaterThan(0);
      expect(poll.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const share of [poll.d, poll.r]) {
        expect(Number.isInteger(share)).toBe(true);
        expect(share).toBeGreaterThanOrEqual(0);
        expect(share).toBeLessThanOrEqual(100);
      }
      expect(poll.d + poll.r).toBeLessThanOrEqual(100);
      if (poll.sample != null) expect(poll.sample).toBeGreaterThan(0);
    }
  });

  it("stores each state's polls newest-first", () => {
    for (const [fips, polls] of entries) {
      const dates = polls.map((poll) => poll.date);
      expect(dates, `state ${fips}`).toEqual([...dates].sort().reverse());
    }
  });

  it("dates the snapshot at the most recent poll", () => {
    const latest = everyPoll
      .map((poll) => poll.date)
      .sort()
      .at(-1);
    expect(GOVERNOR_POLLS_AS_OF).toBe(latest);
  });
});
