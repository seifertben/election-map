import { useEffect, useMemo, useRef, useState } from "react";
import type {
  MouseEvent,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  Ref,
} from "react";
import { ASSIGNMENT_LABEL, BORDER_COLOR, pickupStripe, regionColor } from "../data/parties";
import { MAP_HEIGHT, MAP_WIDTH, projectFeatures } from "../lib/projection";
import type { Assignment, RegionFeature } from "../types";

/** Diagonally striped pattern geometry, in user-space units. */
const STRIPE_SIZE = 6;
const STRIPE_SOLID = 2;
const STRIPE_CONFIDENCE = STRIPE_SIZE - STRIPE_SOLID;

export interface RegionMapProps {
  features: RegionFeature[];
  /** Stable region id for a feature (state FIPS or district GEOID). */
  getId: (feature: RegionFeature) => string;
  /** Human-readable tooltip label for a feature. */
  getLabel: (feature: RegionFeature) => string;
  /** Whether a region participates in this map (e.g. has a 2026 Senate race). */
  isActive: (id: string) => boolean;
  assignments: Record<string, Assignment>;
  onRegionClick: (id: string) => void;
  svgRef?: Ref<SVGSVGElement>;
  /**
   * When on, regions whose projected party differs from their incumbent party
   * are filled with a diagonal stripe pattern (two blues for a D pickup, two
   * reds for an R pickup) instead of a solid color.
   */
  stripePickups?: boolean;
  /** Incumbent/holding party ("D" | "R" | "I") for a region id, if any. */
  getIncumbent?: (id: string) => string | null;
}

interface HoverState {
  id: string;
  label: string;
}

/** Pan/zoom transform: screen = viewBox coords * k + (x, y). */
interface ViewTransform {
  k: number;
  x: number;
  y: number;
}

interface DragState {
  pointers: Map<number, { x: number; y: number }>;
  pinchDist: number;
  pinchMid: { x: number; y: number } | null;
}

const MIN_SCALE = 1;
const MAX_SCALE = 12;
const DEFAULT_VIEW: ViewTransform = { k: 1, x: 0, y: 0 };
/** Distance (px) the pointer may travel before a click counts as a drag. */
const CLICK_TOLERANCE_PX = 5;

function clampView(view: ViewTransform): ViewTransform {
  const k = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.k));
  // At scale 1 the map exactly fills the viewBox, so panning is pinned to 0.
  const minX = MAP_WIDTH - MAP_WIDTH * k;
  const minY = MAP_HEIGHT - MAP_HEIGHT * k;
  return {
    k,
    x: Math.min(0, Math.max(minX, view.x)),
    y: Math.min(0, Math.max(minY, view.y)),
  };
}

export function RegionMap({
  features,
  getId,
  getLabel,
  isActive,
  assignments,
  onRegionClick,
  svgRef,
  stripePickups = false,
  getIncumbent,
}: RegionMapProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerSvgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  // Pan/zoom is applied imperatively to the <g> element (see applyView) so
  // dragging and wheel-zoom don't re-render hundreds of paths per frame.
  const viewRef = useRef<ViewTransform>(DEFAULT_VIEW);
  const [atDefaultView, setAtDefaultView] = useState(true);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const movedPxRef = useRef(0);

  // projectFeatures caches path strings at module level, so this stays cheap
  // even though the map remounts on every mode switch. A click then only
  // rebuilds cheap elements with a new fill instead of re-projecting.
  const ds = useMemo(() => projectFeatures(features), [features]);

  const shapes = useMemo(
    () =>
      features.map((feature, i) => ({
        id: getId(feature),
        label: getLabel(feature),
        d: ds[i] ?? "",
      })),
    [features, ds, getId, getLabel],
  );

  // Which districts are party flips (projected party != holding party), and
  // the stripe pattern mixes two shades of the projected party's color.
  const stripeDefs = useMemo(() => {
    const byId = new Map<string, ReturnType<typeof pickupStripe> & object>();
    if (!stripePickups || !getIncumbent) return byId;
    for (const shape of shapes) {
      const stripe = pickupStripe(
        assignments[shape.id] ?? null,
        getIncumbent(shape.id),
      );
      if (stripe && !byId.has(stripe.id)) byId.set(stripe.id, stripe);
    }
    return byId;
  }, [shapes, assignments, stripePickups, getIncumbent]);

  const regions = useMemo(
    () =>
      shapes.map((shape) => {
        const active = isActive(shape.id);
        const assignment = assignments[shape.id] ?? null;
        const stripe =
          stripePickups && getIncumbent
            ? pickupStripe(assignment, getIncumbent(shape.id))
            : null;
        return (
          <path
            key={shape.id}
            data-id={shape.id}
            data-active={active ? "1" : "0"}
            data-label={shape.label}
            d={shape.d}
            fill={
              stripe
                ? `url(#${stripe.id})`
                : regionColor(assignment, active)
            }
            stroke={BORDER_COLOR}
            strokeWidth={0.6}
            className={active ? "region region--active" : "region"}
            vectorEffect="non-scaling-stroke"
          />
        );
      }),
    [shapes, assignments, isActive, stripePickups, getIncumbent],
  );

  const setSvgRefs = (el: SVGSVGElement | null) => {
    innerSvgRef.current = el;
    if (typeof svgRef === "function") svgRef(el);
    else if (svgRef)
      (svgRef as MutableRefObject<SVGSVGElement | null>).current = el;
  };

  /** Rendered pixel size of one viewBox unit (accounts for letterboxing). */
  const unitScale = () => {
    const rect = innerSvgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return 1;
    return Math.min(rect.width / MAP_WIDTH, rect.height / MAP_HEIGHT);
  };

  /** Convert client (viewport) coordinates to viewBox map coordinates. */
  const toMapCoords = (clientX: number, clientY: number) => {
    const rect = innerSvgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    const scale = Math.min(rect.width / MAP_WIDTH, rect.height / MAP_HEIGHT);
    const offsetX = (rect.width - MAP_WIDTH * scale) / 2;
    const offsetY = (rect.height - MAP_HEIGHT * scale) / 2;
    return {
      x: (clientX - rect.left - offsetX) / scale,
      y: (clientY - rect.top - offsetY) / scale,
    };
  };

  /** Apply a view transform directly to the <g>, bypassing React renders. */
  const applyView = (next: ViewTransform) => {
    viewRef.current = next;
    gRef.current?.setAttribute(
      "transform",
      `translate(${next.x} ${next.y}) scale(${next.k})`,
    );
    setAtDefaultView(
      next.k === DEFAULT_VIEW.k &&
        next.x === DEFAULT_VIEW.x &&
        next.y === DEFAULT_VIEW.y,
    );
  };

  /** Zoom by `factor`, keeping the viewBox point (cx, cy) fixed on screen. */
  const zoomAt = (cx: number, cy: number, factor: number) => {
    const v = viewRef.current;
    const k = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.k * factor));
    const ratio = k / v.k;
    applyView(
      clampView({
        k,
        x: cx - (cx - v.x) * ratio,
        y: cy - (cy - v.y) * ratio,
      }),
    );
  };

  const panBy = (dxUnits: number, dyUnits: number) => {
    const v = viewRef.current;
    applyView(clampView({ ...v, x: v.x + dxUnits, y: v.y + dyUnits }));
  };

  // Wheel zoom. Attached natively because React registers wheel listeners as
  // passive, which would prevent cancelling the page scroll.
  useEffect(() => {
    const svg = innerSvgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = toMapCoords(event.clientX, event.clientY);
      const factor = Math.exp(-event.deltaY * 0.0018);
      zoomAt(point.x, point.y, factor);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  // While a drag is active, listen on window so panning continues even when
  // the pointer leaves the svg.
  useEffect(() => {
    if (!dragging) return;

    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !drag.pointers.has(event.pointerId)) return;
      const prev = drag.pointers.get(event.pointerId) ?? {
        x: event.clientX,
        y: event.clientY,
      };
      drag.pointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      movedPxRef.current += Math.hypot(
        event.clientX - prev.x,
        event.clientY - prev.y,
      );

      if (drag.pointers.size === 1) {
        const scale = unitScale();
        panBy(
          (event.clientX - prev.x) / scale,
          (event.clientY - prev.y) / scale,
        );
      } else if (drag.pointers.size === 2) {
        const [a, b] = [...drag.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (drag.pinchDist > 0) {
          const point = toMapCoords(mid.x, mid.y);
          zoomAt(point.x, point.y, dist / drag.pinchDist);
        }
        if (drag.pinchMid) {
          const scale = unitScale();
          panBy(
            (mid.x - drag.pinchMid.x) / scale,
            (mid.y - drag.pinchMid.y) / scale,
          );
        }
        drag.pinchDist = dist;
        drag.pinchMid = mid;
      }
    };

    const onUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      drag.pointers.delete(event.pointerId);
      if (drag.pointers.size < 2) {
        drag.pinchDist = 0;
        drag.pinchMid = null;
      }
      if (drag.pointers.size === 0) {
        dragRef.current = null;
        setDragging(false);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging]);

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    movedPxRef.current = 0;
    if (!dragRef.current) {
      dragRef.current = { pointers: new Map(), pinchDist: 0, pinchMid: null };
      setDragging(true);
    }
    dragRef.current.pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (dragRef.current.pointers.size === 2) {
      const [a, b] = [...dragRef.current.pointers.values()];
      dragRef.current.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      dragRef.current.pinchMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  };

  const targetFromEvent = (event: MouseEvent) => {
    const el = event.target as SVGElement;
    if (!el || !("dataset" in el) || !el.dataset.id) return null;
    if (el.dataset.active !== "1") return null;
    return el;
  };

  const handlePointerMove = (event: MouseEvent<SVGSVGElement>) => {
    const el = targetFromEvent(event);
    if (!el) {
      if (hover) setHover(null);
      return;
    }
    // Move the tooltip via the DOM so mousemove doesn't re-render the map;
    // React state only changes when the hovered region changes.
    const rect = wrapRef.current?.getBoundingClientRect();
    const tip = tooltipRef.current;
    if (rect && tip) {
      tip.style.left = `${event.clientX - rect.left}px`;
      tip.style.top = `${event.clientY - rect.top}px`;
    }
    if (el.dataset.id !== hover?.id) {
      const id = el.dataset.id ?? "";
      const assignment = assignments[id];
      const base = el.dataset.label ?? "";
      let label = base;
      if (assignment) {
        label += ` · ${ASSIGNMENT_LABEL[assignment]}`;
        const stripe =
          stripePickups && getIncumbent
            ? pickupStripe(assignment, getIncumbent(id))
            : null;
        if (stripe) label += ` · ${stripe.pickup} pickup`;
      }
      setHover({ id, label });
    }
  };

  const handleClick = (event: MouseEvent<SVGSVGElement>) => {
    if (movedPxRef.current > CLICK_TOLERANCE_PX) {
      movedPxRef.current = 0;
      return;
    }
    const el = targetFromEvent(event);
    if (el?.dataset.id) onRegionClick(el.dataset.id);
  };

  const handleDoubleClick = (event: MouseEvent<SVGSVGElement>) => {
    const point = toMapCoords(event.clientX, event.clientY);
    zoomAt(point.x, point.y, event.shiftKey ? 1 / 1.6 : 1.6);
  };

  const zoomAtCenter = (factor: number) =>
    zoomAt(MAP_WIDTH / 2, MAP_HEIGHT / 2, factor);

  return (
    <div className="map-wrap" ref={wrapRef}>
      <svg
        ref={setSvgRefs}
        className={dragging ? "map-svg map-svg--panning" : "map-svg"}
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="United States election map"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHover(null)}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <defs>
          {[...stripeDefs.values()].map((stripe) => (
            <pattern
              key={stripe.id}
              id={stripe.id}
              width={STRIPE_SIZE}
              height={STRIPE_SIZE}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect
                width={STRIPE_CONFIDENCE}
                height={STRIPE_SIZE}
                fill={stripe.colorA}
              />
              <rect
                x={STRIPE_CONFIDENCE}
                width={STRIPE_SOLID}
                height={STRIPE_SIZE}
                fill={stripe.colorB}
              />
            </pattern>
          ))}
        </defs>
        {/* transform is managed imperatively via applyView; keep this
            constant so React never overwrites the DOM attribute. */}
        <g ref={gRef} transform="translate(0 0) scale(1)">
          {regions}
        </g>
      </svg>
      <div className="map-controls">
        <button
          type="button"
          aria-label="Zoom in"
          title="Zoom in"
          onClick={() => zoomAtCenter(1.6)}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          title="Zoom out"
          onClick={() => zoomAtCenter(1 / 1.6)}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Reset map view"
          title="Reset view"
          onClick={() => applyView(DEFAULT_VIEW)}
          disabled={atDefaultView}
        >
          Reset
        </button>
      </div>
      {/* Always mounted so the ref is stable; hidden when nothing is
          hovered. Position is set imperatively in handlePointerMove. */}
      <div
        ref={tooltipRef}
        className="tooltip"
        style={{
          transform: `translate(-50%, -125%)`,
          display: hover ? undefined : "none",
        }}
      >
        {hover?.label}
      </div>
    </div>
  );
}
