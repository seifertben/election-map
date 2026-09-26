import {
  GOVERNOR_2026_POLLS,
  GOVERNOR_POLLS_AS_OF,
} from "../data/polling/governor2026";
import { SENATE_2026_POLLS, SENATE_POLLS_AS_OF } from "../data/polling/senate2026";
import type { Assignment } from "../types";

/** Polling for a single race mode: the polls, the window they cover, and the
 * aggregation options the dropdown offers. */
export interface PollDataset {
  asOf: string;
  polls: Record<string, RacePoll[]>;
  options: PollOption[];
  optionById: Record<string, PollOption>;
}

/** The minimal shape of a committed poll, shared by Senate and Governor. */
export interface RacePoll {
  /** Pollster or sponsor that released the poll. */
  pollster: string;
  /** Last day the poll was in the field, ISO YYYY-MM-DD. */
  date: string;
  /** Democratic candidate's share of the vote, percent. */
  d: number;
  /** Republican candidate's share of the vote, percent. */
  r: number;
}

/** How a poll option reduces a state's polls to one number. */
export type PollOptionKind = "average" | "pollster";

export interface PollOption {
  id: string;
  label: string;
  kind: PollOptionKind;
  /** For averages: how many of the most recent polls to use; null = all. */
  window?: number | null;
  /** For pollster options: the pollster name to filter on. */
  pollster?: string;
}

/** The "no polling overlay" placeholder — the race ratings map is shown. */
export const POLL_NONE_OPTION_ID = "";

export interface PollSummary {
  /** Mean Democratic share, percent. */
  d: number;
  /** Mean Republican share, percent. */
  r: number;
  /** Democratic minus Republican share, percentage points. */
  margin: number;
  leader: "D" | "R";
  /** How many polls went into the summary. */
  polls: number;
  /** Date of the most recent poll included (ISO YYYY-MM-DD). */
  latest: string;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Average a state's polls (or just one pollster's) into a single margin.
 * Returns null when the option matches none of the state's polls.
 */
export function summarizePolls(
  polls: RacePoll[],
  option: PollOption,
): PollSummary | null {
  const filtered =
    option.kind === "pollster"
      ? polls.filter((poll) => poll.pollster === option.pollster)
      : polls;
  if (filtered.length === 0) return null;
  const recent = [...filtered].sort((a, b) => b.date.localeCompare(a.date));
  // A pollster can run several polls in one state; when that pollster is
  // selected, only their most recent poll counts. Averages keep every poll.
  const chosen =
    option.kind === "pollster"
      ? recent.slice(0, 1)
      : option.window != null
        ? recent.slice(0, option.window)
        : recent;
  const d = mean(chosen.map((poll) => poll.d));
  const r = mean(chosen.map((poll) => poll.r));
  return {
    d,
    r,
    margin: d - r,
    leader: d - r >= 0 ? "D" : "R",
    polls: chosen.length,
    latest: chosen[0].date,
  };
}

/** Human-readable margin, e.g. "D +2.4" / "R +1.0" / "Even". */
export function formatMargin(margin: number): string {
  const rounded = Math.round(Math.abs(margin) * 10) / 10;
  if (rounded === 0) return "Even";
  return `${margin > 0 ? "D" : "R"} +${rounded.toFixed(1)}`;
}

/** One-line description of a summary for a tooltip. */
export function describeSummary(
  summary: PollSummary,
  optionLabel: string,
): string {
  const noun = summary.polls === 1 ? "poll" : "polls";
  // A single poll (e.g. a chosen pollster's latest, or an average that matched
  // only one poll) shows its date so the hover isn't ambiguous.
  const dated = summary.polls === 1 ? `, ${summary.latest}` : "";
  const raw = `D ${summary.d.toFixed(1)} / R ${summary.r.toFixed(1)}`;
  return `${formatMargin(summary.margin)} (${raw}) · ${optionLabel} (${summary.polls} ${noun}${dated})`;
}

/**
 * A polling overlay for the map: a fill per region plus the data the tooltip
 * needs. When present, the map colors states by polling instead of by their
 * race rating or painted party.
 */
export interface PollOverlay {
  /** Fill color per region id; regions absent here render unassigned. */
  fills: Record<string, string>;
  /** Poll summary for a region, or null when it has no matching polls. */
  summaryFor: (id: string) => PollSummary | null;
  /** Label of the selected aggregation, shown in the tooltip. */
  optionLabel: string;
  /**
   * Whether a region has been manually painted (its assignment no longer
   * matches the loaded ratings). Painted regions show their own color and
   * label instead of the poll shade.
   */
  isPainted: (id: string) => boolean;
  /**
   * Optional custom tooltip detail for an unpainted region, overriding the
   * poll aggregate text. Used by non-poll color overlays (e.g. betting
   * markets). Returning null means "no data" for that region.
   */
  describe?: (id: string) => string | null;
  /**
   * Optional second tooltip line under the main label, e.g. the demographic
   * composition a projection is built from. Returning null hides the line.
   */
  breakdown?: (id: string) => string | null;
}

/**
 * The assignment map a color overlay projects onto the scoreboard. Regions the
 * user painted keep their own assignment; every other region becomes the
 * overlay's projected leader — the poll leader or the market favorite — or
 * uncalled when the overlay has no call on it (no matching poll/quote, or an
 * even margin). This keeps the scoreboard and seat dots in step with the
 * colors the map is showing.
 */
export function projectedAssignments(
  base: Record<string, Assignment>,
  overlay: PollOverlay,
): Record<string, Assignment> {
  const result: Record<string, Assignment> = { ...base };
  for (const id of Object.keys(result)) {
    if (overlay.isPainted(id)) continue;
    const summary = overlay.summaryFor(id);
    result[id] =
      summary && summary.margin !== 0
        ? summary.leader === "D"
          ? "D"
          : "R"
        : null;
  }
  return result;
}

/** Most-polled pollsters first, then alphabetical. */
export function pollsterNames(
  data: Record<string, RacePoll[]>,
): string[] {
  const counts = new Map<string, number>();
  for (const polls of Object.values(data)) {
    for (const poll of polls) {
      counts.set(poll.pollster, (counts.get(poll.pollster) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
}

export const POLL_AVERAGE_OPTIONS: PollOption[] = [
  { id: "avg-10", label: "Average of last 10 polls", kind: "average", window: 10 },
  { id: "avg-5", label: "Average of last 5 polls", kind: "average", window: 5 },
  { id: "avg-all", label: "Average of all polls", kind: "average", window: null },
];

/** Build the dropdown options for a poll dataset: the rolling averages first,
 * then one entry per pollster. */
export function pollOptionsFor(data: Record<string, RacePoll[]>): PollOption[] {
  const pollsters = pollsterNames(data).map((name) => ({
    id: `pollster:${name}`,
    label: name,
    kind: "pollster" as const,
    pollster: name,
  }));
  return [...POLL_AVERAGE_OPTIONS, ...pollsters];
}

export function pollOptionMap(
  options: PollOption[],
): Record<string, PollOption> {
  return Object.fromEntries(options.map((option) => [option.id, option]));
}

function makeDataset(
  polls: Record<string, RacePoll[]>,
  asOf: string,
): PollDataset {
  const options = pollOptionsFor(polls);
  return { asOf, polls, options, optionById: pollOptionMap(options) };
}

/** Committed polling for each race mode the app can overlay. */
export const POLL_DATASETS: Record<"senate" | "governor", PollDataset> = {
  senate: makeDataset(SENATE_2026_POLLS, SENATE_POLLS_AS_OF),
  governor: makeDataset(GOVERNOR_2026_POLLS, GOVERNOR_POLLS_AS_OF),
};

// Senate aliases kept for the existing Senate call sites and tests.
export const POLL_POLLSTER_OPTIONS: PollOption[] =
  POLL_DATASETS.senate.options.slice(POLL_AVERAGE_OPTIONS.length);

export const POLL_OPTIONS: PollOption[] = POLL_DATASETS.senate.options;

export const POLL_OPTION_BY_ID: Record<string, PollOption> =
  POLL_DATASETS.senate.optionById;

export interface PollScaleStop {
  /** Position on the scale: -1 is the deepest blue, +1 the deepest red. */
  at: number;
  color: string;
}

/**
 * Diverging scale used to fill states by polling strength. It reuses the race
 * rating palette, so a state polled well for a party matches the deep shade a
 * Solid rating would use.
 *
 * The scale is driven by a party's poll share, not just the D-R margin: a
 * candidate at 50 is winning outright and shades deeply even with a modest
 * lead, while a candidate under 50 stays lighter even with the same margin.
 * See {@link pollStrength}.
 */
export const POLL_SCALE_STOPS: PollScaleStop[] = [
  { at: -1, color: "#1b3a78" },
  { at: -0.55, color: "#2e5fa3" },
  { at: -0.22, color: "#6f9fd8" },
  { at: 0, color: "#8e8e93" },
  { at: 0.22, color: "#e08a80" },
  { at: 0.55, color: "#c0392b" },
  { at: 1, color: "#8f1d14" },
];

/** Margins at or beyond this many points saturate the scale. */
export const POLL_MARGIN_CAP = 15;

/** Poll share at or above this counts as an outright majority. */
export const POLL_MAJORITY = 50;

/** Extra weight given to clearing the majority threshold, relative to margin. */
const MAJORITY_BONUS = 0.8;

/**
 * How much of a leading-but-sub-50 share's margin still counts toward the
 * shade. A favorite stuck below 50 has a soft ceiling, so their margin maps to
 * a weaker position than the same margin would for a majority.
 */
const SUBCANDY_MARGIN_WEIGHT = 0.35;

/**
 * Position on the diverging scale for a poll summary, in [-1, 1] where -1 is
 * the deepest blue and +1 the deepest red.
 *
 * The margin (capped at {@link POLL_MARGIN_CAP}) provides the base position.
 * Clearing {@link POLL_MAJORITY} pushes the favorite further toward its color —
 * the closer to 50 and beyond, the bigger the boost — while leading but still
 * stuck below 50 pulls it back toward the center. This keeps a 47-44 lead
 * visibly weaker than a 50-44 one.
 */
export function pollStrength(summary: PollSummary): number {
  const base = Math.max(-1, Math.min(1, -summary.margin / POLL_MARGIN_CAP));
  if (summary.margin === 0) return base;
  const direction = Math.sign(summary.margin);
  const favoriteShare = summary.margin > 0 ? summary.d : summary.r;
  if (favoriteShare >= POLL_MAJORITY) {
    // Clear majorities get the full margin plus a bonus for how far past 50
    // they are, so a 50-47 lead shades about as deeply as a 56-47 rout.
    const bonus = Math.max(
      -1,
      Math.min(1, (favoriteShare - POLL_MAJORITY) / 5),
    );
    return Math.max(-1, Math.min(1, base - direction * MAJORITY_BONUS * bonus));
  }
  // A leader still under 50 only gets partial credit for their margin; they
  // are not on pace to win outright.
  return Math.max(
    -1,
    Math.min(1, base * SUBCANDY_MARGIN_WEIGHT),
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const channel = (x: number, y: number) => Math.round(x + (y - x) * t);
  const rgb = (channel(ar, br) << 16) | (channel(ag, bg) << 8) | channel(ab, bb);
  return `#${rgb.toString(16).padStart(6, "0")}`;
}

/**
 * Color for a position on the diverging scale, in [-1, 1] where -1 is the
 * deepest blue and +1 the deepest red. Callers choose how their metric maps
 * onto the scale (see {@link pollStrength} and the market equivalent).
 */
export function colorForStrength(t: number): string {
  const clamped = Math.max(-1, Math.min(1, t));
  for (let i = 1; i < POLL_SCALE_STOPS.length; i += 1) {
    const lo = POLL_SCALE_STOPS[i - 1];
    const hi = POLL_SCALE_STOPS[i];
    if (clamped <= hi.at) {
      const span = hi.at - lo.at;
      return mixHex(lo.color, hi.color, span === 0 ? 0 : (clamped - lo.at) / span);
    }
  }
  return POLL_SCALE_STOPS[POLL_SCALE_STOPS.length - 1].color;
}

/** Color for a poll summary, using {@link pollStrength} to place it. */
export function pollMarginColor(summary: PollSummary): string {
  return colorForStrength(pollStrength(summary));
}

/** CSS gradient matching {@link POLL_SCALE_STOPS}, for the legend. */
export function pollScaleGradientCss(): string {
  const stops = POLL_SCALE_STOPS.map(
    (stop) => `${stop.color} ${(((stop.at + 1) / 2) * 100).toFixed(1)}%`,
  );
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}
