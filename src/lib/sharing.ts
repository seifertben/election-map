export interface MapShare {
  url: string;
  title: string;
}

/** Compose links open a draft; the user chooses when and where to publish. */
export function socialShareLinks({ url, title }: MapShare) {
  const combined = `${title}\n${url}`;
  // Bluesky counts the full text, including the URL, toward its 300 characters.
  const blueskyText = Array.from(combined).length <= 300 ? combined : url;
  const link = (base: string, params: Record<string, string>) =>
    `${base}?${new URLSearchParams(params)}`;
  return [
    { label: "X", href: link("https://x.com/intent/tweet", { text: title, url }) },
    { label: "Facebook", href: link("https://www.facebook.com/sharer/sharer.php", { u: url }) },
    { label: "Bluesky", href: link("https://bsky.app/intent/compose", { text: blueskyText }) },
    { label: "Threads", href: link("https://www.threads.com/intent/post", { text: title, url }) },
    { label: "Reddit", href: link("https://www.reddit.com/submit", { url, title }) },
    { label: "LinkedIn", href: link("https://www.linkedin.com/sharing/share-offsite/", { url }) },
    { label: "WhatsApp", href: link("https://wa.me/", { text: combined }) },
    { label: "Telegram", href: link("https://t.me/share/url", { url, text: title }) },
  ];
}
