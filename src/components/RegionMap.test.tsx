import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import type { Assignment, RegionFeature } from "../types";
import { RegionMap } from "./RegionMap";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function loadStates(): RegionFeature[] {
  const file = resolve(process.cwd(), "public/data", "states.json");
  return (
    JSON.parse(readFileSync(file, "utf8")) as { features: RegionFeature[] }
  ).features;
}

let container: HTMLDivElement | null = null;

/** jsdom has no PointerEvent; a MouseEvent with pointerId covers our usage. */
function pointerEvent(
  type: string,
  init: MouseEventInit & { pointerId?: number },
): Event {
  const event = new MouseEvent(type, init);
  Object.defineProperty(event, "pointerId", { value: init.pointerId ?? 1 });
  return event;
}

afterEach(() => {
  container?.remove();
  container = null;
});

describe("RegionMap", () => {
  it("renders one path per region and dispatches clicks by id", () => {
    const features = loadStates();
    const clicked: string[] = [];
    container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    act(() => {
      root.render(
        <RegionMap
          features={features}
          getId={(f) => String(f.properties.fips)}
          getLabel={(f) => String(f.properties.name)}
          isActive={() => true}
          assignments={{ "06": "D" } as Record<string, Assignment>}
          onRegionClick={(id) => clicked.push(id)}
        />,
      );
    });

    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(51);

    const california = container.querySelector('path[data-id="06"]');
    expect(california?.getAttribute("fill")).toBe("#1b3a78");

    act(() => {
      california?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(clicked).toEqual(["06"]);

    act(() => root.unmount());
  });

  it("zooms on wheel, pans on drag, and suppresses clicks after a drag", () => {
    const features = loadStates();
    const clicked: string[] = [];
    container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    act(() => {
      root.render(
        <RegionMap
          features={features}
          getId={(f) => String(f.properties.fips)}
          getLabel={(f) => String(f.properties.name)}
          isActive={() => true}
          assignments={{}}
          onRegionClick={(id) => clicked.push(id)}
        />,
      );
    });

    const svg = container.querySelector("svg")!;
    // jsdom reports zero-size boxes; give the svg a real rect so client
    // coordinates map 1:1 onto viewBox coordinates.
    svg.getBoundingClientRect = () =>
      ({
        width: 975,
        height: 610,
        left: 0,
        top: 0,
        right: 975,
        bottom: 610,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    const transformOf = () =>
      container?.querySelector("g")?.getAttribute("transform") ?? "";
    const scaleOf = () => {
      const match = /scale\(([^)]+)\)/.exec(transformOf());
      return match ? Number.parseFloat(match[1]) : Number.NaN;
    };

    expect(transformOf()).toBe("translate(0 0) scale(1)");

    act(() => {
      svg.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: -120,
          clientX: 400,
          clientY: 300,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    const zoomed = scaleOf();
    expect(zoomed).toBeGreaterThan(1);
    const beforeDrag = transformOf();

    act(() => {
      svg.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
          button: 0,
          bubbles: true,
        }),
      );
    });
    act(() => {
      window.dispatchEvent(
        pointerEvent("pointermove", {
          pointerId: 1,
          clientX: 160,
          clientY: 150,
        }),
      );
    });
    const panned = transformOf();
    act(() => {
      window.dispatchEvent(
        pointerEvent("pointerup", {
          pointerId: 1,
          clientX: 160,
          clientY: 150,
        }),
      );
    });

    expect(panned).not.toBe(beforeDrag);
    expect(panned).toContain(`scale(${zoomed}`);

    // A click right after a drag is a pan release, not a region click.
    const california = container.querySelector('path[data-id="06"]');
    act(() => {
      california?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(clicked).toEqual([]);

    // A plain click still assigns the region.
    act(() => {
      california?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(clicked).toEqual(["06"]);

    // The reset button restores the default view.
    const reset = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Reset",
    )!;
    expect(reset.disabled).toBe(false);
    act(() => {
      reset.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(transformOf()).toBe("translate(0 0) scale(1)");

    act(() => root.unmount());
  });

  it("stripes districts whose projected party flips the seat", () => {
    const features = loadStates();
    container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    act(() => {
      root.render(
        <RegionMap
          features={features}
          getId={(f) => String(f.properties.fips)}
          getLabel={(f) => String(f.properties.name)}
          isActive={() => true}
          assignments={{ "10": "SOLID_R" } as Record<string, Assignment>}
          onRegionClick={() => {}}
          stripePickups
          getIncumbent={(id) => (id === "10" ? "D" : null)}
        />,
      );
    });

    const delaware = container.querySelector('path[data-id="10"]');
    // A D-held seat projected Republican is a flip: striped with two reds.
    expect(delaware?.getAttribute("fill")).toBe("url(#pickup-RD-SOLID_R)");
    const pattern = container.querySelector('pattern[id="pickup-RD-SOLID_R"]');
    expect(pattern).not.toBeNull();
    const bands = pattern?.querySelectorAll("rect") ?? [];
    expect(bands).toHaveLength(2);
    expect(bands[0]?.getAttribute("fill")).toBe("#8f1d14");
    expect(bands[1]?.getAttribute("fill")).toBe("#ab564f");
    expect(bands[0]?.getAttribute("fill")).not.toBe(bands[1]?.getAttribute("fill"));
    // The confidence band is drawn wider than the lighter partner band.
    expect(Number(bands[0]?.getAttribute("width"))).toBeGreaterThan(
      Number(bands[1]?.getAttribute("width")),
    );
    // No flip here (no incumbent known), so it keeps its solid shade.
    expect(
      container.querySelector('path[data-id="06"]')?.getAttribute("fill"),
    ).toBe("#e4e6eb");

    act(() => root.unmount());
  });

  it("does not stripe when the parties match or striping is disabled", () => {    const features = loadStates();
    container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    act(() => {
      root.render(
        <RegionMap
          features={features}
          getId={(f) => String(f.properties.fips)}
          getLabel={(f) => String(f.properties.name)}
          isActive={() => true}
          assignments={{ "10": "SOLID_D" } as Record<string, Assignment>}
          onRegionClick={() => {}}
          stripePickups
          getIncumbent={(id) => (id === "10" ? "D" : null)}
        />,
      );
    });

    // Same party as the incumbent: stays a solid Democrat shade.
    expect(
      container.querySelector('path[data-id="10"]')?.getAttribute("fill"),
    ).toBe("#1b3a78");
    expect(container.querySelector("pattern")).toBeNull();

    act(() => root.unmount());
    container.remove();

    container = document.createElement("div");
    document.body.appendChild(container);
    const root2 = createRoot(container);
    act(() => {
      root2.render(
        <RegionMap
          features={features}
          getId={(f) => String(f.properties.fips)}
          getLabel={(f) => String(f.properties.name)}
          isActive={() => true}
          assignments={{ "10": "SOLID_R" } as Record<string, Assignment>}
          onRegionClick={() => {}}
          getIncumbent={(id) => (id === "10" ? "D" : null)}
        />,
      );
    });

    // With striping off, a flip shows its plain projected color instead.
    expect(
      container.querySelector('path[data-id="10"]')?.getAttribute("fill"),
    ).toBe("#8f1d14");
    expect(container.querySelector("pattern")).toBeNull();

    act(() => root2.unmount());
  });

  it("fills states from a polling overlay and shows it in the tooltip", () => {
    const features = loadStates();
    container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    act(() => {
      root.render(
        <RegionMap
          features={features}
          getId={(f) => String(f.properties.fips)}
          getLabel={(f) => String(f.properties.name)}
          isActive={() => true}
          assignments={{ "06": "SOLID_R" } as Record<string, Assignment>}
          onRegionClick={() => {}}
          stripePickups
          getIncumbent={() => "D"}
          poll={{
            fills: { "06": "#1b3a78" },
            summaryFor: (id) =>
              id === "06"
                ? {
                    d: 52,
                    r: 46,
                    margin: 6,
                    leader: "D" as const,
                    polls: 3,
                    latest: "2026-09-20",
                  }
                : null,
            optionLabel: "Average of last 10 polls",
            isPainted: () => false,
          }}
        />,
      );
    });

    // The overlay color wins over the assignment. The poll leader (D) matches
    // the incumbent (D), so this is not a pickup and no stripe is drawn.
    expect(
      container.querySelector('path[data-id="06"]')?.getAttribute("fill"),
    ).toBe("#1b3a78");
    expect(container.querySelector("pattern")).toBeNull();
    // A state with no matching polls falls back to the unassigned color.
    expect(
      container.querySelector('path[data-id="10"]')?.getAttribute("fill"),
    ).toBe("#e4e6eb");

    const california = container.querySelector(
      'path[data-id="06"]',
    ) as SVGPathElement;
    act(() => {
      california.dispatchEvent(
        new MouseEvent("pointermove", {
          clientX: 10,
          clientY: 10,
          bubbles: true,
        }),
      );
    });
    expect(container.querySelector(".tooltip")?.textContent).toContain(
      "D +6.0 (D 52.0 / R 46.0) · Average of last 10 polls (3 polls)",
    );

    act(() => root.unmount());
  });

  it("stripes a poll-projected pickup with its poll shade", () => {
    const features = loadStates();
    container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    act(() => {
      root.render(
        <RegionMap
          features={features}
          getId={(f) => String(f.properties.fips)}
          getLabel={(f) => String(f.properties.name)}
          isActive={() => true}
          assignments={{ "06": "SOLID_D" } as Record<string, Assignment>}
          onRegionClick={() => {}}
          stripePickups
          // "06" is held by an R; "10" is held by a D but is not polled.
          getIncumbent={(id) => (id === "06" ? "R" : "D")}
          poll={{
            fills: { "06": "#6f9fd8" },
            summaryFor: (id) =>
              id === "06"
                ? {
                    d: 52,
                    r: 46,
                    margin: 6,
                    leader: "D" as const,
                    polls: 3,
                    latest: "2026-09-20",
                  }
                : null,
            optionLabel: "Average of last 10 polls",
            isPainted: () => false,
          }}
        />,
      );
    });

    // An R-held seat polling Democratic is a pickup: the poll shade becomes
    // the confidence band and the fixed darker blue the other band.
    const delaware = container.querySelector('path[data-id="06"]');
    expect(delaware?.getAttribute("fill")).toBe(
      "url(#pickup-poll-DR-6f9fd8)",
    );
    const pattern = container.querySelector(
      'pattern[id="pickup-poll-DR-6f9fd8"]',
    );
    expect(pattern).not.toBeNull();
    const bands = pattern?.querySelectorAll("rect") ?? [];
    expect(bands).toHaveLength(2);
    expect(bands[0]?.getAttribute("fill")).toBe("#6f9fd8");
    expect(bands[1]?.getAttribute("fill")).toBe("#93b7e2");
    // A state with no matching poll stays grey with no stripe.
    expect(
      container.querySelector('path[data-id="10"]')?.getAttribute("fill"),
    ).toBe("#e4e6eb");

    // The tooltip names the pickup direction on top of the poll aggregate.
    const california = container.querySelector(
      'path[data-id="06"]',
    ) as SVGPathElement;
    act(() => {
      california.dispatchEvent(
        new MouseEvent("pointermove", {
          clientX: 10,
          clientY: 10,
          bubbles: true,
        }),
      );
    });
    expect(container.querySelector(".tooltip")?.textContent).toContain(
      "· D pickup",
    );

    act(() => root.unmount());
  });

  it("lets a painted state show its own color over the polling overlay", () => {
    const features = loadStates();
    container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    act(() => {
      root.render(
        <RegionMap
          features={features}
          getId={(f) => String(f.properties.fips)}
          getLabel={(f) => String(f.properties.name)}
          isActive={() => true}
          // "06" is user-painted (flat party); "10" still holds a rating.
          assignments={{ "06": "R", "10": "SOLID_R" } as Record<string, Assignment>}
          onRegionClick={() => {}}
          poll={{
            fills: { "06": "#1b3a78", "10": "#1b3a78" },
            summaryFor: () => null,
            optionLabel: "Average of all polls",
            isPainted: (id) => id === "06",
          }}
        />,
      );
    });

    // The painted state shows its flat party color, not the poll fill...
    expect(
      container.querySelector('path[data-id="06"]')?.getAttribute("fill"),
    ).toBe("#8f1d14");
    // ...while a rated (unpainted) state keeps its poll fill.
    expect(
      container.querySelector('path[data-id="10"]')?.getAttribute("fill"),
    ).toBe("#1b3a78");

    const california = container.querySelector(
      'path[data-id="06"]',
    ) as SVGPathElement;
    act(() => {
      california.dispatchEvent(
        new MouseEvent("pointermove", {
          clientX: 10,
          clientY: 10,
          bubbles: true,
        }),
      );
    });
    // The tooltip reports the paint, not a poll aggregate.
    expect(container.querySelector(".tooltip")?.textContent).toContain(
      "· Republican",
    );

    act(() => root.unmount());
  });

  it("stripes a painted state's pickup over the polling overlay", () => {
    const features = loadStates();
    container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    act(() => {
      root.render(
        <RegionMap
          features={features}
          getId={(f) => String(f.properties.fips)}
          getLabel={(f) => String(f.properties.name)}
          isActive={() => true}
          // "06" is user-painted R while the holder is D, so the paint is a
          // pickup and should stripe even in the poll view.
          assignments={{ "06": "R" } as Record<string, Assignment>}
          onRegionClick={() => {}}
          stripePickups
          getIncumbent={(id) => (id === "06" ? "D" : null)}
          poll={{
            fills: { "06": "#1b3a78", "10": "#1b3a78" },
            summaryFor: () => null,
            optionLabel: "Average of all polls",
            isPainted: (id) => id === "06",
          }}
        />,
      );
    });

    // The paint wins over the poll fill and is striped by its own party color.
    expect(
      container.querySelector('path[data-id="06"]')?.getAttribute("fill"),
    ).toBe("url(#pickup-RD-R)");
    const bands =
      container
        .querySelector('pattern[id="pickup-RD-R"]')
        ?.querySelectorAll("rect") ?? [];
    expect(bands[0]?.getAttribute("fill")).toBe("#8f1d14");
    expect(bands[1]?.getAttribute("fill")).toBe("#ab564f");

    const california = container.querySelector(
      'path[data-id="06"]',
    ) as SVGPathElement;
    act(() => {
      california.dispatchEvent(
        new MouseEvent("pointermove", {
          clientX: 10,
          clientY: 10,
          bubbles: true,
        }),
      );
    });
    // The tooltip reports the paint and the pickup direction.
    expect(container.querySelector(".tooltip")?.textContent).toContain(
      "· Republican · R pickup",
    );

    act(() => root.unmount());
  });

  it("uses a custom overlay description in the tooltip", () => {
    const features = loadStates();
    container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    act(() => {
      root.render(
        <RegionMap
          features={features}
          getId={(f) => String(f.properties.fips)}
          getLabel={(f) => String(f.properties.name)}
          isActive={() => true}
          assignments={{ "06": "SOLID_R" } as Record<string, Assignment>}
          onRegionClick={() => {}}
          poll={{
            fills: { "06": "#1b3a78" },
            summaryFor: () => null,
            optionLabel: "Polymarket",
            isPainted: () => false,
            describe: (id) =>
              id === "06" ? "Ossoff (D) 95% · D 95% / R 5%" : null,
          }}
        />,
      );
    });

    const california = container.querySelector(
      'path[data-id="06"]',
    ) as SVGPathElement;
    act(() => {
      california.dispatchEvent(
        new MouseEvent("pointermove", {
          clientX: 10,
          clientY: 10,
          bubbles: true,
        }),
      );
    });
    expect(container.querySelector(".tooltip")?.textContent).toContain(
      "· Ossoff (D) 95% · D 95% / R 5%",
    );

    // A state with no quote reports as such rather than as "no polls".
    const delaware = container.querySelector(
      'path[data-id="10"]',
    ) as SVGPathElement;
    act(() => {
      delaware.dispatchEvent(
        new MouseEvent("pointermove", {
          clientX: 10,
          clientY: 10,
          bubbles: true,
        }),
      );
    });
    expect(container.querySelector(".tooltip")?.textContent).toContain(
      "· no market",
    );

    act(() => root.unmount());
  });
});
