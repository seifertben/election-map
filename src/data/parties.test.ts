import { describe, expect, it } from "vitest";
import {
  PARTY_COLOR,
  pickupStripe,
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
  it("uses the confidence shade as one stripe and a fixed darker color as the other", () => {
    const dPickups: [string, string][] = [
      ["SOLID_D", RATING_COLOR.SOLID_D],
      ["LIKELY_D", RATING_COLOR.LIKELY_D],
      ["LEAN_D", RATING_COLOR.LEAN_D],
    ];
    for (const [assignment, shade] of dPickups) {
      const stripe = pickupStripe(assignment as never, "R");
      expect(stripe).not.toBeNull();
      expect(stripe?.colorA).toBe(shade);
      expect(stripe?.colorB).toBe("#10213f");
      expect(luminance(stripe!.colorB)).toBeLessThan(luminance(shade));
    }

    const rPickups: [string, string][] = [
      ["SOLID_R", RATING_COLOR.SOLID_R],
      ["LIKELY_R", RATING_COLOR.LIKELY_R],
      ["LEAN_R", RATING_COLOR.LEAN_R],
    ];
    for (const [assignment, shade] of rPickups) {
      const stripe = pickupStripe(assignment as never, "D");
      expect(stripe?.colorA).toBe(shade);
      expect(stripe?.colorB).toBe("#4f100b");
      expect(luminance(stripe!.colorB)).toBeLessThan(luminance(shade));
    }
  });

  it("stripes a D pickup with two blues and an R pickup with two reds", () => {
    const flipD = pickupStripe("D", "R");
    expect(flipD).toEqual({
      id: "pickup-DR-D",
      colorA: PARTY_COLOR.D,
      colorB: "#10213f",
      pickup: "D",
    });
    expect(BLUES).toContain(flipD?.colorA);
    expect(BLUES).toContain(flipD?.colorB);
    expect(flipD?.colorA).not.toBe(flipD?.colorB);

    const flipR = pickupStripe("R", "D");
    expect(flipR?.colorA).toBe(PARTY_COLOR.R);
    expect(flipR?.colorB).toBe("#4f100b");
    expect(REDS).toContain(flipR?.colorA);
    expect(REDS).toContain(flipR?.colorB);
    expect(flipR?.colorA).not.toBe(flipR?.colorB);
    expect(flipR?.pickup).toBe("R");
  });

  it("never mixes the holder's color into a pickup", () => {
    const cases: { assignment: string; holder: string; pickup: "D" | "R" }[] = [
      { assignment: "D", holder: "R", pickup: "D" },
      { assignment: "R", holder: "D", pickup: "R" },
      { assignment: "SOLID_D", holder: "R", pickup: "D" },
      { assignment: "LIKELY_D", holder: "R", pickup: "D" },
      { assignment: "LEAN_D", holder: "R", pickup: "D" },
      { assignment: "SOLID_R", holder: "D", pickup: "R" },
      { assignment: "LIKELY_R", holder: "D", pickup: "R" },
      { assignment: "LEAN_R", holder: "D", pickup: "R" },
    ];
    for (const { assignment, holder, pickup } of cases) {
      const stripe = pickupStripe(assignment as never, holder);
      expect(stripe).not.toBeNull();
      const family = pickup === "D" ? BLUES : REDS;
      const other = pickup === "D" ? REDS : BLUES;
      expect(stripe?.pickup).toBe(pickup);
      expect(family).toContain(stripe?.colorA);
      expect(family).toContain(stripe?.colorB);
      expect(other).not.toContain(stripe?.colorA);
      expect(other).not.toContain(stripe?.colorB);
    }
  });

  it("keeps the fixed band identical across confidence levels", () => {
    expect(pickupStripe("LEAN_D", "R")?.colorB).toBe(
      pickupStripe("SOLID_D", "R")?.colorB,
    );
    expect(pickupStripe("LEAN_R", "D")?.colorB).toBe(
      pickupStripe("SOLID_R", "D")?.colorB,
    );
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