import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { MARKET_NONE_ID, MARKET_SOURCES } from "../lib/markets";
import { MarketPanel } from "./MarketPanel";
import type { MarketPanelProps } from "./MarketPanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let container: HTMLDivElement | null = null;
afterEach(() => {
  container?.remove();
  container = null;
});

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

function render(props: Partial<MarketPanelProps> = {}) {
  container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <MarketPanel
        sourceId={MARKET_NONE_ID}
        onChange={() => {}}
        status="idle"
        asOf={null}
        count={0}
        error={null}
        isCustom={false}
        active={false}
        onRefresh={() => {}}
        onReapply={() => {}}
        raceLabel="Senate"
        raceCount={35}
        sources={MARKET_SOURCES}
        {...props}
      />,
    );
  });
  return root;
}

describe("MarketPanel dropdown", () => {
  it("lists the market sources and emits changes", () => {
    let selected = MARKET_NONE_ID;
    const root = render({
      onChange: (id) => {
        selected = id;
      },
    });
    const select = container!.querySelector("#market-source") as HTMLSelectElement;
    const values = Array.from(select.querySelectorAll("option")).map(
      (o) => (o as HTMLOptionElement).value,
    );
    expect(values).toContain("polymarket");

    setSelectValue(select, "polymarket");
    expect(selected).toBe("polymarket");
    act(() => root.unmount());
  });

  it("prompts for a market before one is selected", () => {
    const root = render();
    expect(container!.textContent).toContain("Pick a market");
    act(() => root.unmount());
  });

  it("shows a retry button on error", () => {
    let refreshed = 0;
    const root = render({
      sourceId: "polymarket",
      status: "error",
      error: "429",
      onRefresh: () => {
        refreshed += 1;
      },
    });
    expect(container!.textContent).toContain("Couldn't load live odds");
    const button = Array.from(container!.querySelectorAll("button")).find(
      (b) => b.textContent === "Retry",
    );
    act(() => button?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(refreshed).toBe(1);
    act(() => root.unmount());
  });

  it("reports live coverage and offers a manual refresh", () => {
    let refreshed = 0;
    const root = render({
      sourceId: "polymarket",
      status: "live",
      asOf: "2026-09-25T19:43:53.318287Z",
      count: 34,
      onRefresh: () => {
        refreshed += 1;
      },
    });
    expect(container!.textContent).toContain("34 of 35 races");
    const button = Array.from(container!.querySelectorAll("button")).find(
      (b) => b.textContent === "Refresh",
    );
    act(() => button?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(refreshed).toBe(1);
    act(() => root.unmount());
  });

  it("offers a re-apply button when the map is customized", () => {
    let reapplied = 0;
    const root = render({
      sourceId: "polymarket",
      status: "live",
      count: 35,
      isCustom: true,
      onReapply: () => {
        reapplied += 1;
      },
    });
    const button = Array.from(container!.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Re-apply market"),
    );
    expect(button).toBeDefined();
    act(() => button?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(reapplied).toBe(1);
    act(() => root.unmount());
  });
});
