export interface ExportTally {
  label: string;
  value: number | string;
  color?: string;
}

/**
 * Rasterize a live SVG element to a PNG download. All colors must be set as
 * presentation attributes on the elements themselves (not via external CSS)
 * so the serialized clone renders correctly.
 */
export async function exportSvgAsPng(
  svg: SVGSVGElement,
  filename: string,
  background = "#ffffff",
  title?: string,
  tallies: ExportTally[] = [],
): Promise<void> {
  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const bannerHeight = 44;
  const titleHeight = title ? 64 : 0;
  const tallyHeight = tallies.length > 0 ? 52 : 0;
  const headerHeight = bannerHeight + titleHeight + tallyHeight;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const source = new XMLSerializer().serializeToString(clone);
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;

  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to load SVG for export"));
    image.src = svgUrl;
  });

  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = (height + headerHeight) * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);

  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(0, 0, width, bannerHeight);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 22px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("made with mapelection.com", width / 2, bannerHeight / 2);

  if (title) {
    const maxTextWidth = width - 40;
    let fontSize = 28;
    ctx.font = `600 ${fontSize}px system-ui, -apple-system, Segoe UI, sans-serif`;
    while (ctx.measureText(title).width > maxTextWidth && fontSize > 12) {
      fontSize -= 1;
      ctx.font = `600 ${fontSize}px system-ui, -apple-system, Segoe UI, sans-serif`;
    }
    ctx.fillStyle = "#111827";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(title, width / 2, bannerHeight + titleHeight / 2);
  }

  if (tallies.length > 0) {
    const y = bannerHeight + titleHeight + tallyHeight / 2;
    const gap = 26;
    const dotGap = 10;
    const font = "600 17px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.font = font;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const parts = tallies.map((t) => ({
      ...t,
      text: `${t.label} ${t.value}`,
      width: ctx.measureText(`${t.label} ${t.value}`).width + dotGap + 2 * 6,
    }));
    const totalWidth =
      parts.reduce((sum, p) => sum + p.width, 0) + gap * (parts.length - 1);

    let x = width / 2 - totalWidth / 2;
    for (const p of parts) {
      ctx.fillStyle = p.color ?? "#111827";
      ctx.beginPath();
      ctx.arc(x + 6, y, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#111827";
      ctx.fillText(p.text, x + 6 + dotGap, y);

      x += p.width + gap;
    }
  }

  ctx.drawImage(image, 0, headerHeight, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Failed to encode PNG");

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
