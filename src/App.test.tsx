import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { RATING_COLOR } from "./data/parties";
import { GOVERNOR_2026_RATINGS } from "./data/governor2026";
import { SABATO_SENATE_RATINGS } from "./data/ratings/sabato";
import { SENATE_2026_RATINGS } from "./data/senate2026";
import { swingColor } from "./lib/houseSwing";
import App from "./App";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function load(name: string): unknown {
  const file = resolve(process.cwd(), "public/data", name);
  return JSON.parse(readFileSync(file, "utf8"));
}

const fetchMock = (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("gamma-api.polymarket.com")) {
    const events = url.includes("tag_id=103899")
      ? [
          {
            title: "TX-05 House Election Winner",
            updatedAt: "2026-09-25T20:00:00Z",
            markets: [
              { groupItemTitle: "Lance Gooden (R)", outcomePrices: '["0.945","0.055"]' },
              { groupItemTitle: "Chelsey Hockett (D)", outcomePrices: '["0.009","0.991"]' },
            ],
          },
        ]
      : [
          {
            title: "Georgia Senate Election Winner",
            updatedAt: "2026-09-25T19:43:53.318287Z",
            markets: [
              { groupItemTitle: "Jon Ossoff (D)", outcomePrices: '["0.945","0.055"]' },
              { groupItemTitle: "Mike Collins (R)", outcomePrices: '["0.054","0.946"]' },
            ],
          },
        ];
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(events),
    } as Response);
  }
  const data = url.includes("cd120")
    ? load("cd120.json")
    : url.includes("demographics")
      ? load("demographics.json")
      : load("states.json");
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
  } as Response);
};

let container: HTMLDivElement | null = null;
afterEach(() => {
  container?.remove();
  container = null;
});

// Painting Georgia (D-held) Republican is a pickup, so the default-on stripe
// pattern fills it instead of a flat red.
const GA_PAINT = "url(#pickup-RD-R)";

function setSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    "value",
  )?.set;
  act(() => {
    setter?.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function setRangeValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function waitForStateFlush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("App polling integration", () => {
  it("keeps the ratings and polling selects mutually exclusive", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;
    window.location.hash = "";

    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<App />));

    // Switch to the Senate tab and wait for data + hydrate.
    await waitForStateFlush();
    const tabs = Array.from(container.querySelectorAll("button"));
    const senateTab = tabs.find((b) => b.textContent === "Senate")!;
    act(() => senateTab.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await waitForStateFlush();
    await waitForStateFlush();

    const pollSelect = container.querySelector("#polling-option") as HTMLSelectElement;
    const ratingsSelect = container.querySelector("#ratings-senate") as HTMLSelectElement;
    expect(pollSelect).not.toBeNull();
    expect(ratingsSelect).not.toBeNull();

    // Cook ratings are selected on load, polling is off.
    expect(ratingsSelect.value).toBe("cook");
    expect(pollSelect.value).toBe("");

    // Choosing a poll deselects the ratings dropdown.
    setSelectValue(pollSelect, "avg-10");
    expect(pollSelect.value).toBe("avg-10");
    expect(ratingsSelect.value).toBe("");

    // Choosing a ratings source drops the polling overlay.
    setSelectValue(ratingsSelect, "sabato");
    expect(ratingsSelect.value).toBe("sabato");
    expect(pollSelect.value).toBe("");

    globalThis.fetch = originalFetch;
    act(() => root.unmount());
  });

  it("clears the polling overlay when the ratings source changes", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;
    window.location.hash = "";

    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<App />));

    await waitForStateFlush();
    const senateTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Senate",
    )!;
    act(() => senateTab.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await waitForStateFlush();
    await waitForStateFlush();

    const path = (id: string) =>
      container?.querySelector(`path[data-id="${id}"]`)?.getAttribute("fill") ?? null;

    // Turn polling on, then switch the ratings source to Sabato.
    const pollSelect = container.querySelector("#polling-option") as HTMLSelectElement;
    setSelectValue(pollSelect, "avg-10");
    const pollFill = path("13");

    const ratingsSelect = container.querySelector("#ratings-senate") as HTMLSelectElement;
    expect(ratingsSelect).not.toBeNull();
    setSelectValue(ratingsSelect, "sabato");

    // The overlay must be gone: Georgia shows Sabato's rating color, not a
    // polling color.
    expect(path("13")).toBe(RATING_COLOR[SABATO_SENATE_RATINGS["13"]]);
    expect(path("13")).not.toBe(pollFill);

    globalThis.fetch = originalFetch;
    act(() => root.unmount());
  });

  it("paints a state over the polling overlay without leaving polling mode", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;
    window.location.hash = "";

    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<App />));

    await waitForStateFlush();
    const senateTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Senate",
    )!;
    act(() => senateTab.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await waitForStateFlush();
    await waitForStateFlush();

    const path = (id: string) =>
      container?.querySelector(`path[data-id="${id}"]`)?.getAttribute("fill") ?? null;

    // Turn polling on and capture the poll color for Texas.
    const pollSelect = container.querySelector("#polling-option") as HTMLSelectElement;
    setSelectValue(pollSelect, "avg-10");
    const txPoll = path("48");
    const txRating = RATING_COLOR[SENATE_2026_RATINGS["48"]];
    expect(txPoll).not.toBe(txRating);

    // Click Georgia with the default Cycle brush; Cook rates it LEAN_D, so
    // cycling moves to R (the next step in the D -> R -> Tossup cycle).
    const georgia = container.querySelector('path[data-id="13"]') as SVGPathElement;
    act(() => georgia.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    // Georgia is now painted (a D-held seat flipped to R, so striped)...
    expect(path("13")).toBe(GA_PAINT);
    // ...the polling overlay is still active...
    expect((container.querySelector("#polling-option") as HTMLSelectElement).value).toBe("avg-10");
    // ...and unpainted states still show poll colors.
    expect(path("48")).toBe(txPoll);

    globalThis.fetch = originalFetch;
    act(() => root.unmount());
  });

  it("wipes pre-existing paints when a poll is selected", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;
    window.location.hash = "";

    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<App />));

    await waitForStateFlush();
    const senateTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Senate",
    )!;
    act(() => senateTab.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await waitForStateFlush();
    await waitForStateFlush();

    const path = (id: string) =>
      container?.querySelector(`path[data-id="${id}"]`)?.getAttribute("fill") ?? null;

    // Paint Georgia on the ratings map before touching the poll dropdown.
    const georgia = container.querySelector('path[data-id="13"]') as SVGPathElement;
    act(() => georgia.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(path("13")).toBe(GA_PAINT);

    // Selecting a poll wipes that paint: the map starts clean from the ratings
    // source, so Georgia shows its poll shade and no re-apply button appears.
    const pollSelect = container.querySelector("#polling-option") as HTMLSelectElement;
    setSelectValue(pollSelect, "avg-10");
    expect(path("13")).not.toBe(GA_PAINT);
    expect(
      Array.from(container.querySelectorAll("button")).some((b) =>
        b.textContent?.includes("Re-apply poll"),
      ),
    ).toBe(false);

    globalThis.fetch = originalFetch;
    act(() => root.unmount());
  });

  it("re-applies the poll overlay after a state is painted", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;
    window.location.hash = "";

    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<App />));

    await waitForStateFlush();
    const senateTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Senate",
    )!;
    act(() => senateTab.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await waitForStateFlush();
    await waitForStateFlush();

    const path = (id: string) =>
      container?.querySelector(`path[data-id="${id}"]`)?.getAttribute("fill") ?? null;

    // Enter polling and capture Georgia's poll color.
    const pollSelect = container.querySelector("#polling-option") as HTMLSelectElement;
    setSelectValue(pollSelect, "avg-10");
    const gaPoll = path("13");

    // Painting Georgia should reveal the re-apply button.
    const georgia = container.querySelector('path[data-id="13"]') as SVGPathElement;
    act(() => georgia.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(path("13")).toBe(GA_PAINT);
    const reapply = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Re-apply poll"),
    );
    expect(reapply).toBeDefined();

    // Clicking it restores the poll overlay and hides the button.
    act(() => reapply!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(path("13")).toBe(gaPoll);
    expect(
      Array.from(container.querySelectorAll("button")).some((b) =>
        b.textContent?.includes("Re-apply poll"),
      ),
    ).toBe(false);

    globalThis.fetch = originalFetch;
    act(() => root.unmount());
  });

  it("drops polling paints when the polling option changes", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;
    window.location.hash = "";

    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<App />));

    await waitForStateFlush();
    const senateTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Senate",
    )!;
    act(() => senateTab.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await waitForStateFlush();
    await waitForStateFlush();

    const path = (id: string) =>
      container?.querySelector(`path[data-id="${id}"]`)?.getAttribute("fill") ?? null;
    const pollSelect = container.querySelector("#polling-option") as HTMLSelectElement;

    // Enter polling and paint Georgia (Cycle: LEAN_D -> R).
    setSelectValue(pollSelect, "avg-10");
    const georgia = container.querySelector('path[data-id="13"]') as SVGPathElement;
    act(() => georgia.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(path("13")).toBe(GA_PAINT);

    // Switching to a different poll option drops the paint.
    setSelectValue(pollSelect, "avg-5");
    expect(path("13")).not.toBe(GA_PAINT);
    expect((pollSelect as HTMLSelectElement).value).toBe("avg-5");

    // Paint again, then reselect the Cook ratings: polling (and its paint) is
    // dropped.
    act(() => georgia.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(path("13")).toBe(GA_PAINT);
    const ratingsSelect = container.querySelector("#ratings-senate") as HTMLSelectElement;
    setSelectValue(ratingsSelect, "cook");
    expect(pollSelect.value).toBe("");
    expect(path("13")).not.toBe(GA_PAINT);
    expect(path("13")).toBe(RATING_COLOR[SENATE_2026_RATINGS["13"]]);

    globalThis.fetch = originalFetch;
    act(() => root.unmount());
  });

  it("highlights the panel controlling the map and clears it on reset", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;
    window.location.hash = "";

    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<App />));

    await waitForStateFlush();
    const senateTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Senate",
    )!;
    act(() => senateTab.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await waitForStateFlush();
    await waitForStateFlush();

    const panel = (title: string) =>
      Array.from(container!.querySelectorAll(".panel")).find(
        (p) => p.querySelector(".panel__title")?.textContent === title,
      );
    const active = (title: string) =>
      panel(title)?.classList.contains("panel--active") ?? false;

    // Ratings control the map on load, so that panel is highlighted.
    expect(active("Ratings")).toBe(true);
    expect(active("Polling")).toBe(false);

    // Choosing a poll moves the highlight to the polling panel.
    const pollSelect = container.querySelector("#polling-option") as HTMLSelectElement;
    setSelectValue(pollSelect, "avg-10");
    expect(active("Ratings")).toBe(false);
    expect(active("Polling")).toBe(true);

    // Reset wipes the overlay and with it the highlight.
    const reset = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Reset Senate",
    )!;
    act(() => reset.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await waitForStateFlush();
    expect(pollSelect.value).toBe("");
    expect(active("Polling")).toBe(false);
    expect(active("Ratings")).toBe(false);

    globalThis.fetch = originalFetch;
    act(() => root.unmount());
  });
});

describe("App market integration", () => {
  it("keeps ratings, polling, and markets mutually exclusive", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;
    window.location.hash = "";

    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<App />));

    await waitForStateFlush();
    const senateTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Senate",
    )!;
    act(() => senateTab.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await waitForStateFlush();
    await waitForStateFlush();

    const marketSelect = container.querySelector(
      "#market-source",
    ) as HTMLSelectElement;
    const pollSelect = container.querySelector(
      "#polling-option",
    ) as HTMLSelectElement;
    const ratingsSelect = container.querySelector(
      "#ratings-senate",
    ) as HTMLSelectElement;
    expect(marketSelect).not.toBeNull();
    expect(marketSelect.value).toBe("");

    // Selecting a market deselects ratings and polling.
    setSelectValue(marketSelect, "polymarket");
    expect(marketSelect.value).toBe("polymarket");
    expect(pollSelect.value).toBe("");
    expect(ratingsSelect.value).toBe("");

    // Live odds arrive and color Georgia by implied win probability.
    await waitForStateFlush();
    await waitForStateFlush();
    const georgia = container.querySelector('path[data-id="13"]')?.getAttribute("fill");
    expect(georgia).not.toBeNull();
    expect(georgia).not.toBe(RATING_COLOR[SENATE_2026_RATINGS["13"]]);

    // Choosing a poll drops the market overlay.
    setSelectValue(pollSelect, "avg-10");
    expect(pollSelect.value).toBe("avg-10");
    expect(marketSelect.value).toBe("");
    expect(ratingsSelect.value).toBe("");

    // Choosing ratings drops polling.
    setSelectValue(ratingsSelect, "sabato");
    expect(ratingsSelect.value).toBe("sabato");
    expect(pollSelect.value).toBe("");
    expect(marketSelect.value).toBe("");

    globalThis.fetch = originalFetch;
    act(() => root.unmount());
  });
});
describe("App scoreboard projection", () => {
  const headline = (container: HTMLDivElement, party: "d" | "r") =>
    Number(
      container.querySelector(
        `.scoreboard__headline .scoreboard__number--${party}`,
      )?.textContent,
    );

  it("counts the poll leaders on the scoreboard while polling is selected", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;
    window.location.hash = "";

    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<App />));

    await waitForStateFlush();
    const senateTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Senate",
    )!;
    act(() => senateTab.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await waitForStateFlush();
    await waitForStateFlush();

    const ratingsD = headline(container, "d");
    const ratingsR = headline(container, "r");

    const pollSelect = container.querySelector(
      "#polling-option",
    ) as HTMLSelectElement;
    setSelectValue(pollSelect, "avg-10");

    // The scoreboard now follows the poll colors: un-polled states fall to
    // uncalled, so at least one headline number moves off the ratings totals.
    expect(headline(container, "d") !== ratingsD || headline(container, "r") !== ratingsR).toBe(
      true,
    );

    globalThis.fetch = originalFetch;
    act(() => root.unmount());
  });

  it("counts the market's projected winners on the scoreboard", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;
    window.location.hash = "";

    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<App />));

    await waitForStateFlush();
    const houseTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "House",
    )!;
    act(() => houseTab.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await waitForStateFlush();
    await waitForStateFlush();

    // The mocked market only prices TX-05 (Republican), so every other district
    // is uncalled and the headline shows a single Republican seat.
    const marketSelect = container.querySelector(
      "#market-source",
    ) as HTMLSelectElement;
    setSelectValue(marketSelect, "polymarket");
    await waitForStateFlush();
    await waitForStateFlush();

    expect(headline(container, "d")).toBe(0);
    expect(headline(container, "r")).toBe(1);

    globalThis.fetch = originalFetch;
    act(() => root.unmount());
  });
});

describe("App house market integration", () => {
  it("colors the house map from Polymarket district markets", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;
    window.location.hash = "";

    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<App />));

    await waitForStateFlush();
    const houseTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "House",
    )!;
    act(() => houseTab.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await waitForStateFlush();
    await waitForStateFlush();

    const marketSelect = container.querySelector(
      "#market-source",
    ) as HTMLSelectElement;
    const ratingsSelect = container.querySelector(
      "#ratings-house",
    ) as HTMLSelectElement;
    expect(marketSelect).not.toBeNull();
    expect(ratingsSelect).not.toBeNull();

    setSelectValue(marketSelect, "polymarket");
    expect(marketSelect.value).toBe("polymarket");
    expect(ratingsSelect.value).toBe("");

    await waitForStateFlush();
    await waitForStateFlush();
    expect(container.textContent).toContain("1 of 435 races");
    const texas = container
      .querySelector('path[data-id="4805"]')
      ?.getAttribute("fill");
    expect(texas).not.toBeNull();

    globalThis.fetch = originalFetch;
    act(() => root.unmount());
  });
});

describe("App house 2024 swing integration", () => {
  it("starts the house map from the 2024 result and applies a uniform swing", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;
    window.location.hash = "";

    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<App />));

    await waitForStateFlush();
    const houseTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "House",
    )!;
    act(() => houseTab.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await waitForStateFlush();
    await waitForStateFlush();

    const panel = Array.from(container.querySelectorAll(".panel")).find(
      (p) => p.querySelector(".panel__title")?.textContent === "2024 Baseline",
    );
    expect(panel).not.toBeUndefined();

    const toggle = panel!.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    const slider = panel!.querySelector("#house-swing") as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    expect(slider.disabled).toBe(true);

    const fill = (id: string) =>
      container?.querySelector(`path[data-id="${id}"]`)?.getAttribute("fill") ??
      null;
    const dCount = () =>
      Number(
        container?.querySelector(
          ".scoreboard__headline .scoreboard__number--d",
        )?.textContent,
      );

    // Enabling the baseline colors every district from its 2024 presidential
    // margin and deselects the ratings dropdown.
    act(() => toggle.click());
    await waitForStateFlush();
    expect(toggle.checked).toBe(true);
    expect(slider.disabled).toBe(false);
    expect(fill("0101")).toBe(swingColor(-36));
    const ratingsSelect = container.querySelector(
      "#ratings-house",
    ) as HTMLSelectElement;
    expect(ratingsSelect.value).toBe("");

    // A uniform Democratic swing flips seats, growing the scoreboard's D count.
    const dAtZero = dCount();
    setRangeValue(slider, "20");
    await waitForStateFlush();
    expect(Number(slider.value)).toBe(20);
    expect(dCount()).toBeGreaterThan(dAtZero);

    // Choosing a market drops the swing view.
    const marketSelect = container.querySelector(
      "#market-source",
    ) as HTMLSelectElement;
    setSelectValue(marketSelect, "polymarket");
    await waitForStateFlush();
    expect(toggle.checked).toBe(false);

    globalThis.fetch = originalFetch;
    act(() => root.unmount());
  });
});

describe("App governor integration", () => {
  it("renders the governor map with its own ratings and polling", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;
    window.location.hash = "";

    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<App />));

    await waitForStateFlush();
    const governorTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Governor",
    )!;
    act(() =>
      governorTab.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    await waitForStateFlush();
    await waitForStateFlush();

    const path = (id: string) =>
      container?.querySelector(`path[data-id="${id}"]`)?.getAttribute("fill") ??
      null;

    const ratingsSelect = container.querySelector(
      "#ratings-governor",
    ) as HTMLSelectElement;
    const pollSelect = container.querySelector(
      "#polling-option",
    ) as HTMLSelectElement;
    expect(ratingsSelect).not.toBeNull();
    expect(pollSelect).not.toBeNull();

    // The governor map loads Cook's governor ratings (not the Senate ones).
    expect(ratingsSelect.value).toBe("cook");
    expect(path("06")).toBe(RATING_COLOR[GOVERNOR_2026_RATINGS["06"]]);

    // Selecting a poll deselects the ratings dropdown and overlays polling.
    setSelectValue(pollSelect, "avg-10");
    expect(pollSelect.value).toBe("avg-10");
    expect(ratingsSelect.value).toBe("");
    expect(path("13")).not.toBe(RATING_COLOR[GOVERNOR_2026_RATINGS["13"]]);

    globalThis.fetch = originalFetch;
    act(() => root.unmount());
  });
});

describe("State Analyzer integration", () => {
  it("opens the analyzer, shows a state's districts, and switches elections", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;
    window.location.hash = "";

    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<App />));

    await waitForStateFlush();
    const analyzerTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "State Analyzer",
    )!;
    act(() =>
      analyzerTab.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    await waitForStateFlush();

    const stateSelect = container.querySelector(
      "#analyzer-state",
    ) as HTMLSelectElement;
    const electionSelect = container.querySelector(
      "#analyzer-election",
    ) as HTMLSelectElement;
    expect(stateSelect).not.toBeNull();
    expect(stateSelect.value).toBe("06");
    expect(electionSelect.value).toBe("house");
    // California's 52 districts are drawn.
    expect(container.querySelectorAll("path.region")).toHaveLength(52);

    // Statewide races collapse the map to the state outline. California has a
    // 2026 governor race, and the election dropdown no longer offers President.
    expect(
      Array.from(electionSelect.options).map((option) => option.value),
    ).not.toContain("president");
    setSelectValue(electionSelect, "governor");
    expect(container.querySelectorAll("path.region")).toHaveLength(1);

    globalThis.fetch = originalFetch;
    act(() => root.unmount());
  });
});
