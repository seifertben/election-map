import { useEffect, useRef, useState } from "react";
import { socialShareLinks } from "../lib/sharing";
import type { MapShare } from "../lib/sharing";

export function ShareMap({ share, prepareImage, onClose }: {
  share: MapShare;
  prepareImage: () => Promise<File>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const [imageError, setImageError] = useState(false);
  const [status, setStatus] = useState("");
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let imageUrl: string | undefined;
    setImage(null);
    setImageError(false);
    prepareImage().then((file) => {
      if (cancelled) return;
      imageUrl = URL.createObjectURL(file);
      setImage({ file, url: imageUrl });
    }).catch(() => {
      if (!cancelled) setImageError(true);
    });
    return () => {
      cancelled = true;
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [prepareImage]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(share.url);
      setStatus("Map link copied.");
    } catch {
      setStatus("Select and copy the map link below.");
    }
  };

  const nativeShare = async (withImage: boolean) => {
    setSharing(true);
    setStatus("");
    try {
      await navigator.share({
        title: share.title,
        text: share.title,
        url: share.url,
        ...(withImage && image ? { files: [image.file] } : {}),
      });
    } catch (error) {
      if (!(error && typeof error === "object" && "name" in error && error.name === "AbortError")) {
        setStatus("Sharing is unavailable. Choose a site or copy the map link instead.");
      }
    } finally {
      setSharing(false);
    }
  };

  let canShareImage = false;
  try {
    canShareImage = Boolean(image && typeof navigator.share === "function" && navigator.canShare?.({ files: [image.file] }));
  } catch { /* Some browsers reject file sharing even when link sharing works. */ }

  return (
    <dialog
      ref={dialogRef}
      className="share-map"
      aria-labelledby="share-map-title"
      aria-describedby="share-map-description"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right ||
            event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}
    >
      <div className="share-map__heading">
        <h2 id="share-map-title">Share your map</h2>
        <button type="button" className="share-map__close" aria-label="Close sharing" onClick={onClose}>×</button>
      </div>
      <p id="share-map-description">{share.title}. Choose where to share it.</p>
      <div className="share-map__sites" aria-label="Social media sites">
        {socialShareLinks(share).map(({ label, href }) => (
          <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Share on ${label}`}>
            {label}<span aria-hidden="true">↗</span>
          </a>
        ))}
      </div>
      <div className="share-map__actions">
        <button type="button" onClick={copyLink}>Copy map link</button>
        {typeof navigator.share === "function" ? (
          <button type="button" disabled={sharing} onClick={() => nativeShare(false)}>More apps…</button>
        ) : null}
      </div>
      <label className="share-map__link">
        Map link
        <input readOnly value={share.url} onFocus={(event) => event.currentTarget.select()} />
      </label>
      <section className="share-map__image" aria-label="Share the map image">
        <h3>Include the map image</h3>
        <p>Download the PNG and attach it to your post. It includes your map and seat totals.</p>
        {image ? (
          <>
            <img src={image.url} alt={`${share.title} with seat totals`} />
            <div className="share-map__actions">
              <a href={image.url} download={image.file.name}>Download PNG</a>
              {canShareImage ? (
                <button type="button" disabled={sharing} onClick={() => nativeShare(true)}>Share image to apps…</button>
              ) : null}
            </div>
          </>
        ) : <p>{imageError ? "Image unavailable. You can still share the map link." : "Preparing your map image…"}</p>}
        <p className="share-map__note">Map links preserve the selected race’s seat calls. PNGs preserve exact colors, including polling and market views.</p>
      </section>
      <p className="share-map__status" role="status">{status}</p>
    </dialog>
  );
}
