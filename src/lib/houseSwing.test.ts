import { describe, expect, it } from "vitest";
import { HOUSE_2024_MARGIN } from "../data/house2024";
import {
  formatSwing,
  house2024Margin,
  houseSwingOverlay,
  swingColor,
  swingMargin,
  swingSeatCounts,
} from "./houseSwing";

describe("house 2024 baseline data", () => {
  it("covers every district with a four-digit geoid", () => {
    const keys = Object.keys(HOUSE_2024_MARGIN);
    expect(keys).toHaveLength(435);
    expect(keys.every((k) => /^\d{4}$/.test(k))).toBe(true);
  });

  it("matches a known district's reported margin", () => {
    // AL-01: Harris 32, Trump 68 -> -36.
    expect(house2024Margin("0101")).toBeCloseTo(-36, 5);
    // AL-07: Harris 58, Trump 41 -> +17.17 two-party.
    expect(house2024Margin("0107")).toBeGreaterThan(0);
    expect(house2024Margin("9999")).toBeNull();
  });
});

describe("formatSwing", () => {
  it("labels direction and rounds to a tenth", () => {
    expect(formatSwing(0)).toBe("Even swing");
    expect(formatSwing(3.46)).toBe("D +3.5 swing");
    expect(formatSwing(-2)).toBe("R +2.0 swing");
  });
});

describe("swingMargin", () => {
  it("shifts the 2024 margin by the uniform swing", () => {
    expect(swingMargin("0101", 0)).toBeCloseTo(-36, 5);
    expect(swingMargin("0101", 40)).toBeCloseTo(4, 5);
    expect(swingMargin("0101", 36)).toBeCloseTo(0, 5);
  });
});

describe("swingSeatCounts", () => {
  it("flips a district once the swing crosses its margin", () => {
    expect(swingSeatCounts(0, ["0101"])).toEqual({ d: 0, r: 1, even: 0 });
    expect(swingSeatCounts(36, ["0101"])).toEqual({ d: 0, r: 0, even: 1 });
    expect(swingSeatCounts(40, ["0101"])).toEqual({ d: 1, r: 0, even: 0 });
  });
});

describe("swingColor", () => {
  it("shades a Democratic margin blue and a Republican margin red", () => {
    expect(swingColor(30)).toBe("#1b3a78");
    expect(swingColor(-30)).toBe("#8f1d14");
  });
});

describe("houseSwingOverlay", () => {
  it("fills every baseline district and reports the swung winner", () => {
    const overlay = houseSwingOverlay(0);
    expect(Object.keys(overlay.fills)).toHaveLength(435);

    // AL-01 is a Republican seat in 2024.
    expect(overlay.summaryFor("0101")?.leader).toBe("R");
    expect(overlay.summaryFor("0101")?.margin).toBeCloseTo(-36, 5);
    expect(overlay.isPainted("0101")).toBe(false);

    // A large Democratic swing flips it.
    const swung = houseSwingOverlay(40);
    expect(swung.summaryFor("0101")?.leader).toBe("D");
    expect(swung.describe?.("0101")).toContain("2024 R +36.0");
    expect(swung.describe?.("0101")).toContain("D +4.0");
  });

  it("has no call for a district that lands exactly even", () => {
    const swung = houseSwingOverlay(36);
    expect(swung.summaryFor("0101")?.margin).toBeCloseTo(0, 5);
  });
});
