import { describe, expect, it } from "vitest";
import type { SenatePoll } from "../data/polling/senate2026";
import type { Assignment } from "../types";
import {
  POLL_AVERAGE_OPTIONS,
  POLL_NONE_OPTION_ID,
  POLL_OPTIONS,
  POLL_POLLSTER_OPTIONS,
  describeSummary,
  formatMargin,
  pollMarginColor,
  pollScaleGradientCss,
  pollStrength,
  pollsterNames,
  projectedAssignments,
  summarizePolls,
  type PollOption,
  type PollOverlay,
  type PollSummary,
} from "./polling";

const POLLS: SenatePoll[] = [
  { pollster: "A", date: "2026-09-01", d: 50, r: 46, sample: 600 },
  { pollster: "B", date: "2026-09-10", d: 48, r: 48, sample: 1000 },
  { pollster: "A", date: "2026-09-20", d: 52, r: 44, sample: 800 },
];

const lastTwo: PollOption = {
  id: "avg-2",
  label: "Average of last 2 polls",
  kind: "average",
  window: 2,
};
const allPolls: PollOption = {
  id: "avg-all",
  label: "Average of all polls",
  kind: "average",
  window: null,
};
const pollsterA: PollOption = {
  id: "pollster:A",
  label: "A",
  kind: "pollster",
  pollster: "A",
};
const pollsterC: PollOption = {
  id: "pollster:C",
  label: "C",
  kind: "pollster",
  pollster: "C",
};

describe("summarizePolls", () => {
  it("averages only the most recent N polls, regardless of input order", () => {
    const summary = summarizePolls(POLLS, lastTwo);
    expect(summary).not.toBeNull();
    expect(summary?.d).toBe(50);
    expect(summary?.r).toBe(46);
    expect(summary?.margin).toBe(4);
    expect(summary?.leader).toBe("D");
    expect(summary?.polls).toBe(2);
    expect(summary?.latest).toBe("2026-09-20");
  });

  it("averages every poll for an all-polls option", () => {
    const summary = summarizePolls(POLLS, allPolls);
    expect(summary?.d).toBe(50);
    expect(summary?.r).toBe(46);
    expect(summary?.polls).toBe(3);
  });

  it("uses only the latest poll when a pollster has several", () => {
    const summary = summarizePolls(POLLS, pollsterA);
    expect(summary?.d).toBe(52);
    expect(summary?.r).toBe(44);
    expect(summary?.margin).toBe(8);
    expect(summary?.polls).toBe(1);
    expect(summary?.latest).toBe("2026-09-20");
  });

  it("returns null when no poll matches", () => {
    expect(summarizePolls(POLLS, pollsterC)).toBeNull();
    expect(summarizePolls([], lastTwo)).toBeNull();
  });
});

describe("formatMargin", () => {
  it("labels the leader and rounds to a tenth", () => {
    expect(formatMargin(4)).toBe("D +4.0");
    expect(formatMargin(-2.46)).toBe("R +2.5");
    expect(formatMargin(0)).toBe("Even");
    expect(formatMargin(0.04)).toBe("Even");
  });
});

describe("describeSummary", () => {
  it("includes the margin, raw averages, option label and poll count", () => {
    const summary = summarizePolls(POLLS, lastTwo);
    expect(describeSummary(summary as never, lastTwo.label)).toBe(
      "D +4.0 (D 50.0 / R 46.0) · Average of last 2 polls (2 polls)",
    );
  });

  it("uses the singular and the poll date for a single poll", () => {
    const summary = summarizePolls(POLLS, pollsterA);
    expect(describeSummary(summary as never, pollsterA.label)).toBe(
      "D +8.0 (D 52.0 / R 44.0) · A (1 poll, 2026-09-20)",
    );
  });
});

describe("pollMarginColor", () => {
  const summary = (d: number, r: number) => ({
    d,
    r,
    margin: d - r,
    leader: (d - r >= 0 ? "D" : "R") as "D" | "R",
    polls: 1,
    latest: "2026-09-20",
  });

  it("saturates to deep blue for a big Democratic margin", () => {
    expect(pollMarginColor(summary(58, 33))).toBe("#1b3a78");
  });

  it("saturates to deep red for a big Republican margin", () => {
    expect(pollMarginColor(summary(33, 58))).toBe("#8f1d14");
  });

  it("is neutral grey at a dead heat", () => {
    expect(pollMarginColor(summary(45, 45))).toBe("#8e8e93");
  });

  it("moves from blue to red across the scale", () => {
    const blue = pollMarginColor(summary(52, 47));
    const red = pollMarginColor(summary(47, 52));
    const blueRed = Number.parseInt(blue.slice(1, 3), 16);
    const redRed = Number.parseInt(red.slice(1, 3), 16);
    expect(blueRed).toBeLessThan(redRed);
  });

  it("shades a majority winner deeper than a sub-50 lead of equal margin", () => {
    // Same +3 margin, but 50-47 clears 50 while 47-44 does not.
    expect(Math.abs(pollStrength(summary(50, 47)))).toBeGreaterThan(
      Math.abs(pollStrength(summary(47, 44))),
    );
    // ...which shows up as a more saturated shade for the majority leader.
    expect(pollMarginColor(summary(50, 47))).not.toBe(
      pollMarginColor(summary(47, 44)),
    );
  });

  it("keeps a large sub-50 lead weaker than a bare majority", () => {
    // 47-44 (+3) should not outweigh 50-47 (+3)... 
    expect(Math.abs(pollStrength(summary(47, 44)))).toBeLessThan(
      Math.abs(pollStrength(summary(50, 47))),
    );
    // ...even against a bigger-but-sub-50 margin like 49-41 (+8).
    expect(Math.abs(pollStrength(summary(50, 47)))).toBeGreaterThan(
      Math.abs(pollStrength(summary(49, 41))),
    );
  });
});

describe("pollScaleGradientCss", () => {
  it("spans the full scale", () => {
    const css = pollScaleGradientCss();
    expect(css.startsWith("linear-gradient(90deg, #1b3a78 0.0%")).toBe(true);
    expect(css.endsWith("#8f1d14 100.0%)")).toBe(true);
  });
});

describe("pollsterNames", () => {
  it("orders by poll count, then alphabetically", () => {
    expect(
      pollsterNames({
        "01": [
          { pollster: "B", date: "2026-09-01", d: 1, r: 1 },
          { pollster: "A", date: "2026-09-01", d: 1, r: 1 },
        ],
        "02": [
          { pollster: "A", date: "2026-09-01", d: 1, r: 1 },
          { pollster: "C", date: "2026-09-01", d: 1, r: 1 },
        ],
      }),
    ).toEqual(["A", "B", "C"]);
  });
});

describe("projectedAssignments", () => {
  const summary = (
    d: number,
    r: number,
    leader: "D" | "R",
  ): PollSummary => ({
    d,
    r,
    margin: d - r,
    leader,
    polls: 1,
    latest: "2026-09-20",
  });

  const overlay = (
    calls: Record<string, PollSummary | null>,
    painted: string[] = [],
  ): PollOverlay => ({
    fills: {},
    summaryFor: (id) => calls[id] ?? null,
    optionLabel: "test",
    isPainted: (id) => painted.includes(id),
  });

  it("projects unpainted regions onto the overlay's leader", () => {
    const base: Record<string, Assignment> = {
      "13": "LEAN_D",
      "48": "SOLID_R",
    };
    const result = projectedAssignments(
      base,
      overlay({ "13": summary(52, 44, "D"), "48": summary(46, 48, "R") }),
    );
    expect(result).toEqual({ "13": "D", "48": "R" });
  });

  it("keeps a painted region's own assignment", () => {
    const base: Record<string, Assignment> = { "13": "LEAN_D" };
    const result = projectedAssignments(
      base,
      overlay({ "13": summary(52, 44, "D") }, ["13"]),
    );
    expect(result).toEqual({ "13": "LEAN_D" });
  });

  it("marks regions with no call or an even margin as uncalled", () => {
    const base: Record<string, Assignment> = {
      "13": "LEAN_D",
      "48": "SOLID_R",
      "06": "SOLID_D",
    };
    const result = projectedAssignments(
      base,
      overlay({
        "13": summary(47, 47, "D"),
        "48": null,
        "06": summary(52, 44, "D"),
      }),
    );
    expect(result).toEqual({ "13": null, "48": null, "06": "D" });
  });
});

describe("POLL_OPTIONS", () => {
  it("lists the averages before the pollsters", () => {
    expect(POLL_OPTIONS.slice(0, POLL_AVERAGE_OPTIONS.length)).toEqual(
      POLL_AVERAGE_OPTIONS,
    );
    expect(POLL_OPTIONS).toEqual([
      ...POLL_AVERAGE_OPTIONS,
      ...POLL_POLLSTER_OPTIONS,
    ]);
  });

  it("uses unique ids and never collides with the ratings option", () => {
    const ids = POLL_OPTIONS.map((option) => option.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(POLL_NONE_OPTION_ID);
  });

  it("exposes the average windows the UI documents", () => {
    expect(POLL_AVERAGE_OPTIONS.map((option) => option.window)).toEqual([
      10,
      5,
      null,
    ]);
  });
});
