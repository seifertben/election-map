import { describe, expect, it, vi } from "vitest";
import {
  fetchPolymarketGovernorOdds,
  fetchPolymarketHouseOdds,
  fetchPolymarketSenateOdds,
  marketColor,
  marketOverlayFor,
  marketStrength,
  parsePolymarketEvents,
  partyFromLabel,
} from "./markets";
import type { GammaEvent, MarketQuote } from "./markets";

describe("partyFromLabel", () => {
  it("reads a parenthesized party tag", () => {
    expect(partyFromLabel("Jon Ossoff (D)")).toBe("D");
    expect(partyFromLabel("Mike Collins (R) ")).toBe("R");
    expect(partyFromLabel("Todd Achilles (I)")).toBe("I");
  });

  it("reads spelled-out party names", () => {
    expect(partyFromLabel("Democrat")).toBe("D");
    expect(partyFromLabel("Republican")).toBe("R");
    expect(partyFromLabel("Independent")).toBe("I");
    expect(partyFromLabel("Democratic Party")).toBe("D");
    expect(partyFromLabel("Republican Party")).toBe("R");
  });

  it("falls back to the known-candidate override", () => {
    expect(partyFromLabel("Mary Peltola")).toBe("D");
    expect(partyFromLabel("Sen. Dan Sullivan")).toBe("R");
  });

  it("returns null for unlabeled candidates", () => {
    expect(partyFromLabel("Some Unknown Person")).toBeNull();
  });
});

describe("parsePolymarketEvents", () => {
  const georgia: GammaEvent = {
    title: "Georgia Senate Election Winner",
    updatedAt: "2026-09-25T19:43:53.318287Z",
    markets: [
      { groupItemTitle: "Jon Ossoff (D)", outcomePrices: '["0.945","0.055"]' },
      { groupItemTitle: "Mike Collins (R)", outcomePrices: '["0.054","0.946"]' },
      { groupItemTitle: "Person A", outcomePrices: null },
    ],
  };

  it("sums candidate prices by party and picks the favorite", () => {
    const snapshot = parsePolymarketEvents([georgia]);
    const quote = snapshot.quotes["13"];
    expect(quote).toBeDefined();
    expect(quote.d).toBeCloseTo(0.945);
    expect(quote.r).toBeCloseTo(0.054);
    expect(quote.favorite).toEqual({
      name: "Jon Ossoff (D)",
      party: "D",
      price: 0.945,
    });
    expect(snapshot.asOf).toBe("2026-09-25T19:43:53.318287Z");
  });

  it("ignores non-winner events and unlabeled races", () => {
    const snapshot = parsePolymarketEvents([
      {
        title: "Georgia Senate Election Margin of Victory",
        markets: [
          { groupItemTitle: "Democrat", outcomePrices: '["0.5","0.5"]' },
        ],
      },
      {
        title: "Atlantis Senate Election Winner",
        markets: [
          { groupItemTitle: "Someone (D)", outcomePrices: '["0.5","0.5"]' },
        ],
      },
    ]);
    expect(snapshot.quotes).toEqual({});
  });

  it("uses overrides for unlabeled fields like Alaska", () => {
    const snapshot = parsePolymarketEvents([
      {
        title: "Alaska Senate Election Winner",
        updatedAt: "2026-09-25T20:00:00Z",
        markets: [
          { groupItemTitle: "Sen. Dan Sullivan", outcomePrices: '["0.285","0.715"]' },
          { groupItemTitle: "Mary Peltola", outcomePrices: '["0.725","0.275"]' },
        ],
      },
    ]);
    const quote = snapshot.quotes["02"];
    expect(quote.d).toBeCloseTo(0.725);
    expect(quote.r).toBeCloseTo(0.285);
    expect(quote.favorite?.name).toBe("Mary Peltola");
  });
});

describe("marketStrength", () => {
  const quote = (d: number, r: number): MarketQuote => ({
    fips: "13",
    d,
    r,
    favorite: null,
    updatedAt: "",
  });

  it("treats a 55/45 market as a faint lean, not a rout", () => {
    expect(marketStrength(quote(0.55, 0.45))).toBeCloseTo(-0.1);
    expect(Math.abs(marketStrength(quote(0.55, 0.45)))).toBeLessThan(
      Math.abs(marketStrength(quote(0.75, 0.25))),
    );
  });

  it("normalizes when third parties take a share of the market", () => {
    // 0.44 / 0.36 with 0.20 to others is still a 55/45 D-R split.
    expect(marketStrength(quote(0.44, 0.36))).toBeCloseTo(-0.1);
  });

  it("saturates only for lopsided markets", () => {
    expect(marketStrength(quote(0.94, 0.06))).toBeCloseTo(-0.88);
    expect(marketStrength(quote(0.5, 0.5))).toBeCloseTo(0);
  });

  it("keeps 55/45 far lighter than the poll scale would", () => {
    expect(marketColor(quote(0.5, 0.5))).toBe("#8e8e93");
    expect(marketColor(quote(0.55, 0.45))).not.toBe("#1b3a78");
  });
});

describe("marketOverlayFor", () => {
  it("fills raced states and describes the tooltip", () => {
    const overlay = marketOverlayFor(
      {
        "13": {
          fips: "13",
          d: 0.945,
          r: 0.054,
          favorite: { name: "Jon Ossoff (D)", party: "D", price: 0.945 },
          updatedAt: "2026-09-25T19:43:53Z",
        },
      },
      "Polymarket",
      () => false,
    );
    expect(overlay.fills["13"]).toBeDefined();
    expect(overlay.fills["48"]).toBeUndefined();
    expect(overlay.describe?.("13")).toContain("Jon Ossoff (D) 95%");
    expect(overlay.describe?.("13")).toContain("Polymarket");
    expect(overlay.describe?.("48")).toBeNull();
  });
});

describe("fetchPolymarketSenateOdds", () => {
  it("paginates until every race is found", async () => {
    const realFetch = globalThis.fetch;
    const call = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      // First page reports one race; a full page forces another request.
      const body =
        url.includes("offset=0")
          ? [
              {
                title: "Georgia Senate Election Winner",
                markets: [
                  { groupItemTitle: "Jon Ossoff (D)", outcomePrices: '["0.9","0.1"]' },
                  { groupItemTitle: "Mike Collins (R)", outcomePrices: '["0.1","0.9"]' },
                ],
              },
            ]
          : [];
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(body),
      } as Response);
    });
    globalThis.fetch = call as typeof fetch;
    const snapshot = await fetchPolymarketSenateOdds();
    expect(snapshot.quotes["13"]).toBeDefined();
    globalThis.fetch = realFetch;
  });

  it("rejects when the API errors", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (() =>
      Promise.resolve({
        ok: false,
        status: 429,
        json: () => Promise.resolve([]),
      })) as unknown as typeof fetch;
    await expect(fetchPolymarketSenateOdds()).rejects.toThrow("429");
    globalThis.fetch = realFetch;
  });
});

describe("fetchPolymarketHouseOdds", () => {
  it("keys winner events by district geoid, including at-large seats", async () => {
    const realFetch = globalThis.fetch;
    const call = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes("tag_id=103899")
        ? [
            {
              title: "TX-05 House Election Winner",
              updatedAt: "2026-09-25T20:00:00Z",
              markets: [
                { groupItemTitle: "Lance Gooden (R)", outcomePrices: '["0.945","0.055"]' },
                { groupItemTitle: "Chelsey Hockett (D)", outcomePrices: '["0.009","0.991"]' },
              ],
            },
            {
              title: "AK-AL House Election Winner",
              markets: [
                { groupItemTitle: "Republican Party", outcomePrices: '["0.83","0.17"]' },
                { groupItemTitle: "Democratic Party", outcomePrices: '["0.049","0.951"]' },
              ],
            },
          ]
        : [];
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(body),
      } as Response);
    });
    globalThis.fetch = call as typeof fetch;
    const snapshot = await fetchPolymarketHouseOdds();
    const tx = snapshot.quotes["4805"];
    expect(tx).toBeDefined();
    expect(tx.d).toBeCloseTo(0.009);
    expect(tx.r).toBeCloseTo(0.945);
    expect(tx.favorite?.name).toBe("Lance Gooden (R)");
    const ak = snapshot.quotes["0200"];
    expect(ak.d).toBeCloseTo(0.049);
    expect(ak.r).toBeCloseTo(0.83);
    globalThis.fetch = realFetch;
  });

  it("keeps the more complete event when a seat has an unlabeled duplicate", async () => {
    const realFetch = globalThis.fetch;
    const call = vi.fn(() => {
      const body = [
        {
          title: "CA-04 House Election Winner (Individual)",
          markets: [
            { groupItemTitle: "Mike Thompson", outcomePrices: '["0.81","0.19"]' },
            { groupItemTitle: "Eric Jones", outcomePrices: '["0.165","0.835"]' },
          ],
        },
        {
          title: "CA-04 House Election Winner",
          markets: [
            { groupItemTitle: "Mike Thompson (D)", outcomePrices: '["0.81","0.19"]' },
            { groupItemTitle: "Eric Jones (R)", outcomePrices: '["0.165","0.835"]' },
          ],
        },
      ];
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(body),
      } as Response);
    });
    globalThis.fetch = call as typeof fetch;
    const snapshot = await fetchPolymarketHouseOdds();
    const ca4 = snapshot.quotes["0604"];
    expect(ca4).toBeDefined();
    expect(ca4.d).toBeCloseTo(0.81);
    expect(ca4.r).toBeCloseTo(0.165);
    globalThis.fetch = realFetch;
  });

  it("labels the unlabeled California 40 field from the per-seat map", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              title: "CA-40 House Election Winner (Individual)",
              markets: [
                { groupItemTitle: "Ken Calvert", outcomePrices: '["0.575","0.425"]' },
                { groupItemTitle: "Young Kim", outcomePrices: '["0.415","0.585"]' },
              ],
            },
          ]),
      })) as unknown as typeof fetch;
    const snapshot = await fetchPolymarketHouseOdds();
    const ca40 = snapshot.quotes["0640"];
    expect(ca40).toBeDefined();
    expect(ca40.r).toBeCloseTo(0.99);
    expect(ca40.favorite?.party).toBe("R");
    globalThis.fetch = realFetch;
  });
});

describe("fetchPolymarketGovernorOdds", () => {
  it("labels unlabeled governor candidates by the per-state party map", async () => {
    const realFetch = globalThis.fetch;
    const call = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes("tag_id=104094")
        ? [
            {
              title: "California Governor Election Winner",
              updatedAt: "2026-09-25T20:00:00Z",
              markets: [
                {
                  groupItemTitle: "Xavier Becerra",
                  outcomePrices: '["0.95","0.05"]',
                },
                {
                  groupItemTitle: "Steve Hilton",
                  outcomePrices: '["0.05","0.95"]',
                },
              ],
            },
          ]
        : [];
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(body),
      } as Response);
    });
    globalThis.fetch = call as typeof fetch;
    const snapshot = await fetchPolymarketGovernorOdds();
    const quote = snapshot.quotes["06"];
    expect(quote).toBeDefined();
    expect(quote.d).toBeCloseTo(0.95);
    expect(quote.r).toBeCloseTo(0.05);
    expect(quote.favorite?.party).toBe("D");
    globalThis.fetch = realFetch;
  });
});
