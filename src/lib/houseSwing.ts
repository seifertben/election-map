import { HOUSE_2024_MARGIN } from "../data/house2024";
import { colorForStrength, formatMargin, POLL_MARGIN_CAP } from "./polling";
import type { PollOverlay, PollSummary } from "./polling";

/** Swing slider bounds, in points toward the Democrats (negative is R). */
export const HOUSE_SWING_MIN = -20;
export const HOUSE_SWING_MAX = 20;
export const HOUSE_SWING_STEP = 0.5;

/** A district's 2024 presidential two-party margin (D positive), if modeled. */
export function house2024Margin(geoid: string): number | null {
  return HOUSE_2024_MARGIN[geoid] ?? null;
}

/** Human-readable uniform swing, e.g. "D +3.5 swing" / "Even swing". */
export function formatSwing(points: number): string {
  const rounded = Math.round(Math.abs(points) * 10) / 10;
  if (rounded === 0) return "Even swing";
  return `${points > 0 ? "D" : "R"} +${rounded.toFixed(1)} swing`;
}

/** Apply a uniform swing to a district's 2024 margin. Null when unmodeled. */
export function swingMargin(geoid: string, swing: number): number | null {
  const base = house2024Margin(geoid);
  return base === null ? null : base + swing;
}

/**
 * Color for a swung margin, on the same diverging scale the poll and market
 * overlays use: deep blue at a Democratic rout through grey at a dead heat to
 * deep red at a Republican rout.
 */
export function swingColor(margin: number): string {
  return colorForStrength(-margin / POLL_MARGIN_CAP);
}

/** The Democratic and Republican seats a uniform swing would produce. */
export function swingSeatCounts(
  swing: number,
  activeIds?: Iterable<string>,
): { d: number; r: number; even: number } {
  const ids = activeIds ?? Object.keys(HOUSE_2024_MARGIN);
  let d = 0;
  let r = 0;
  let even = 0;
  for (const id of ids) {
    const margin = swingMargin(id, swing);
    if (margin === null) continue;
    if (margin > 0) d += 1;
    else if (margin < 0) r += 1;
    else even += 1;
  }
  return { d, r, even };
}

function swungSummary(margin: number): PollSummary {
  return {
    d: 50 + margin / 2,
    r: 50 - margin / 2,
    margin,
    leader: margin >= 0 ? "D" : "R",
    polls: 0,
    latest: "",
  };
}

/**
 * A map overlay coloring every district by its 2024 presidential margin plus a
 * uniform national swing. Shaped like the poll/market overlays so the map,
 * scoreboard, pickup stripes, and tooltips all treat it the same way.
 */
export function houseSwingOverlay(swing: number): PollOverlay {
  const fills: Record<string, string> = {};
  for (const [geoid, margin] of Object.entries(HOUSE_2024_MARGIN)) {
    fills[geoid] = swingColor(margin + swing);
  }
  return {
    fills,
    summaryFor: (id) => {
      const margin = swingMargin(id, swing);
      return margin === null ? null : swungSummary(margin);
    },
    optionLabel: "2024 baseline",
    // The whole map is derived from the 2024 baseline, so no region counts as
    // manually painted: every district follows the slider.
    isPainted: () => false,
    describe: (id) => {
      const base = house2024Margin(id);
      if (base === null) return null;
      return (
        `2024 ${formatMargin(base)} · ${formatSwing(swing)} → ` +
        formatMargin(base + swing)
      );
    },
  };
}
