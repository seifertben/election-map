import { describe, expect, it } from "vitest";
import { socialShareLinks } from "./sharing";
import { encodeShareHash } from "../state/encoding";

describe("social share links", () => {
  const share = {
    title: "My Senate map & predictions",
    url: "https://www.mapelection.com/?m=senate&n=35&c=ABC_-",
  };

  it("preserves the entire map URL and text across all eight destinations", () => {
    const links = socialShareLinks(share);
    expect(links.map((site) => site.label)).toEqual([
      "X", "Facebook", "Bluesky", "Threads", "Reddit", "LinkedIn", "WhatsApp", "Telegram",
    ]);
    for (const site of links) {
      const url = new URL(site.href);
      expect(url.protocol).toBe("https:");
      if (site.label === "Bluesky" || site.label === "WhatsApp") {
        expect(url.searchParams.get("text")).toBe(`${share.title}\n${share.url}`);
      } else {
        expect(url.searchParams.get(site.label === "Facebook" ? "u" : "url")).toBe(share.url);
      }
    }
    expect(new URL(links[0].href).searchParams.get("text")).toBe(share.title);
    expect(new URL(links[4].href).searchParams.get("title")).toBe(share.title);
  });

  it("omits the caption, never the map data, when a House link needs Bluesky's full character budget", () => {
    const ids = { house: Array.from({ length: 435 }, (_, i) => String(i)), president: [], senate: [], governor: [] };
    const assignments = Object.fromEntries(ids.house.map((id) => [id, "SOLID_R" as const]));
    const url = `https://www.mapelection.com/?${encodeShareHash(assignments, ids, "house").slice(1)}`;
    const bluesky = socialShareLinks({ title: "My 2026 House election map", url }).find((site) => site.label === "Bluesky")!;
    const text = new URL(bluesky.href).searchParams.get("text")!;
    expect(text.length).toBeLessThanOrEqual(300);
    expect(text).toBe(url);
  });
});
