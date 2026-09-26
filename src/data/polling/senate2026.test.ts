import { describe, expect, it } from "vitest";
import { SENATE_2026_FIPS } from "../senate2026";
import { SENATE_2026_POLLS, SENATE_POLLS_AS_OF } from "./senate2026";

const entries = Object.entries(SENATE_2026_POLLS);
const everyPoll = entries.flatMap(([, polls]) => polls);

describe("SENATE_2026_POLLS", () => {
  it("only lists seats on the 2026 ballot", () => {
    const keys = Object.keys(SENATE_2026_POLLS).sort();
    expect(keys).toEqual([...SENATE_2026_FIPS].sort().filter((f) => keys.includes(f)));
    for (const fips of keys) {
      expect(SENATE_2026_FIPS).toContain(fips);
    }
  });

  it("has at least one real poll for every listed state", () => {
    for (const [fips, polls] of entries) {
      expect(polls.length, `state ${fips}`).toBeGreaterThan(0);
    }
  });

  it("documents which seats have no public polling", () => {
    // electoral-vote.com + Wikipedia turn up nothing for these safe seats.
    expect(SENATE_2026_FIPS).toHaveLength(35);
    const unpolled = SENATE_2026_FIPS.filter((f) => !SENATE_2026_POLLS[f]);
    expect(unpolled.sort()).toEqual(["08", "10", "17", "34", "41", "54", "56"]);
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
    expect(SENATE_POLLS_AS_OF).toBe(latest);
  });
});