import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { StateAnalyzer } from "./StateAnalyzer";
import { baselineSplitsForState } from "../lib/analyzerBaseline";
import type { DemographicsData, GeographyComposition } from "../lib/analyzer";
import type { RegionFeature } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function squareFeature(
  properties: Record<string, unknown>,
  lon: number,
  lat: number,
): RegionFeature {
  return {
    type: "Feature",
    properties,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [lon, lat],
          [lon + 2, lat],
          [lon + 2, lat + 2],
          [lon, lat + 2],
          [lon, lat],
        ],
      ],
    },
  };
}

const STATE: RegionFeature = squareFeature(
  { fips: "06", abbr: "CA", name: "California" },
  -122,
  36,
);
const OHIO: RegionFeature = squareFeature(
  { fips: "39", abbr: "OH", name: "Ohio" },
  -83,
  40,
);
const DISTRICTS: RegionFeature[] = [
  squareFeature(
    { geoid: "0601", state: "06", district: "01", name: "CA-01" },
    -122,
    36,
  ),
  squareFeature(
    { geoid: "0602", state: "06", district: "02", name: "CA-02" },
    -119,
    37,
  ),
];
const OHIO_DISTRICTS: RegionFeature[] = [
  squareFeature(
    { geoid: "3901", state: "39", district: "01", name: "OH-01" },
    -83,
    40,
  ),
];

function composition(
  sex: Record<string, number>,
  age: Record<string, number>,
): GeographyComposition {
  return {
    population: 1000,
    votingAgePopulation: 800,
    sex,
    age,
    race: { white: 1 },
    education: { hs: 1 },
    party: { democrat: 0.4, republican: 0.35, independent: 0.25 },
  };
}

const DEMOGRAPHICS: DemographicsData = {
  release: "test release",
  source: "test",
  fetched: "2026-01-01",
  states: { "06": composition({ male: 0.6, female: 0.4 }, { "18-29": 1 }) },
  districts: {
    "0601": {
      ...composition({ male: 0.7, female: 0.3 }, { "18-29": 1 }),
      partyEstimated: true,
    },
    "0602": composition({ male: 0.5, female: 0.5 }, { "18-29": 1 }),
  },
};

let container: HTMLDivElement | null = null;
let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

async function renderAnalyzer() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <StateAnalyzer
        states={[STATE]}
        districts={DISTRICTS}
        demographics={DEMOGRAPHICS}
        senateFips={new Set()}
        governorFips={new Set(["06"])}
      />,
    );
  });
}

async function renderAnalyzerWithPoll() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <StateAnalyzer
        states={[OHIO]}
        districts={[]}
        demographics={DEMOGRAPHICS}
        senateFips={new Set(["39"])}
        governorFips={new Set()}
      />,
    );
  });
}

async function renderAnalyzerWithHouseRace() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <StateAnalyzer
        states={[OHIO]}
        districts={OHIO_DISTRICTS}
        demographics={DEMOGRAPHICS}
        senateFips={new Set(["39"])}
        governorFips={new Set()}
      />,
    );
  });
}

async function renderAnalyzerWithGovernorPoll() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <StateAnalyzer
        states={[OHIO]}
        districts={[]}
        demographics={DEMOGRAPHICS}
        senateFips={new Set()}
        governorFips={new Set(["39"])}
      />,
    );
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

describe("StateAnalyzer", () => {
  it("renders the analyzer controls and one region per district by default", async () => {
    await renderAnalyzer();
    expect(container?.textContent).toContain("State Analyzer");
    expect(container?.querySelector("#analyzer-state")).not.toBeNull();
    expect(container?.querySelector("#analyzer-election")).not.toBeNull();
    expect(container?.querySelector("#analyzer-poll")).not.toBeNull();
    expect(container?.querySelectorAll("path.region")).toHaveLength(2);
  });

  it("collapses to a single region when a statewide election is chosen", async () => {
    await renderAnalyzer();
    const election = container?.querySelector<HTMLSelectElement>(
      "#analyzer-election",
    );
    expect(election).not.toBeNull();
    setSelectValue(election as HTMLSelectElement, "governor");
    expect(container?.querySelectorAll("path.region")).toHaveLength(1);
  });

  it("shows only one dimension's controls and swaps them on selection", async () => {
    await renderAnalyzer();
    // Race is the default lens: 5 categories x (share + split + other) = 15.
    expect(container?.querySelectorAll('input[type="range"]')).toHaveLength(15);
    const sexRadio = [...container!.querySelectorAll<HTMLInputElement>(
      'input[type="radio"]',
    )].find((input) => input.closest("label")?.textContent === "Sex");
    expect(sexRadio).toBeDefined();
    await act(async () => {
      sexRadio!.click();
    });
    // Sex has 2 categories x (share + split + other) = 6 sliders.
    expect(container?.querySelectorAll('input[type="range"]')).toHaveLength(6);
  });

  it("shows the active lens's district breakdown on hover", async () => {
    await renderAnalyzer();
    const district = container!.querySelector(
      'path[data-id="0601"]',
    ) as SVGPathElement;
    act(() => {
      district.dispatchEvent(
        new MouseEvent("pointermove", {
          clientX: 10,
          clientY: 10,
          bubbles: true,
        }),
      );
    });
    expect(
      container!.querySelector(".tooltip__breakdown")?.textContent,
    ).toContain("Race / ethnicity: White 100%");

    // Switching the lens swaps the hover breakdown to that dimension.
    const sexRadio = [...container!.querySelectorAll<HTMLInputElement>(
      'input[type="radio"]',
    )].find((input) => input.closest("label")?.textContent === "Sex");
    await act(async () => {
      sexRadio!.click();
    });
    expect(
      container!.querySelector(".tooltip__breakdown")?.textContent,
    ).toContain("Sex: Men 70% · Women 30%");
  });

  it("sets a share without moving the other shares", async () => {
    await renderAnalyzer();
    const ranges = [...container!.querySelectorAll<HTMLInputElement>(
      'input[type="range"]',
    )];
    // Each category has three sliders (share, D/R split, other), so shares sit
    // at indices 0, 3, 6, …
    const firstShare = ranges[0];
    const secondShare = ranges[3];
    const secondBefore = secondShare.value;
    // Census shares total 100%, so the total is flagged complete (green).
    expect(container?.querySelector(".analyzer__total-value--ok")).not.toBeNull();
    setRangeValue(firstShare, "30");
    expect(firstShare.value).toBe("30");
    expect(secondShare.value).toBe(secondBefore);
    // Dropping a share off 100% flips the indicator out of its complete state.
    expect(container?.querySelector(".analyzer__total-value--off")).not.toBeNull();
  });

  it("seeds the no-poll splits from the state's exit-poll baseline", async () => {
    await renderAnalyzer();
    const expected = baselineSplitsForState("06");
    const white = container?.querySelector<HTMLInputElement>(
      'input[aria-label="White (non-Hispanic) Democratic vote share"]',
    );
    expect(white?.value).toBe(String(Math.round(expected.race.white.d)));
  });

  it("moves the two split knobs independently", async () => {
    await renderAnalyzer();
    const split = container?.querySelector<HTMLInputElement>(
      'input[aria-label="White (non-Hispanic) Democratic vote share"]',
    );
    const other = container?.querySelector<HTMLInputElement>(
      'input[aria-label="White (non-Hispanic) other vote share"]',
    );
    expect(other).not.toBeNull();
    // The right knob marks where R ends and Other begins, so it starts at 100.
    expect(other!.value).toBe("100");
    const dBefore = split!.value;
    // Drag the right knob left: Other grows and the Democratic share holds.
    setRangeValue(other as HTMLInputElement, "80");
    expect(split!.value).toBe(dBefore);
    expect(other!.value).toBe("80");
    expect(container?.textContent).toContain("Other 20");
    // Drag the left knob: Other holds and the Democratic share moves.
    setRangeValue(split as HTMLInputElement, "10");
    expect(other!.value).toBe("80");
    expect(split!.value).toBe("10");
  });

  it("defaults flip striping off and toggles it on", async () => {
    await renderAnalyzer();
    const flip = [
      ...container!.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    ].find((input) =>
      input.closest("label")?.textContent?.includes("Stripe party flips"),
    );
    expect(flip).toBeDefined();
    expect(flip!.checked).toBe(false);
    await act(async () => {
      flip!.click();
    });
    expect(flip!.checked).toBe(true);
  });

  it("selects a district when it is clicked", async () => {
    await renderAnalyzer();
    const path = container?.querySelector<SVGPathElement>('path[data-id="0601"]');
    expect(path).not.toBeNull();
    await act(async () => {
      path?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container?.textContent).toContain("Selected");
  });

  it("loads a poll's crosstabs into the vote splits", async () => {
    await renderAnalyzerWithPoll();
    const poll = container?.querySelector<HTMLSelectElement>("#analyzer-poll");
    expect(poll).not.toBeNull();
    const values = [...poll!.querySelectorAll("option")].map((o) => o.value);
    expect(values).toContain("nyt-siena-2026-06-29");
    setSelectValue(poll as HTMLSelectElement, "nyt-siena-2026-06-29");
    // Race is the default lens. Each category is a block of three sliders
    // (share, D/R split, other): White share 77 / split D 41, then Black 11 / D 90.
    const ranges = [...container!.querySelectorAll<HTMLInputElement>(
      'input[type="range"]',
    )];
    expect(ranges[0].value).toBe("77");
    expect(ranges[1].value).toBe("41");
    expect(ranges[3].value).toBe("11");
    expect(ranges[4].value).toBe("90");
    // The panel reports the loaded poll's crosstab source.
    expect(container?.textContent).toContain("NYT/Siena");
  });

  it("flags a dimension the loaded poll does not break out by vote", async () => {
    await renderAnalyzerWithPoll();
    const poll = container?.querySelector<HTMLSelectElement>("#analyzer-poll");
    setSelectValue(poll as HTMLSelectElement, "insideradvantage-2026-09-09");
    // The default race lens is reported, so no fallback note yet.
    expect(container?.textContent).not.toContain("did not report vote splits");
    const educationRadio = [
      ...container!.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    ].find((input) => input.closest("label")?.textContent === "Education");
    await act(async () => {
      educationRadio!.click();
    });
    // InsiderAdvantage does not cross education with the vote, so the panel
    // says the splits fall back to the poll's overall result.
    expect(container?.textContent).toContain(
      "did not report vote splits for education",
    );
    // A poll that does break education out shows no such note.
    setSelectValue(poll as HTMLSelectElement, "nyt-siena-2026-06-29");
    expect(container?.textContent).not.toContain("did not report vote splits");
  });

  it("flags a house district's party breakdown estimated from the 2024 vote", async () => {
    await renderAnalyzer();
    const partyRadio = [
      ...container!.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    ].find((input) => input.closest("label")?.textContent === "Party ID");
    await act(async () => {
      partyRadio!.click();
    });
    const district = container!.querySelector(
      'path[data-id="0601"]',
    ) as SVGPathElement;
    act(() => {
      district.dispatchEvent(
        new MouseEvent("pointermove", {
          clientX: 10,
          clientY: 10,
          bubbles: true,
        }),
      );
    });
    expect(
      container!.querySelector(".tooltip__breakdown")?.textContent,
    ).toContain("(estimated from the 2024 vote)");

    // A district with its own CES party ID carries no estimate note.
    const other = container!.querySelector(
      'path[data-id="0602"]',
    ) as SVGPathElement;
    act(() => {
      other.dispatchEvent(
        new MouseEvent("pointermove", {
          clientX: 10,
          clientY: 10,
          bubbles: true,
        }),
      );
    });
    expect(
      container!.querySelector(".tooltip__breakdown")?.textContent,
    ).not.toContain("estimated from the 2024 vote");
  });

  it("resets a loaded poll's edited sliders back to its crosstabs", async () => {
    await renderAnalyzerWithPoll();
    const poll = container?.querySelector<HTMLSelectElement>("#analyzer-poll");
    setSelectValue(poll as HTMLSelectElement, "nyt-siena-2026-06-29");
    const resetButton = () =>
      [...container!.querySelectorAll<HTMLButtonElement>(".actions button")].find(
        (button) => button.textContent === "Reset poll",
      );
    // Freshly loaded poll: nothing to reset.
    expect(resetButton()?.disabled).toBe(true);
    // Move both a share and a vote-split slider away from the poll's White row
    // (share 77, split D 41).
    const ranges = [...container!.querySelectorAll<HTMLInputElement>(
      'input[type="range"]',
    )];
    setRangeValue(ranges[0], "50");
    setRangeValue(ranges[1], "10");
    expect(ranges[0].value).toBe("50");
    expect(ranges[1].value).toBe("10");
    expect(resetButton()?.disabled).toBe(false);
    await act(async () => {
      resetButton()?.click();
    });
    const restored = [...container!.querySelectorAll<HTMLInputElement>(
      'input[type="range"]',
    )];
    expect(restored[0].value).toBe("77");
    expect(restored[1].value).toBe("41");
    expect(resetButton()?.disabled).toBe(true);
  });

  it("offers a senate poll to a house race and flags it as an extrapolation", async () => {
    await renderAnalyzerWithHouseRace();
    const election = container?.querySelector<HTMLSelectElement>(
      "#analyzer-election",
    );
    expect(election?.value).toBe("house");
    const poll = container?.querySelector<HTMLSelectElement>("#analyzer-poll");
    const values = [...poll!.querySelectorAll("option")].map((o) => o.value);
    expect(values).toContain("nyt-siena-2026-06-29");
    setSelectValue(poll as HTMLSelectElement, "nyt-siena-2026-06-29");
    // The poll seeds the house race's splits and shares...
    const ranges = [...container!.querySelectorAll<HTMLInputElement>(
      'input[type="range"]',
    )];
    expect(ranges[0].value).toBe("77");
    // ...and the panel warns that its crosstabs are for another race.
    expect(container?.textContent).toContain("Extrapolation");
    expect(container?.textContent).toContain("Senate (2026) poll applied");
  });

  it("keeps a loaded poll when switching between races in the same state", async () => {
    await renderAnalyzerWithHouseRace();
    const poll = container?.querySelector<HTMLSelectElement>("#analyzer-poll");
    setSelectValue(poll as HTMLSelectElement, "nyt-siena-2026-06-29");
    const election = container?.querySelector<HTMLSelectElement>(
      "#analyzer-election",
    );
    setSelectValue(election as HTMLSelectElement, "senate");
    expect(
      container?.querySelector<HTMLSelectElement>("#analyzer-poll")?.value,
    ).toBe("nyt-siena-2026-06-29");
    expect(container?.textContent).not.toContain("Extrapolation");
  });

  it("loads a native governor poll without flagging an extrapolation", async () => {
    await renderAnalyzerWithGovernorPoll();
    const election = container?.querySelector<HTMLSelectElement>(
      "#analyzer-election",
    );
    expect(election?.value).toBe("governor");
    const poll = container?.querySelector<HTMLSelectElement>("#analyzer-poll");
    const values = [...poll!.querySelectorAll("option")].map((o) => o.value);
    expect(values).toContain("nyt-siena-2026-06-29-gov");
    setSelectValue(poll as HTMLSelectElement, "nyt-siena-2026-06-29-gov");
    // Race is the default lens. Ohio's June governor crosstab: White share 77 /
    // split D 41, then Black 11 / D 89.
    const ranges = [...container!.querySelectorAll<HTMLInputElement>(
      'input[type="range"]',
    )];
    expect(ranges[0].value).toBe("77");
    expect(ranges[1].value).toBe("41");
    expect(ranges[3].value).toBe("11");
    expect(ranges[4].value).toBe("89");
    expect(container?.textContent).not.toContain("Extrapolation");
  });
});
