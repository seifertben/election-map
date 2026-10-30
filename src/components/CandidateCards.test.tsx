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

it("ranks polling shares highest first and follows updated ratings when polls are absent", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  const candidates: Candidate[] = [
    { ...candidate, name: "Democrat", party: "Democratic", partyCode: "D" },
    { ...candidate, name: "Republican", party: "Republican", partyCode: "R" },
  ];
  const names = () => [...container.querySelectorAll('.candidate__name')].map(el => el.textContent);
  act(() => root.render(<CandidateCards candidates={candidates} favoredParty="D" summary={{ d: 43, r: 51, margin: -8, leader: "R", polls: 5, latest: "2026-10-30" }} />));
  expect(names()).toEqual(["Republican", "Democrat"]);
  act(() => root.render(<CandidateCards candidates={candidates} favoredParty="R" />));
  expect(names()).toEqual(["Republican", "Democrat"]);
  act(() => root.render(<CandidateCards candidates={candidates} favoredParty="D" />));
  expect(names()).toEqual(["Democrat", "Republican"]);
  act(() => root.unmount());
});

it("ranks independent challengers by their polling share and keeps ties in source order", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  const candidates: Candidate[] = [{ ...candidate, name: "Republican", party: "Republican", partyCode: "R" }, candidate];
  const names = () => [...container.querySelectorAll('.candidate__name')].map(el => el.textContent);
  act(() => root.render(<CandidateCards candidates={candidates} summary={{ d: 51, r: 45, margin: 6, leader: "D", polls: 5, latest: "2026-10-30" }} />));
  expect(names()).toEqual(["Dan Osborn", "Republican"]);
  act(() => root.render(<CandidateCards candidates={candidates} favoredParty="D" summary={{ d: 48, r: 48, margin: 0, leader: "D", polls: 5, latest: "2026-10-30" }} />));
  expect(names()).toEqual(["Republican", "Dan Osborn"]);
  act(() => root.unmount());
});

it("uses market/model estimates for ordering and does not assign party shares to same-party candidates", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  const projection = { d: 30, r: 70, margin: -40, leader: "R" as const, polls: 0, latest: "" };
  const candidates: Candidate[] = [{ ...candidate, name: "Democrat", party: "Democratic", partyCode: "D" }, { ...candidate, name: "Republican", party: "Republican", partyCode: "R" }];
  act(() => root.render(<CandidateCards candidates={candidates} projection={projection} />));
  expect(container.querySelector('.candidate__name')?.textContent).toBe("Republican");
  expect(container.querySelector('.candidate__share')).toBeNull();
  act(() => root.render(<CandidateCards candidates={[candidates[0], { ...candidates[0], name: "Other Democrat" }]} summary={projection} />));
  expect(container.querySelector('.candidate__share')).toBeNull();
  expect(container.querySelector('.candidate__name')?.textContent).toBe("Democrat");
  act(() => root.unmount());
});
