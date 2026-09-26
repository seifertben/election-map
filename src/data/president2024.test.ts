import { describe, expect, it } from "vitest";
import { PARTIES } from "./parties";
import { PRESIDENT_2024_RESULTS } from "./president2024";
import { STATES, TOTAL_ELECTORAL_VOTES } from "./states";

describe("PRESIDENT_2024_RESULTS", () => {
  it("calls every state and DC exactly once", () => {
    const ids = Object.keys(PRESIDENT_2024_RESULTS);
    expect(ids).toHaveLength(STATES.length);
    expect(ids.length).toBe(new Set(ids).size);
    expect([...ids].sort()).toEqual(STATES.map((s) => s.fips).sort());
  });

  it("uses only valid party values", () => {
    for (const value of Object.values(PRESIDENT_2024_RESULTS)) {
      expect(PARTIES).toContain(value);
    }
  });

  it("matches the 2024 electoral college total", () => {
    let d = 0;
    let r = 0;
    for (const state of STATES) {
      const party = PRESIDENT_2024_RESULTS[state.fips];
      if (party === "D") d += state.electoralVotes;
      else if (party === "R") r += state.electoralVotes;
    }
    expect(d).toBe(226);
    expect(r).toBe(312);
    expect(d + r).toBe(TOTAL_ELECTORAL_VOTES);
  });
});
