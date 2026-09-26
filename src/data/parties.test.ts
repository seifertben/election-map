import { describe, expect, it } from "vitest";
import {
  lighten,
  PARTY_COLOR,
  pickupStripe,
  pickupStripeFor,
  RATING_COLOR,
} from "./parties";

const BLUES = ["#1b3a78", "#2e5fa3", "#6f9fd8", "#10213f"];
const REDS = ["#8f1d14", "#c0392b", "#e08a80", "#4f100b"];

function luminance(hex: string): number {
  const [r, g, b] = hex
    .slice(1)
    .match(/../g)!
    .map((c) => parseInt(c, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe("pickupStripe", () => {
  it("uses the confidence shade as one stripe and a lighter shade as the other", () => {
    const dPickups: [string, string][] = [
      ["SOLID_D", RATING_COLOR.SOLID_D],
      ["LIKELY_D", RATING_COLOR.LIKELY_D],
      ["LEAN_D", RATING_COLOR.LEAN_D],
    ];
    for (const [assignment, shade] of dPickups) {
      const stripe = pickupStripe(assignment as never, "R");
      expect(stripe).not.toBeNull();
      expect(stripe?.colorA).toBe(shade);
      expect(stripe?.colorB).toBe(lighten(shade));
      expect(luminance(stripe!.colorB)).toBeGreaterThan(luminance(shade));
    }

    const rPickups: [string, string][] = [
      ["SOLID_R", RATING_COLOR.SOLID_R],
      ["LIKELY_R", RATING_COLOR.LIKELY_R],
      ["LEAN_R", RATING_COLOR.LEAN_R],
    ];
    for (const [assignment, shade] of rPickups) {
      const stripe = pickupStripe(assignment as never, "D");
      expect(stripe?.colorA).toBe(shade);
      expect(stripe?.colorB).toBe(lighten(shade));
      expect(luminance(stripe!.colorB)).toBeGreaterThan(luminance(shade));
    }
  });

  it("stripes a D pickup in blues and an R pickup in reds", () => {
    const flipD = pickupStripe("D", "R");
    expect(flipD).toEqual({
      id: "pickup-DR-D",
      colorA: PARTY_COLOR.D,
      colorB: lighten(PARTY_COLOR.D),
      pickup: "D",
    });
    expect(BLUES).toContain(flipD?.colorA);
    expect(flipD?.colorA).not.toBe(flipD?.colorB);

    const flipR = pickupStripe("R", "D");
    expect(flipR?.colorA).toBe(PARTY_COLOR.R);
    expect(flipR?.colorB).toBe(lighten(PARTY_COLOR.R));
    expect(REDS).toContain(flipR?.colorA);
    expect(flipR?.colorA).not.toBe(flipR?.colorB);
    expect(flipR?.pickup).toBe("R");
  });

  it("keeps every band in the projected party's color family", () => {
    const cases: { assignment: string; holder: string }[] = [
      { assignment: "D", holder: "R" },
      { assignment: "SOLID_D", holder: "R" },
      { assignment: "LEAN_D", holder: "R" },
      { assignment: "R", holder: "D" },
      { assignment: "SOLID_R", holder: "D" },
      { assignment: "LEAN_R", holder: "D" },
    ];
    for (const { assignment, holder } of cases) {
      const stripe = pickupStripe(assignment as never, holder);
      expect(stripe).not.toBeNull();
      // The partner band is always derived from the confidence shade, so it
      // never pulls in the holder's hue.
      expect(stripe?.colorB).toBe(lighten(stripe!.colorA));
    }
  });

  it("gives a distinct lighter partner for each confidence shade", () => {
    const solid = pickupStripe("SOLID_D", "R");
    const lean = pickupStripe("LEAN_D", "R");
    expect(solid?.colorA).not.toBe(lean?.colorA);
    expect(solid?.colorB).not.toBe(lean?.colorB);
    expect(solid?.colorB).not.toBe(lean?.colorA);
  });

  it("gives each confidence shade its own pattern id", () => {
    // The pattern defs are deduped by id, so SOLID_D and LEAN_D pickups must
    // not share a pattern or the Solid shade would render with the Lean one.
    const ids = new Set(
      ["LEAN_D", "LIKELY_D", "SOLID_D"].map(
        (a) => pickupStripe(a as never, "R")?.id,
      ),
    );
    expect(ids.size).toBe(3);
    expect(ids).toContain("pickup-DR-SOLID_D");
    expect(ids).not.toContain("pickup-DR");
  });

  it("always draws two distinct bands", () => {
    for (const rating of ["LEAN_D", "LIKELY_D", "SOLID_D", "LEAN_R", "LIKELY_R", "SOLID_R"] as const) {
      const stripe = pickupStripe(
        rating,
        rating.endsWith("D") ? "R" : "D",
      );
      expect(stripe).not.toBeNull();
      expect(stripe?.colorA).not.toBe(stripe?.colorB);
    }
  });

  it("returns null when the parties match", () => {
    expect(pickupStripe("D", "D")).toBeNull();
    expect(pickupStripe("SOLID_R", "R")).toBeNull();
  });

  it("returns null for toss ups, empties, independents, and new seats", () => {
    expect(pickupStripe("TOSS", "R")).toBeNull();
    expect(pickupStripe("TOSS", null)).toBeNull();
    expect(pickupStripe(null, "R")).toBeNull();
    expect(pickupStripe("D", null)).toBeNull();
    expect(pickupStripe("D", "I")).toBeNull();
    expect(pickupStripe("SOLID_R", null)).toBeNull();
  });
});

describe("pickupStripeFor", () => {
  it("uses the supplied color as the confidence band and lightens it", () => {
    // The poll shade stays as colorA, with a lighter tint as the partner band,
    // so a poll pickup keeps its poll intensity.
    const stripe = pickupStripeFor("R", "#6f9fd8", "D", "pickup-poll-RD-6f9fd8");
    expect(stripe).toEqual({
      id: "pickup-poll-RD-6f9fd8",
      colorA: "#6f9fd8",
      colorB: lighten("#6f9fd8"),
      pickup: "R",
    });
    expect(luminance(stripe!.colorB)).toBeGreaterThan(luminance(stripe!.colorA));
  });

  it("returns null unless the projection flips a D/R seat", () => {
    expect(pickupStripeFor("TOSS", "#6f9fd8", "R", "x")).toBeNull();
    expect(pickupStripeFor(null, "#6f9fd8", "R", "x")).toBeNull();
    expect(pickupStripeFor("D", "#6f9fd8", "D", "x")).toBeNull();
    expect(pickupStripeFor("D", "#6f9fd8", "I", "x")).toBeNull();
    expect(pickupStripeFor("D", "#6f9fd8", null, "x")).toBeNull();
  });
});