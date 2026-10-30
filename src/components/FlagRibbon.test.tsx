import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { FlagRibbon } from "./FlagRibbon";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => vi.useRealTimers());

it("counts down to midnight Eastern and switches to Election Day without negative values", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-02T23:59:58-05:00"));
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => root.render(<FlagRibbon />));
  expect(container.querySelector('[aria-label="2 seconds"]')).not.toBeNull();
  act(() => vi.advanceTimersByTime(1000));
  expect(container.querySelector('[aria-label="1 seconds"]')).not.toBeNull();
  act(() => vi.advanceTimersByTime(1000));
  expect(container.textContent).toContain("It's Election Day");
  act(() => root.unmount());
  expect(vi.getTimerCount()).toBe(0);
});

it("uses a past-election label after Election Day", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-04T00:00:00-05:00"));
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => root.render(<FlagRibbon />));
  expect(container.textContent).toBe("Election Day · November 3, 2026");
  expect(container.querySelector('.election-countdown__digits')).toBeNull();
  act(() => root.unmount());
});
