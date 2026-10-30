import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from "react";
import type {
  MouseEvent,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  Ref,
} from "react";
import {
  ASSIGNMENT_LABEL,
  BORDER_COLOR,
  pickupStripe,
  pickupStripeFor,
  regionColor,
} from "../data/parties";
import type { StripeSpec } from "../data/parties";
import { describeSummary } from "../lib/polling";
import type { PollOverlay } from "../lib/polling";
import { MAP_HEIGHT, MAP_WIDTH, projectFeatures } from "../lib/projection";
import type { Assignment, RegionFeature } from "../types";
import { PollDetails } from "./PollDetails";
import { CandidateCards } from "./CandidateCards";
import type { Candidate } from "../data/candidates";

/** Diagonally striped pattern geometry, in user-space units. */
const STRIPE_SIZE = 8;
/** The narrower, lighter partner band. */
const STRIPE_PARTNER = 2;
/** The wider confidence band (a 3:1 ratio with the partner band). */
const STRIPE_CONFIDENCE = STRIPE_SIZE - STRIPE_PARTNER;

/**
 * Pattern id for a poll-projected pickup. It has to fold in the poll shade
 * (the fill that becomes the confidence band) so pickups that share parties
 * but not a shade don't dedupe onto one `<pattern>`.
 */
function pollStripeId(
  target: string,
  incumbent: string | null,
  fill: string,
): string {
  return `pickup-poll-${target}${incumbent}-${fill.replace(/[^0-9a-z]/gi, "")}`;
}

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
   * reds for an R pickup) instead of a solid color. In polling view the
   * unpainted projection is the poll leader (with the poll shade as the wider
   * band); painted states project from their paint.
   */
  stripePickups?: boolean;
  /** Incumbent/holding party ("D" | "R" | "I") for a region id, if any. */
  getIncumbent?: (id: string) => string | null;
  /**
   * When set, states are filled from polling (by margin) instead of their
   * assignment, and the tooltip shows the poll aggregate. Painting still edits
   * the underlying map, so callers usually exit the overlay on a click.
   */
  poll?: PollOverlay | null;
  /** General-election candidates, keyed by the same region id as the map. */
  candidates?: Record<string, Candidate[]>;
}

interface HoverState {
  id: string;
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
/** Keep a polling popup steady while the pointer crosses neighboring states. */
const POLL_HOVER_DELAY_MS = 350;

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
  poll,
  candidates,
}: RegionMapProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerSvgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const tooltipAnchor = useRef({ x: 0, y: 0 });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHover = useRef<{
    id: string;
    x: number;
    y: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const hoverPolls = useMemo(
    () => hover ? poll?.pollsFor?.(hover.id) ?? [] : [],
    [hover?.id, poll],
  );
  const hoverCandidates = hover ? candidates?.[hover.id] ?? [] : [];
  const interactiveTooltip = hoverPolls.length > 0 || hoverCandidates.length > 0;

  const cancelHideTooltip = useCallback(() => {
    if (hideTimer.current !== null) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  }, []);

  const cancelHoverUpdate = useCallback(() => {
    if (pendingHover.current) clearTimeout(pendingHover.current.timer);
    pendingHover.current = null;
  }, []);

  const keepTooltip = useCallback(() => {
    cancelHideTooltip();
    cancelHoverUpdate();
  }, [cancelHideTooltip, cancelHoverUpdate]);

  const hideTooltip = useCallback(() => {
    keepTooltip();
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && tooltipRef.current?.contains(focused)) {
      focused.blur();
    }
    setHover(null);
  }, [keepTooltip]);

  const scheduleHideTooltip = () => {
    cancelHideTooltip();
    cancelHoverUpdate();
    if (!interactiveTooltip) {
      hideTooltip();
    } else if (!tooltipRef.current?.contains(document.activeElement)) {
      // The same grace period covers blank space on the way to the popup.
      hideTimer.current = setTimeout(hideTooltip, 1000);
    }
  };

  useEffect(() => keepTooltip, [keepTooltip]);
  useEffect(() => {
    cancelHoverUpdate();
  }, [poll?.optionLabel, cancelHoverUpdate]);

  const positionPollTooltip = useCallback(() => {
    const tip = tooltipRef.current;
    if (!tip || !interactiveTooltip) return;
    const rect = tip.getBoundingClientRect();
    const padding = 12;
    const left = Math.min(tooltipAnchor.current.x + padding, window.innerWidth - rect.width - padding);
    const top = Math.min(tooltipAnchor.current.y + padding, window.innerHeight - rect.height - padding);
    tip.style.left = `${Math.max(padding, left)}px`;
    tip.style.top = `${Math.max(padding, top)}px`;
  }, [interactiveTooltip]);

  useLayoutEffect(() => {
    if (interactiveTooltip) {
      positionPollTooltip();
    } else if (hover) {
      const rect = wrapRef.current?.getBoundingClientRect();
      const tip = tooltipRef.current;
      if (rect && tip) {
        tip.style.left = `${tooltipAnchor.current.x - rect.left}px`;
        tip.style.top = `${tooltipAnchor.current.y - rect.top}px`;
      }
    }
  }, [positionPollTooltip, hover?.id, poll?.optionLabel, hoverCandidates.length]);

  useEffect(() => {
    if (!interactiveTooltip) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hideTooltip();
    };
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && tooltipRef.current?.contains(event.target)) {
        return;
      }
      hideTooltip();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !tooltipRef.current?.contains(event.target)) {
        hideTooltip();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", positionPollTooltip);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", positionPollTooltip);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [interactiveTooltip, hideTooltip, positionPollTooltip]);
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

  // The stripe pattern to draw for a region, if it is a party flip. The
  // projected party is the poll leader while a poll overlay is up (unless the
  // state was painted over), otherwise the region's assignment. The confidence
  // band is whatever color the region would show without the stripe, so a
  // poll-projected pickup keeps its poll shade and adds the dark pickup band.
  const stripeFor = useCallback(
    (id: string, assignment: Assignment): StripeSpec | null => {
      if (!stripePickups || !getIncumbent) return null;
      if (poll && !poll.isPainted(id)) {
        // Unpainted states project from the poll leader.
        const summary = poll.summaryFor(id);
        const fill = poll.fills[id];
        const incumbent = getIncumbent(id);
        if (!summary || !fill || summary.margin === 0) return null;
        return pickupStripeFor(
          summary.leader,
          fill,
          incumbent,
          pollStripeId(summary.leader, incumbent, fill),
        );
      }
      // Painted states (in or out of the poll view) project from their paint.
      return pickupStripe(assignment, getIncumbent(id));
    },
    [stripePickups, getIncumbent, poll],
  );

  // The stripe defs (deduped by id) and the region paths, built together so
  // each region's flip is computed once.
  const { regions, stripeDefs } = useMemo(() => {
    const byId = new Map<string, StripeSpec>();
    const elements = shapes.map((shape) => {
      const active = isActive(shape.id);
      const assignment = assignments[shape.id] ?? null;
      // In polling view a manually painted state shows its own paint color
      // and label; everything else keeps its poll margin shade.
      const painted = poll ? poll.isPainted(shape.id) : false;
      const stripe = stripeFor(shape.id, assignment);
      if (stripe && !byId.has(stripe.id)) byId.set(stripe.id, stripe);
      return (
        <path
          key={shape.id}
          data-id={shape.id}
          data-active={active ? "1" : "0"}
          data-label={shape.label}
          d={shape.d}
          fill={
            poll && !painted
              ? stripe
                ? `url(#${stripe.id})`
                : poll.fills[shape.id] ?? regionColor(null, active)
              : stripe
                ? `url(#${stripe.id})`
                : regionColor(assignment, active)
          }
          stroke={BORDER_COLOR}
          strokeWidth={0.6}
          className={active ? "region region--active" : "region"}
          vectorEffect="non-scaling-stroke"
        />
      );
    });
    return { regions: elements, stripeDefs: byId };
  }, [shapes, assignments, isActive, poll, stripeFor]);

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
    hideTooltip();
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

  // Build the tooltip text for a region at render time so it stays in step
  // with the current overlay and paint state.
  const describeRegion = (
    id: string,
  ): { label: string; breakdown: string | null } => {
    const base = shapes.find((shape) => shape.id === id)?.label ?? "";
    const assignment = assignments[id];
    let label = base;
    if (poll) {
      // A painted state shows its own paint; everything else shows the
      // poll aggregate it is colored by.
      if (poll.isPainted(id)) {
        label += assignment ? ` · ${ASSIGNMENT_LABEL[assignment]}` : "";
      } else if (poll.describe) {
        const detail = poll.describe(id);
        label += detail ? ` · ${detail}` : " · no market";
      } else {
        const summary = poll.summaryFor(id);
        if (summary) {
          label += ` · ${describeSummary(summary, poll.optionLabel)}`;
        } else {
          const fallback = poll.defaultFor?.(id);
          label += fallback ? ` · ${fallback.label}` : " · no polls";
        }
      }
    } else if (assignment) {
      label += ` · ${ASSIGNMENT_LABEL[assignment]}`;
    }
    const stripe = stripeFor(id, assignment ?? null);
    if (stripe) label += ` · ${stripe.pickup} pickup`;
    return { label, breakdown: poll?.breakdown?.(id) ?? null };
  };
  const hoverInfo = hover ? describeRegion(hover.id) : null;

  const handlePointerMove = (event: MouseEvent<SVGSVGElement>) => {
    if (dragRef.current && movedPxRef.current > CLICK_TOLERANCE_PX) {
      hideTooltip();
      return;
    }
    const el = targetFromEvent(event);
    if (!el) {
      if (hover) scheduleHideTooltip();
      return;
    }
    cancelHideTooltip();
    const id = el.dataset.id ?? "";
    if (interactiveTooltip && id !== hover?.id) {
      if (pendingHover.current?.id === id) {
        // Movement within the next state updates its anchor without
        // restarting the short hover delay.
        pendingHover.current.x = event.clientX;
        pendingHover.current.y = event.clientY;
      } else {
        cancelHoverUpdate();
        pendingHover.current = {
          id,
          x: event.clientX,
          y: event.clientY,
          timer: setTimeout(() => {
            const next = pendingHover.current;
            if (!next) return;
            pendingHover.current = null;
            tooltipAnchor.current = { x: next.x, y: next.y };
            setHover({ id: next.id });
          }, POLL_HOVER_DELAY_MS),
        };
      }
      return;
    }
    cancelHoverUpdate();
    // Move the tooltip via the DOM so mousemove doesn't re-render the map;
    // React state only changes when the hovered region changes.
    const rect = wrapRef.current?.getBoundingClientRect();
    const tip = tooltipRef.current;
    const nextInteractive = el.dataset.id === hover?.id
      ? interactiveTooltip
      : (poll?.pollsFor?.(el.dataset.id ?? "").length ?? 0) > 0 || (candidates?.[el.dataset.id ?? ""]?.length ?? 0) > 0;
    // Poll popups stay anchored while moving within a state so their
    // disclosure control can be reached without chasing the pointer.
    if (rect && tip && !nextInteractive) {
      tip.style.left = `${event.clientX - rect.left}px`;
      tip.style.top = `${event.clientY - rect.top}px`;
    }
    if (el.dataset.id !== hover?.id) {
      tooltipAnchor.current = { x: event.clientX, y: event.clientY };
      setHover({ id: el.dataset.id ?? "" });
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
        onPointerLeave={scheduleHideTooltip}
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
                width={STRIPE_PARTNER}
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
        className={`tooltip${interactiveTooltip ? " tooltip--interactive" : ""}${hoverCandidates.length ? " tooltip--candidates" : ""}`}
        role={interactiveTooltip ? "dialog" : undefined}
        aria-label={interactiveTooltip ? `${shapes.find((shape) => shape.id === hover?.id)?.label} ${hoverPolls.length ? "polling" : "candidate"} details` : undefined}
        onPointerEnter={keepTooltip}
        onPointerLeave={scheduleHideTooltip}
        onFocus={keepTooltip}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) scheduleHideTooltip();
        }}
        style={{
          transform: interactiveTooltip ? "none" : "translate(-50%, -125%)",
          display: hover ? undefined : "none",
        }}
      >
        <div className="tooltip__heading"><span>{hoverInfo?.label}</span>{interactiveTooltip ? <button type="button" className="tooltip__close" aria-label="Close race details" onClick={hideTooltip}>×</button> : null}</div>
        {hoverInfo?.breakdown ? (
          <div className="tooltip__breakdown">{hoverInfo.breakdown}</div>
        ) : null}
        {hoverCandidates.length > 0 ? <CandidateCards key={hover?.id} candidates={hoverCandidates} summary={hover && hoverPolls.length > 0 && !poll?.isPainted(hover.id) ? poll?.summaryFor(hover.id) : null} /> : null}
        {hoverPolls.length > 0 && hover && poll ? (
          <PollDetails
            key={`${hover.id}:${poll.optionLabel}`}
            polls={hoverPolls}
            optionLabel={poll.optionLabel}
            onToggle={positionPollTooltip}
          />
        ) : null}
      </div>
    </div>
  );
}
