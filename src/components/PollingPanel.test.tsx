import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { PollingPanel } from "./PollingPanel";
import {
  POLL_NONE_OPTION_ID,
  POLL_OPTIONS,
  POLL_OPTION_BY_ID,
} from "../lib/polling";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const baseProps = {
  raceLabel: "Senate",
  raceCount: 35,
  asOf: "2026-09-24",
  options: POLL_OPTIONS,
  active: false,
};

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

describe("PollingPanel dropdown", () => {
  it("starts with no overlay and turns it on when a poll is chosen", () => {
    let optionId = POLL_NONE_OPTION_ID;
    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const render = () => {
      act(() => {
        root.render(
          <div>
            <PollingPanel
              {...baseProps}
              optionId={optionId}
              onChange={(id) => {
                optionId = id;
              }}
              isCustom={false}
              onReapply={() => {}}
            />
            <span data-testid="overlay">
              {optionId === POLL_NONE_OPTION_ID ? "off" : "on"}
            </span>
          </div>,
        );
      });
    };

    render();
    const select = container.querySelector("select")!;
    expect(container.querySelector('[data-testid="overlay"]')?.textContent).toBe("off");

    setSelectValue(select, "avg-10");
    render();
    expect(container.querySelector('[data-testid="overlay"]')?.textContent).toBe("on");

    act(() => root.unmount());
  });

  it("exposes every option value that POLL_OPTION_BY_ID maps", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<PollingPanel {...baseProps} optionId={POLL_NONE_OPTION_ID} onChange={() => {}} isCustom={false} onReapply={() => {}} />);
    });
    const values = Array.from(container.querySelectorAll("option")).map(
      (o) => (o as HTMLOptionElement).value,
    );
    for (const value of values) {
      if (value === POLL_NONE_OPTION_ID) continue;
      expect(POLL_OPTION_BY_ID[value]).toBeDefined();
    }
    act(() => root.unmount());
  });

  it("offers a re-apply button only when the map is customized", () => {
    let reapplied = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <PollingPanel
          {...baseProps}
          optionId="avg-10"
          onChange={() => {}}
          isCustom={false}
          onReapply={() => {}}
        />,
      );
    });
    expect(container.textContent).not.toContain("Re-apply poll");

    act(() => {
      root.render(
        <PollingPanel
          {...baseProps}
          optionId="avg-10"
          onChange={() => {}}
          isCustom
          onReapply={() => {
            reapplied += 1;
          }}
        />,
      );
    });
    const button = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Re-apply poll"),
    );
    expect(button).toBeDefined();

    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(reapplied).toBe(1);

    act(() => root.unmount());
  });
});