import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { CandidateCards } from "./CandidateCards";
import type { Candidate } from "../data/candidates";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const candidate: Candidate = { name: "Dan Osborn", party: "Independent", partyCode: "I", source: "https://en.wikipedia.org/wiki/Test" };
it("shows candidate names, actual parties, polling shares, and a graceful missing-photo avatar", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => root.render(<CandidateCards candidates={[candidate, { ...candidate, name: "Deb Fischer", party: "Republican", partyCode: "R" }]} summary={{ d: 48, r: 46, margin: 2, leader: "D", polls: 5, latest: "2026-10-30" }} />));
  expect(container.querySelector('.candidate--i')?.textContent).toContain("IndependentDan Osborn48.0%");
  expect(container.querySelector('.candidate--r')?.textContent).toContain("Deb Fischer46.0%");
  expect(container.querySelector('[aria-label="Portrait unavailable for Dan Osborn"]')).not.toBeNull();
  act(() => root.unmount());
});
it("replaces a broken portrait with initials without losing the candidate's name", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => root.render(<CandidateCards candidates={[{ ...candidate, photo: "https://example.com/portrait.jpg", photoSource: "https://example.com/credit" }]} />));
  act(() => container.querySelector('img')!.dispatchEvent(new Event('error')));
  expect(container.querySelector('img')).toBeNull();
  expect(container.querySelector('.candidate__initials')?.textContent).toBe("DO");
  expect(container.querySelector('.candidate__name')?.textContent).toBe("Dan Osborn");
  act(() => root.unmount());
});
