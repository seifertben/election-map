import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShareMap } from "./ShareMap";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const share = { title: "My 2026 Senate election map", url: "https://www.mapelection.com/?m=senate&n=35&c=ABC_-" };
const file = new File(["map"], "election-map-senate.png", { type: "image/png" });
const copy = vi.fn();
const nativeShare = vi.fn();
const revoke = vi.fn();
const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");

beforeEach(() => {
  vi.stubGlobal("navigator", { clipboard: { writeText: copy }, share: nativeShare, canShare: () => true });
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = () => "blob:map-preview";
    static revokeObjectURL = revoke;
  });
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function(this: HTMLDialogElement) {
    this.setAttribute("open", "");
    this.querySelector<HTMLButtonElement>("button")?.focus();
  } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute("open"); } });
  copy.mockReset().mockResolvedValue(undefined);
  nativeShare.mockReset().mockResolvedValue(undefined);
  revoke.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  for (const [name, descriptor] of [["showModal", originalShowModal], ["close", originalClose]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>)[name];
  }
});

const button = (label: string) => [...container.querySelectorAll("button")].find((el) => el.textContent === label)!;
const click = async (label: string) => act(async () => button(label).click());

async function render(prepareImage = async () => file, onClose = vi.fn()) {
  await act(async () => root.render(<ShareMap share={share} prepareImage={prepareImage} onClose={onClose} />));
  return onClose;
}

describe("ShareMap", () => {
  it("offers eight compose links, an exact PNG, copy, and native link/image sharing", async () => {
    await render();
    expect(container.querySelector("dialog")!.open).toBe(true);
    const sites = container.querySelectorAll<HTMLAnchorElement>(".share-map__sites a");
    expect(sites).toHaveLength(8);
    for (const site of sites) {
      expect(site.target).toBe("_blank");
      expect(site.rel).toContain("noopener");
    }
    expect(container.querySelector<HTMLAnchorElement>("a[download]")!.download).toBe(file.name);
    expect(container.querySelector<HTMLImageElement>("img")!.src).toBe("blob:map-preview");
    await click("Copy map link");
    expect(copy).toHaveBeenCalledWith(share.url);
    expect(container.querySelector('[role="status"]')!.textContent).toBe("Map link copied.");
    await click("More apps…");
    expect(nativeShare).toHaveBeenLastCalledWith({ title: share.title, text: share.title, url: share.url });
    await click("Share image to apps…");
    expect(nativeShare).toHaveBeenLastCalledWith({ title: share.title, text: share.title, url: share.url, files: [file] });
  });

  it("keeps social and manual copy options available when native sharing and image generation are unavailable", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: copy } });
    copy.mockRejectedValue(new Error("Clipboard blocked"));
    await render(async () => { throw new Error("Canvas unavailable"); });
    expect(container.querySelectorAll(".share-map__sites a")).toHaveLength(8);
    expect(button("More apps…")).toBeUndefined();
    expect(container.textContent).toContain("Image unavailable");
    await click("Copy map link");
    expect(container.querySelector("input")!.value).toBe(share.url);
    expect(container.querySelector('[role="status"]')!.textContent).toContain("Select and copy");
  });

  it("treats cancelled native sharing quietly and reports actual failures", async () => {
    await render();
    nativeShare.mockRejectedValueOnce(new DOMException("Cancelled", "AbortError"));
    await click("More apps…");
    expect(container.querySelector('[role="status"]')!.textContent).toBe("");
    nativeShare.mockRejectedValueOnce(new Error("Share unavailable"));
    await click("More apps…");
    expect(container.querySelector('[role="status"]')!.textContent).toContain("Sharing is unavailable");
  });

  it("closes on Escape, returns focus, and releases the preview URL", async () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const onClose = await render();
    act(() => container.querySelector("dialog")!.dispatchEvent(new Event("cancel", { cancelable: true })));
    expect(onClose).toHaveBeenCalledOnce();
    act(() => root.unmount());
    expect(document.activeElement).toBe(trigger);
    expect(revoke).toHaveBeenCalledWith("blob:map-preview");
    trigger.remove();
    root = createRoot(container);
  });
});
