import { ASSIGNMENT_COLOR, UNASSIGNED_COLOR } from "../data/parties";
import { HOUSE_TOTAL, type Seat } from "../lib/scoreboard";
import type { Party } from "../types";

export interface SeatArcProps {
  /** Every seat in the chamber, in arbitrary order. */
  seats: Seat[];
  /** Party counts for the labels above the arc. */
  counts: { D: number; R: number };
  /** Accessible description of the graphic. */
  label: string;
}

interface Slot {
  x: number;
  y: number;
  /** Angle from the right end of the arc; larger is further left. */
  angle: number;
}

interface Placed extends Seat {
  point: { x: number; y: number };
  color: string;
  title: string;
}

const COL_STEP = 5.2;
const DOT_R = 1.9;
const ROW_GAP = 5.2;
const INNER_R = 20;
const CENTER_X = 110;
const VIEW_W = CENTER_X * 2;

/**
 * Outer radius every chamber is scaled to. It matches the largest chamber (the
 * House), so the Senate and House layouts share one size; chambers with fewer
 * seats get wider spacing and proportionally larger dots.
 */
const OUTER_R = INNER_R + (neededRows(HOUSE_TOTAL) - 1) * ROW_GAP;

/** Democrats fill from the left, Republicans from the right, others middle. */
const SORT_ORDER: Record<Party | "none", number> = {
  D: 0,
  TOSS: 1,
  none: 1,
  R: 2,
};

/** Party color for a seat, or grey when the seat is still unassigned. */
function seatColor(seat: Seat): string {
  if (!seat.party) return UNASSIGNED_COLOR;
  return ASSIGNMENT_COLOR[seat.party];
}

/** Sort seats so Democrats fill from the left and Republicans from the right. */
function order(seats: Seat[]): Seat[] {
  return [...seats].sort((a, b) => {
    const oa = SORT_ORDER[a.party ?? "none"];
    const ob = SORT_ORDER[b.party ?? "none"];
    if (oa !== ob) return oa - ob;
    return a.id.localeCompare(b.id);
  });
}

/** Capacity of a row: as many dots as fit along its semicircular arc. */
function capacity(radius: number): number {
  return Math.max(1, Math.round((Math.PI * radius) / COL_STEP));
}

/** How many rows are needed to seat `n` dots, filling from the inside out. */
function neededRows(n: number): number {
  let seats = 0;
  let rows = 0;
  while (seats < n) {
    seats += capacity(INNER_R + rows * ROW_GAP);
    rows += 1;
  }
  return rows;
}

/**
 * Split `total` seats across `rows` concentric semicircles in proportion to each
 * row's radius. Because a row's arc length scales with its radius, this gives
 * every row the same spacing between neighboring dots, so the chamber is a
 * clean set of perfect semicircles rather than a full inner ring plus a sparse
 * outer one.
 */
function rowCounts(total: number, radii: number[]): number[] {
  const sum = radii.reduce((a, b) => a + b, 0);
  const exact = radii.map((radius) => (total * radius) / sum);
  const counts = exact.map(Math.floor);
  const remaining = total - counts.reduce((a, b) => a + b, 0);
  const byFraction = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);
  for (let k = 0; k < remaining; k += 1) {
    counts[byFraction[k % radii.length].index] += 1;
  }
  return counts;
}

/**
 * Build the chamber's dot slots as concentric semicircles opening downward,
 * like the House and Senate floors. Every row is a complete arc evenly spaced
 * from the far right to the far left; the rows jointly hold exactly `total`
 * seats with uniform spacing throughout. The whole chamber is scaled to
 * `OUTER_R` so every chamber is the same size.
 */
function buildSlots(total: number): {
  slots: Slot[];
  baseY: number;
  dotR: number;
} {
  const rows = Math.max(1, neededRows(total));
  const naturalOuter = INNER_R + (rows - 1) * ROW_GAP;
  const scale = OUTER_R / naturalOuter;
  const innerR = INNER_R * scale;
  const rowGap = ROW_GAP * scale;
  const dotR = DOT_R * scale;
  const radii = Array.from(
    { length: rows },
    (_, r) => innerR + r * rowGap,
  );
  const counts = rowCounts(total, radii);
  const baseY = OUTER_R + dotR + 2;

  const slots: Slot[] = [];
  radii.forEach((radius, r) => {
    const count = counts[r];
    for (let i = 0; i < count; i += 1) {
      const angle = ((i + 0.5) / count) * Math.PI;
      slots.push({
        angle,
        x: CENTER_X + Math.cos(angle) * radius,
        y: baseY - Math.sin(angle) * radius,
      });
    }
  });
  // Order every slot left to right so parties fill in from opposite sides.
  slots.sort((a, b) => b.angle - a.angle);
  return { slots, baseY, dotR };
}

/**
 * `buildSlots` depends only on the seat count and is pure, but SeatArc
 * re-renders on every map edit (each paint changes the seat colors). Cache the
 * layout per chamber size so the arc math and sort run once per chamber.
 */
const slotCache = new Map<number, ReturnType<typeof buildSlots>>();

function slotsFor(total: number): ReturnType<typeof buildSlots> {
  let cached = slotCache.get(total);
  if (!cached) {
    cached = buildSlots(total);
    slotCache.set(total, cached);
  }
  return cached;
}

/**
 * A chamber of seats drawn as dots along concentric semicircles opening
 * downward, the classic floor view: Democrats fill in from the left and
 * Republicans from the right, with tossups and uncalled seats left grey
 * toward the middle.
 */
export function SeatArc({ seats, counts, label }: SeatArcProps) {
  if (seats.length === 0) return null;
  const ordered = order(seats);
  const { slots, baseY, dotR } = slotsFor(ordered.length);

  const placed: Placed[] = slots.map((slot, i) => {
    const seat = ordered[i];
    return {
      ...seat,
      point: { x: slot.x, y: slot.y },
      color: seatColor(seat),
      title: seat.state
        ? `${seat.state}: ${seat.party ?? "Uncalled"}`
        : "Independent",
    };
  });

  return (
    <div className="seatarc">
      <div className="seatarc__counts" aria-hidden="true">
        <span className="seatarc__count seatarc__count--d">{counts.D}</span>
        <span className="seatarc__count seatarc__count--r">{counts.R}</span>
      </div>
      <svg
        className="seatarc__svg"
        viewBox={`0 0 ${VIEW_W} ${baseY + dotR + 1}`}
        role="img"
        aria-label={label}
      >
        {placed.map((seat) => (
          <circle
            key={seat.id}
            cx={seat.point.x}
            cy={seat.point.y}
            r={dotR}
            fill={seat.color}
            stroke="rgba(0, 0, 0, 0.14)"
            strokeWidth="0.5"
          >
            <title>{seat.title}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
