import type { Assignment, Party, RaceRating } from "../types";

export const PARTIES: Party[] = ["D", "R", "TOSS"];

export const RATINGS: RaceRating[] = [
  "SOLID_D",
  "LIKELY_D",
  "LEAN_D",
  "TOSS",
  "LEAN_R",
  "LIKELY_R",
  "SOLID_R",
];

export const PARTY_LABEL: Record<Party, string> = {
  D: "Democrat",
  R: "Republican",
  TOSS: "Tossup",
};

export const PARTY_SHORT: Record<Party, string> = {
  D: "D",
  R: "R",
  TOSS: "Tossup",
};

export const RATING_LABEL: Record<RaceRating, string> = {
  SOLID_D: "Solid Democrat",
  LIKELY_D: "Likely Democrat",
  LEAN_D: "Lean Democrat",
  TOSS: "Toss Up",
  LEAN_R: "Lean Republican",
  LIKELY_R: "Likely Republican",
  SOLID_R: "Solid Republican",
};

/** Display label for any value a region can hold. */
export const ASSIGNMENT_LABEL: Record<Party | RaceRating, string> = {
  ...PARTY_LABEL,
  ...RATING_LABEL,
};

export const PARTY_COLOR: Record<Party, string> = {
  D: "#1b3a78",
  R: "#8f1d14",
  TOSS: "#8e8e93",
};

/**
 * A blue/red tone per rating: solid is the deepest shade, lean the lightest.
 * Ratings only come from the sourced rankings, so the extra tones never show
 * up from a user click.
 */
export const RATING_COLOR: Record<RaceRating, string> = {
  SOLID_D: "#1b3a78",
  LIKELY_D: "#2e5fa3",
  LEAN_D: "#6f9fd8",
  TOSS: "#8e8e93",
  LEAN_R: "#e08a80",
  LIKELY_R: "#c0392b",
  SOLID_R: "#8f1d14",
};

export const ASSIGNMENT_COLOR: Record<Party | RaceRating, string> = {
  ...PARTY_COLOR,
  ...RATING_COLOR,
};

/** The flat party a value counts as on the scoreboard. */
const BASE_PARTY: Record<Party | RaceRating, Party> = {
  D: "D",
  R: "R",
  TOSS: "TOSS",
  SOLID_D: "D",
  LIKELY_D: "D",
  LEAN_D: "D",
  LEAN_R: "R",
  LIKELY_R: "R",
  SOLID_R: "R",
};

export function baseParty(assignment: Assignment): Party | null {
  return assignment ? BASE_PARTY[assignment] : null;
}

export const UNASSIGNED_COLOR = "#e4e6eb";
export const INACTIVE_COLOR = "#d7dbe0";
export const BORDER_COLOR = "#6b7280";

/** Click order for cycling a region's color: D -> R -> Tossup -> none. */
export const CYCLE_ORDER: Assignment[] = ["D", "R", "TOSS", null];

export function nextParty(current: Assignment): Assignment {
  // A rating click continues from its base party (Solid R -> Tossup -> none)
  // instead of jumping back to the start of the cycle.
  const index = CYCLE_ORDER.indexOf(baseParty(current));
  return CYCLE_ORDER[(index + 1) % CYCLE_ORDER.length];
}

export function regionColor(assignment: Assignment, active = true): string {
  if (!active) return INACTIVE_COLOR;
  if (assignment === null) return UNASSIGNED_COLOR;
  return ASSIGNMENT_COLOR[assignment];
}

/** A diagonal two-party stripe pattern for a projected party flip. */
export interface StripeSpec {
  /** Pattern id, referenced from a region fill as url(#id). */
  id: string;
  /**
   * The wider confidence stripe: the projected party's rating shade (Lean
   * light, Likely mid, Solid dark), flat party color, or poll margin shade.
   */
  colorA: string;
  /**
   * The narrower partner stripe: exactly one shade lighter than {@link colorA},
   * so the two bands read as the same party without mixing in the holder's
   * color.
   */
  colorB: string;
  /** The party projected to pick the seat up. */
  pickup: Party;
}

/** Mix a hex color toward white by `amount` (0..1). */
export function lighten(hex: string, amount = 0.25): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  const r = mix((value >> 16) & 255);
  const g = mix((value >> 8) & 255);
  const b = mix(value & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/**
 * The stripe pattern for a region whose projected party differs from its
 * incumbent party, given the projected party and the color to draw as its
 * confidence band. `colorA` is the shade that would otherwise fill the region
 * (a rating/party color, or a poll margin shade); the other band is one shade
 * lighter than it. `id` distinguishes patterns that share a projected party
 * but draw a different `colorA`, since the `<pattern>` defs are deduped by id.
 *
 * Returns null for regions that are not a flip: no projection, a Toss Up, a
 * seat held by an independent, a new seat with no incumbent, or a projection
 * that keeps the incumbent's party.
 */
export function pickupStripeFor(
  projected: Party | null | undefined,
  colorA: string,
  incumbentParty: string | null,
  id: string,
): StripeSpec | null {
  if (projected !== "D" && projected !== "R") return null;
  const incumbent =
    incumbentParty === "D" || incumbentParty === "R" ? incumbentParty : null;
  if (!incumbent || projected === incumbent) return null;
  return {
    id,
    colorA,
    colorB: lighten(colorA),
    pickup: projected,
  };
}

/**
 * The stripe pattern to draw for a region whose projected party differs from
 * its incumbent party. The wider band is the projected party's confidence
 * shade; the narrower one is a lighter shade of it. Returns null for regions
 * that are not a flip: no assignment, a Toss Up, a seat held by an independent,
 * a new seat with no incumbent, or an assignment that keeps the incumbent's
 * party.
 */
export function pickupStripe(
  assignment: Assignment,
  incumbentParty: string | null,
): StripeSpec | null {
  if (!assignment) return null;
  const target = baseParty(assignment);
  if (!target) return null;
  // The id must encode the confidence shade as well as the parties, since a
  // shared <pattern> def (deduped by id) would otherwise render every pickup
  // of that party with whichever district's shade came first.
  return pickupStripeFor(
    target,
    ASSIGNMENT_COLOR[assignment],
    incumbentParty,
    `pickup-${target}${incumbentParty}-${assignment}`,
  );
}
