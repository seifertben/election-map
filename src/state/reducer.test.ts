import { describe, expect, it } from "vitest";
import { createInitialState, reducer } from "./reducer";
import type { AppState } from "./reducer";

function cycle(state: AppState, times: number): AppState {
  let next = state;
  for (let i = 0; i < times; i += 1) {
    next = reducer(next, { type: "cycle", mode: "president", id: "48" });
  }
  return next;
}

describe("reducer", () => {
  it("cycles a region D -> R -> TOSS -> none", () => {
    let state = createInitialState();
    state = cycle(state, 1);
    expect(state.assignments.president["48"]).toBe("D");
    state = cycle(state, 1);
    expect(state.assignments.president["48"]).toBe("R");
    state = cycle(state, 1);
    expect(state.assignments.president["48"]).toBe("TOSS");
    state = cycle(state, 1);
    expect(state.assignments.president["48"]).toBeUndefined();
  });

  it("continues from a rating's base party when cycling", () => {
    let state = createInitialState();
    state = reducer(state, {
      type: "set",
      mode: "senate",
      id: "08",
      party: "SOLID_D",
    });
    state = reducer(state, { type: "cycle", mode: "senate", id: "08" });
    expect(state.assignments.senate["08"]).toBe("R");
  });

  it("does not record history when setting the same value", () => {
    let state = createInitialState();
    state = reducer(state, { type: "set", mode: "house", id: "0101", party: "D" });
    const historyLength = state.history.length;
    const same = reducer(state, {
      type: "set",
      mode: "house",
      id: "0101",
      party: "D",
    });
    expect(same).toBe(state);
    expect(same.history.length).toBe(historyLength);
  });

  it("undoes the previous change", () => {
    let state = createInitialState();
    state = reducer(state, { type: "set", mode: "senate", id: "01", party: "R" });
    state = reducer(state, { type: "set", mode: "senate", id: "02", party: "D" });
    state = reducer(state, { type: "undo" });
    expect(state.assignments.senate).toEqual({ "01": "R" });
    state = reducer(state, { type: "undo" });
    expect(state.assignments.senate).toEqual({});
  });

  it("resets a single mode and all modes", () => {
    let state = createInitialState();
    state = reducer(state, { type: "set", mode: "senate", id: "01", party: "R" });
    state = reducer(state, { type: "set", mode: "house", id: "0101", party: "D" });
    state = reducer(state, { type: "reset", mode: "senate" });
    expect(state.assignments.senate).toEqual({});
    expect(state.assignments.house).toEqual({ "0101": "D" });
    state = reducer(state, { type: "resetAll" });
    expect(state.assignments).toEqual({ president: {}, senate: {}, house: {} });
  });

  it("loads a ratings map for a mode and records history", () => {
    let state = createInitialState();
    const ratings: Record<string, "SOLID_R" | "TOSS"> = {
      "01": "SOLID_R",
      "02": "TOSS",
    };
    state = reducer(state, {
      type: "loadRatings",
      mode: "senate",
      assignments: ratings,
    });
    expect(state.assignments.senate).toEqual(ratings);
    expect(state.history).toHaveLength(1);
    const same = reducer(state, {
      type: "loadRatings",
      mode: "senate",
      assignments: ratings,
    });
    expect(same).toBe(state);
    state = reducer(state, { type: "undo" });
    expect(state.assignments.senate).toEqual({});
  });

  it("hydrates from a shared map and resets history", () => {
    let state = createInitialState();
    state = reducer(state, { type: "set", mode: "senate", id: "01", party: "R" });
    state = reducer(state, {
      type: "hydrate",
      mode: "house",
      assignments: { president: { "48": "R" }, senate: {}, house: {} },
    });
    expect(state.mode).toBe("house");
    expect(state.history).toEqual([]);
    expect(state.assignments.president).toEqual({ "48": "R" });
  });
});
