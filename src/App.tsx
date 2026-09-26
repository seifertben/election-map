import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { Logo } from "./components/Logo";
import { MarketPanel } from "./components/MarketPanel";
import type { MarketStatus } from "./components/MarketPanel";
import { ModeTabs } from "./components/ModeTabs";
import { PartyPalette } from "./components/PartyPalette";
import type { Brush } from "./components/PartyPalette";
import { PickupPanel } from "./components/PickupPanel";
import { PollingPanel } from "./components/PollingPanel";
import { RatingsPanel } from "./components/RatingsPanel";
import { RegionMap } from "./components/RegionMap";
import { Scoreboard } from "./components/Scoreboard";
import { StateAnalyzer } from "./components/StateAnalyzer";
import {
  GOVERNOR_2026_FIPS,
  GOVERNOR_2026_RATINGS,
  GOVERNOR_RACE_BY_FIPS,
} from "./data/governor2026";
import { HOUSE_2026_FIPS, HOUSE_2026_RATINGS } from "./data/house2026";
import { HOUSE_2026_HOLDER } from "./data/house2026Holder";
import { PRESIDENT_2024_RESULTS } from "./data/president2024";
import {
  SENATE_2026_FIPS,
  SENATE_2026_RATINGS,
  SENATE_RACE_BY_FIPS,
} from "./data/senate2026";
import { STATE_BY_FIPS } from "./data/states";
import {
  DEFAULT_RATINGS_SOURCE,
  RATINGS_SOURCE_BY_ID,
} from "./data/ratingsSources";
import type { DemographicsData } from "./lib/analyzer";
import { exportSvgAsPng } from "./lib/exportPng";
import {
  MARKET_NONE_ID,
  MARKET_REFRESH_MS,
  MARKET_SOURCES_BY_MODE,
  marketOverlayFor,
} from "./lib/markets";
import type { MarketMode, MarketSnapshot } from "./lib/markets";
import {
  POLL_DATASETS,
  POLL_NONE_OPTION_ID,
  pollMarginColor,
  projectedAssignments,
  summarizePolls,
} from "./lib/polling";
import type { PollOverlay, PollSummary } from "./lib/polling";
import { projectFeatures } from "./lib/projection";
import {
  chamberSeats,
  governorScore,
  houseScore,
  presidentScore,
  senateScore,
} from "./lib/scoreboard";
import { decodeHash, encodeHash } from "./state/encoding";
import type { RegionIds } from "./state/encoding";
import { createInitialState, reducer } from "./state/reducer";
import type { Assignment, Mode, RegionFeature } from "./types";

/** Modes that have committed polling data (Senate and Governor). */
type RaceMode = "senate" | "governor";
type RatingMode = "senate" | "house" | "governor";

interface RaceConfig {
  /** Label used in panel copy and the mode tab. */
  label: string;
  /** The region ids (state FIPS) contested in this race. */
  fips: string[];
  /** Fast membership test for {@link fips}. */
  active: Set<string>;
  /** Incumbent party per region id, for pickup stripes. */
  incumbentByFips: Record<string, { incumbentParty: string }>;
  /** The default (Cook) ratings map. */
  defaultRatings: Record<string, Assignment>;
}

const RACE_CONFIG: Record<RaceMode, RaceConfig> = {
  senate: {
    label: "Senate",
    fips: SENATE_2026_FIPS,
    active: new Set(SENATE_2026_FIPS),
    incumbentByFips: SENATE_RACE_BY_FIPS,
    defaultRatings: SENATE_2026_RATINGS,
  },
  governor: {
    label: "Governor",
    fips: GOVERNOR_2026_FIPS,
    active: new Set(GOVERNOR_2026_FIPS),
    incumbentByFips: GOVERNOR_RACE_BY_FIPS,
    defaultRatings: GOVERNOR_2026_RATINGS,
  },
};

function isRaceMode(mode: Mode): mode is RaceMode {
  return mode === "senate" || mode === "governor";
}

function isMarketMode(mode: Mode): mode is MarketMode {
  return mode === "senate" || mode === "governor" || mode === "house";
}

/** The label and region count shown in the market panel per mode. */
const MARKET_RACE: Record<MarketMode, { label: string; count: number }> = {
  senate: { label: "Senate", count: SENATE_2026_FIPS.length },
  governor: { label: "Governor", count: GOVERNOR_2026_FIPS.length },
  house: { label: "House", count: HOUSE_2026_FIPS.length },
};

/** The default (Cook) ratings for a mode, used as the market overlay baseline. */
function defaultRatingsFor(mode: RatingMode): Record<string, Assignment> {
  if (mode === "senate") return SENATE_2026_RATINGS;
  if (mode === "governor") return GOVERNOR_2026_RATINGS;
  return HOUSE_2026_RATINGS;
}

const MODE_LABEL: Record<Mode, string> = {
  president: "President",
  senate: "Senate",
  governor: "Governor",
  house: "House",
};

function featureId(feature: RegionFeature, key: "fips" | "geoid"): string {
  const value = feature.properties[key];
  return String(value ?? feature.id ?? "");
}

function emptyPollState<T>(value: T): Record<RaceMode, T> {
  return { senate: value, governor: value };
}

function emptyMarketState<T>(value: T): Record<MarketMode, T> {
  return { senate: value, governor: value, house: value };
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    createInitialState(),
  );
  const [states, setStates] = useState<RegionFeature[] | null>(null);
  const [districts, setDistricts] = useState<RegionFeature[] | null>(null);
  const [demographics, setDemographics] = useState<DemographicsData | null>(null);
  const [analyzerOpen, setAnalyzerOpen] = useState(false);
  const [brush, setBrush] = useState<Brush>("CYCLE");
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sourceByMode, setSourceByMode] = useState<Record<RatingMode, string>>({
    senate: DEFAULT_RATINGS_SOURCE,
    governor: DEFAULT_RATINGS_SOURCE,
    house: DEFAULT_RATINGS_SOURCE,
  });
  const [stripePickups, setStripePickups] = useState(true);
  const [pollOptionByMode, setPollOptionByMode] = useState<
    Record<RaceMode, string>
  >({
    senate: POLL_NONE_OPTION_ID,
    governor: POLL_NONE_OPTION_ID,
  });
  const [marketSourceByMode, setMarketSourceByMode] = useState<
    Record<MarketMode, string>
  >({
    senate: MARKET_NONE_ID,
    governor: MARKET_NONE_ID,
    house: MARKET_NONE_ID,
  });
  const [marketByMode, setMarketByMode] = useState<
    Record<MarketMode, MarketSnapshot | null>
  >(emptyMarketState<MarketSnapshot | null>(null));
  const [marketStatusByMode, setMarketStatusByMode] = useState<
    Record<MarketMode, MarketStatus>
  >(emptyMarketState<MarketStatus>("idle"));
  const [marketErrorByMode, setMarketErrorByMode] = useState<
    Record<MarketMode, string | null>
  >(emptyMarketState<string | null>(null));
  const [marketRefresh, setMarketRefresh] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  // The clean ratings map each race's poll view is shown over, used to detect
  // paints and to re-apply the poll.
  const pollBaselineRef = useRef<
    Record<RaceMode, Record<string, Assignment> | null>
  >(emptyPollState<Record<string, Assignment> | null>(null));
  // Same idea for the market overlay.
  const marketBaselineRef = useRef<
    Record<MarketMode, Record<string, Assignment> | null>
  >(emptyMarketState<Record<string, Assignment> | null>(null));

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}data/states.json`).then((r) => r.json()),
      fetch(`${base}data/cd120.json`).then((r) => r.json()),
      fetch(`${base}data/demographics.json`)
        .then((r) => r.json() as Promise<DemographicsData>)
        .catch(() => null),
    ])
      .then(([statesJson, districtsJson, demographicsJson]) => {
        const stateFeatures = statesJson.features as RegionFeature[];
        const districtFeatures = districtsJson.features as RegionFeature[];
        setStates(stateFeatures);
        setDistricts(districtFeatures);
        setDemographics(demographicsJson);
        // Pre-project both maps' geometry during idle time so the first
        // mode switch is fast too (results are cached at module level).
        const warm = () => {
          projectFeatures(stateFeatures);
          projectFeatures(districtFeatures);
        };
        if (typeof window.requestIdleCallback === "function") {
          window.requestIdleCallback(warm);
        } else {
          window.setTimeout(warm, 300);
        }
      })
      .catch((error) => {
        console.error("Failed to load map data", error);
      });
  }, []);

  const regionIds = useMemo<RegionIds | null>(() => {
    if (!states || !districts) return null;
    return {
      president: states.map((f) => featureId(f, "fips")),
      senate: SENATE_2026_FIPS,
      governor: GOVERNOR_2026_FIPS,
      house: districts.map((f) => featureId(f, "geoid")),
    };
  }, [states, districts]);

  // Load a shared map from the URL hash once the data is ready.
  useEffect(() => {
    if (!regionIds || hydrated) return;
    const decoded = decodeHash(window.location.hash, regionIds);
    // Default the President map to the 2024 results (there is no presidential
    // election in 2026) and the race maps to the Cook 2026 ratings whenever no
    // assignments for them were decoded from the URL.
    const president = Object.keys(decoded.assignments.president).length
      ? decoded.assignments.president
      : PRESIDENT_2024_RESULTS;
    const senate = Object.keys(decoded.assignments.senate).length
      ? decoded.assignments.senate
      : SENATE_2026_RATINGS;
    const governor = Object.keys(decoded.assignments.governor).length
      ? decoded.assignments.governor
      : GOVERNOR_2026_RATINGS;
    const house = Object.keys(decoded.assignments.house).length
      ? decoded.assignments.house
      : HOUSE_2026_RATINGS;
    dispatch({
      type: "hydrate",
      mode: decoded.mode ?? undefined,
      assignments: { ...decoded.assignments, president, senate, governor, house },
    });
    setHydrated(true);
  }, [regionIds, hydrated]);

  // Keep the URL in sync with the current map.
  useEffect(() => {
    if (!regionIds || !hydrated) return;
    const assigned =
      Object.keys(state.assignments.president).length +
      Object.keys(state.assignments.senate).length +
      Object.keys(state.assignments.governor).length +
      Object.keys(state.assignments.house).length;
    if (assigned === 0) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
      return;
    }
    const hash = encodeHash(state.assignments, regionIds, state.mode);
    window.history.replaceState(null, "", hash);
  }, [state.assignments, state.mode, regionIds, hydrated]);

  const raceMode: RaceMode | null = isRaceMode(state.mode)
    ? state.mode
    : null;
  const marketMode: MarketMode | null = isMarketMode(state.mode)
    ? state.mode
    : null;
  const activePollId = raceMode
    ? pollOptionByMode[raceMode]
    : POLL_NONE_OPTION_ID;
  const activeMarketId = marketMode
    ? marketSourceByMode[marketMode]
    : MARKET_NONE_ID;
  const activeMarket = marketMode ? marketByMode[marketMode] : null;
  const activeMarketStatus: MarketStatus = marketMode
    ? marketStatusByMode[marketMode]
    : "idle";
  const activeMarketError = marketMode ? marketErrorByMode[marketMode] : null;

  const isActive = useCallback(
    (id: string) => {
      if (state.mode === "senate") return RACE_CONFIG.senate.active.has(id);
      if (state.mode === "governor") return RACE_CONFIG.governor.active.has(id);
      return true;
    },
    [state.mode],
  );

  const getId = useCallback(
    (feature: RegionFeature) =>
      featureId(feature, state.mode === "house" ? "geoid" : "fips"),
    [state.mode],
  );

  // Who currently holds a region, when this mode has incumbents. Used to
  // stripe party flips (projected party != holding party).
  const getIncumbent = useCallback(
    (id: string) => {
      if (state.mode === "senate" || state.mode === "governor") {
        return (
          RACE_CONFIG[state.mode].incumbentByFips[id]?.incumbentParty ?? null
        );
      }
      if (state.mode === "house") {
        return HOUSE_2026_HOLDER[id] ?? null;
      }
      return null;
    },
    [state.mode],
  );

  const getLabel = useCallback(
    (feature: RegionFeature) => {
      if (state.mode === "house") {
        const abbr =
          STATE_BY_FIPS[String(feature.properties.state)]?.abbr ?? "??";
        const code = String(feature.properties.district);
        const isAtLarge = code === "00" || code === "98";
        return isAtLarge
          ? `${abbr} (at-large)`
          : `${abbr}-${Number.parseInt(code, 10)}`;
      }
      const fips = String(feature.properties.fips);
      const info = STATE_BY_FIPS[fips];
      const name = info?.name ?? String(feature.properties.name);
      if (state.mode === "president") {
        return `${name} · ${info?.electoralVotes ?? 0} electoral votes`;
      }
      if (state.mode === "governor") {
        return GOVERNOR_RACE_BY_FIPS[fips]
          ? `${name} · Governor`
          : `${name} · no 2026 election`;
      }
      const race = SENATE_RACE_BY_FIPS[fips];
      return race
        ? `${name} · ${race.seatClass === "3s" ? "special election" : "Class 2"}`
        : `${name} · no 2026 election`;
    },
    [state.mode],
  );

  // Polling overlay colors a race map by polling margin without touching the
  // underlying assignments.
  const pollOption =
    raceMode &&
    pollOptionByMode[raceMode] !== POLL_NONE_OPTION_ID &&
    marketSourceByMode[raceMode] === MARKET_NONE_ID
      ? POLL_DATASETS[raceMode].optionById[pollOptionByMode[raceMode]] ?? null
      : null;

  // Poll fills and summaries depend only on the selected option, not on the
  // current paints, so they are computed once per option and reused by the
  // (per-paint) overlay below — otherwise every click re-sorts every state's
  // polls.
  const pollData = useMemo(() => {
    if (!raceMode || !pollOption) return null;
    const config = RACE_CONFIG[raceMode];
    const polls = POLL_DATASETS[raceMode].polls;
    const summaries = new Map<string, PollSummary>();
    const fills: Record<string, string> = {};
    for (const fips of config.fips) {
      const summary = summarizePolls(polls[fips] ?? [], pollOption);
      if (summary) {
        summaries.set(fips, summary);
        fills[fips] = pollMarginColor(summary);
      }
    }
    return { fills, summaries, optionLabel: pollOption.label };
  }, [raceMode, pollOption]);

  const pollOverlay = useMemo<PollOverlay | null>(() => {
    if (!raceMode || !pollData) return null;
    const config = RACE_CONFIG[raceMode];
    // A region is "painted" when it no longer matches the ratings that loaded
    // it; those keep their paint color and label instead of the poll shade.
    const source =
      RATINGS_SOURCE_BY_ID[sourceByMode[raceMode]]?.[raceMode] ??
      config.defaultRatings;
    const isPainted = (id: string) =>
      (state.assignments[raceMode][id] ?? null) !== (source[id] ?? null);
    return {
      fills: pollData.fills,
      summaryFor: (id) => pollData.summaries.get(id) ?? null,
      optionLabel: pollData.optionLabel,
      isPainted,
    };
  }, [raceMode, pollData, sourceByMode, state.assignments]);

  // Live betting-market overlay, colored by implied win probability. Like the
  // poll overlay it covers the race map without touching assignments, and
  // manually painted states keep their own color.
  const marketOverlay = useMemo<PollOverlay | null>(() => {
    if (
      !marketMode ||
      marketSourceByMode[marketMode] === MARKET_NONE_ID ||
      !activeMarket
    ) {
      return null;
    }
    const source =
      RATINGS_SOURCE_BY_ID[sourceByMode[marketMode]]?.[marketMode] ??
      defaultRatingsFor(marketMode);
    const isPainted = (id: string) =>
      (state.assignments[marketMode][id] ?? null) !== (source[id] ?? null);
    const label =
      MARKET_SOURCES_BY_MODE[marketMode].find(
        (s) => s.id === marketSourceByMode[marketMode],
      )?.label ?? "Market";
    return marketOverlayFor(activeMarket.quotes, label, isPainted);
  }, [
    activeMarket,
    marketMode,
    marketSourceByMode,
    sourceByMode,
    state.assignments,
  ]);

  // While a poll or market overlay is up, the scoreboard and seat dots follow
  // the colors on the map: unpainted regions count for the overlay's projected
  // leader (or as uncalled when it has no call), painted regions keep their own
  // assignment.
  const projected = useMemo<Record<string, Assignment>>(() => {
    const base = state.assignments[state.mode];
    const overlay = marketOverlay ?? pollOverlay;
    return overlay ? projectedAssignments(base, overlay) : base;
  }, [state.assignments, state.mode, marketOverlay, pollOverlay]);

  // Setting either dropdown selector starts the active race map fresh from the
  // ratings source it is shown over, so selecting or switching a poll wipes any
  // custom paints. The clean source map doubles as the baseline the poll view
  // detects paints against and re-applies.
  useEffect(() => {
    if (!raceMode || activePollId === POLL_NONE_OPTION_ID) return;
    const config = RACE_CONFIG[raceMode];
    const source =
      RATINGS_SOURCE_BY_ID[sourceByMode[raceMode]]?.[raceMode] ??
      config.defaultRatings;
    pollBaselineRef.current[raceMode] = source;
    dispatch({ type: "loadRatings", mode: raceMode, assignments: source });
  }, [activePollId, raceMode]);

  // Entering the market view (or switching market) also starts the race map
  // fresh from its ratings source; the clean map is the baseline paints are
  // detected against and restored by re-apply.
  useEffect(() => {
    if (!marketMode || activeMarketId === MARKET_NONE_ID) return;
    const source =
      RATINGS_SOURCE_BY_ID[sourceByMode[marketMode]]?.[marketMode] ??
      defaultRatingsFor(marketMode);
    marketBaselineRef.current[marketMode] = source;
    dispatch({ type: "loadRatings", mode: marketMode, assignments: source });
  }, [activeMarketId, marketMode]);

  // Fetch live odds while a market is selected, refreshing on an interval and
  // on demand. Aborts in-flight requests when the source changes or clears.
  useEffect(() => {
    if (!marketMode) return;
    if (activeMarketId === MARKET_NONE_ID) {
      setMarketByMode((prev) => ({ ...prev, [marketMode]: null }));
      setMarketStatusByMode((prev) => ({ ...prev, [marketMode]: "idle" }));
      setMarketErrorByMode((prev) => ({ ...prev, [marketMode]: null }));
      return;
    }
    const mode = marketMode;
    const source = MARKET_SOURCES_BY_MODE[mode].find(
      (s) => s.id === activeMarketId,
    );
    if (!source) return;
    const controller = new AbortController();
    let active = true;
    const load = async () => {
      setMarketStatusByMode((prev) => ({ ...prev, [mode]: "loading" }));
      try {
        const snapshot = await source.fetch(controller.signal);
        if (!active) return;
        setMarketByMode((prev) => ({ ...prev, [mode]: snapshot }));
        setMarketStatusByMode((prev) => ({ ...prev, [mode]: "live" }));
        setMarketErrorByMode((prev) => ({ ...prev, [mode]: null }));
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        setMarketStatusByMode((prev) => ({ ...prev, [mode]: "error" }));
        setMarketErrorByMode((prev) => ({
          ...prev,
          [mode]: error instanceof Error ? error.message : "Failed to load odds",
        }));
      }
    };
    load();
    const timer = window.setInterval(load, MARKET_REFRESH_MS);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [activeMarketId, marketRefresh, marketMode]);

  const handlePollReapply = useCallback(() => {
    if (!raceMode) return;
    const baseline = pollBaselineRef.current[raceMode];
    if (!baseline) return;
    dispatch({ type: "loadRatings", mode: raceMode, assignments: baseline });
  }, [raceMode]);

  const handleMarketReapply = useCallback(() => {
    if (!marketMode) return;
    const baseline = marketBaselineRef.current[marketMode];
    if (!baseline) return;
    dispatch({ type: "loadRatings", mode: marketMode, assignments: baseline });
  }, [marketMode]);

  const handleRegionClick = useCallback(
    (id: string) => {
      if (brush === "CYCLE") {
        dispatch({ type: "cycle", mode: state.mode, id });
      } else if (brush === "CLEAR") {
        dispatch({ type: "set", mode: state.mode, id, party: null });
      } else {
        dispatch({ type: "set", mode: state.mode, id, party: brush });
      }
    },
    [brush, state.mode],
  );

  const score = useMemo(() => {
    if (state.mode === "president") {
      return presidentScore(projected);
    }
    if (state.mode === "senate") {
      return senateScore(projected);
    }
    if (state.mode === "governor") {
      return governorScore(projected);
    }
    return houseScore(projected);
  }, [state.mode, projected]);

  const seats = useMemo(
    () => chamberSeats(state.mode, projected),
    [state.mode, projected],
  );

  const handleExport = useCallback(async () => {
    if (!svgRef.current) return;
    await exportSvgAsPng(
      svgRef.current,
      `election-map-${state.mode}.png`,
      "#ffffff",
      `My 2026 Election Mapper ${MODE_LABEL[state.mode]} Map`,
      score.segments.map((s) => ({
        label: s.label,
        value: s.count,
        color: s.color,
      })),
    );
  }, [state.mode, score]);

  const handleCopyLink = useCallback(async () => {
    if (!regionIds) return;
    const hash = encodeHash(state.assignments, regionIds, state.mode);
    const url = `${window.location.origin}${window.location.pathname}${hash}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Clipboard unavailable", error);
    }
  }, [regionIds, state.assignments, state.mode]);

  const handleSourceChange = useCallback(
    (mode: RatingMode, sourceId: string) => {
      const source = RATINGS_SOURCE_BY_ID[sourceId];
      const ratings = source?.[mode];
      if (!source || ratings == null) return;
      // Choosing a ratings source means the user wants to see ratings again,
      // so drop any active polling or market overlay (it would otherwise keep
      // covering the map and make the change invisible). The new ratings
      // replace any paints wholesale, so clear the baselines too (otherwise the
      // overlay-transition effects would restore the old map over them).
      if (isRaceMode(mode)) {
        setPollOptionByMode((prev) => ({ ...prev, [mode]: POLL_NONE_OPTION_ID }));
        pollBaselineRef.current[mode] = null;
      }
      if (isMarketMode(mode)) {
        setMarketSourceByMode((prev) => ({ ...prev, [mode]: MARKET_NONE_ID }));
        marketBaselineRef.current[mode] = null;
      }
      setSourceByMode((prev) => ({ ...prev, [mode]: sourceId }));
      dispatch({ type: "loadRatings", mode, assignments: ratings });
    },
    [],
  );

  // Ratings, polling, and betting markets are mutually exclusive overlays.
  const handlePollChange = useCallback(
    (optionId: string) => {
      if (!raceMode) return;
      setPollOptionByMode((prev) => ({ ...prev, [raceMode]: optionId }));
      if (optionId !== POLL_NONE_OPTION_ID) {
        setMarketSourceByMode((prev) => ({
          ...prev,
          [raceMode]: MARKET_NONE_ID,
        }));
        marketBaselineRef.current[raceMode] = null;
      }
    },
    [raceMode],
  );

  const handleMarketChange = useCallback(
    (sourceId: string) => {
      if (!marketMode) return;
      setMarketSourceByMode((prev) => ({ ...prev, [marketMode]: sourceId }));
      // A market and polling never coexist on the same map (House has no
      // polling, so only Senate/Governor can carry both).
      if (sourceId !== MARKET_NONE_ID && isRaceMode(marketMode)) {
        setPollOptionByMode((prev) => ({
          ...prev,
          [marketMode]: POLL_NONE_OPTION_ID,
        }));
        pollBaselineRef.current[marketMode] = null;
      }
    },
    [marketMode],
  );

  // Undo and reset change the map out from under any poll, market, or ratings
  // dropdown, so keeping a selection would show it as active while it no longer
  // matches the map. Clear the mode's selections and the baselines that would
  // re-apply them.
  const clearSelections = useCallback((mode: Mode) => {
    if (isRaceMode(mode)) {
      setPollOptionByMode((prev) => ({ ...prev, [mode]: POLL_NONE_OPTION_ID }));
      pollBaselineRef.current[mode] = null;
    }
    if (isMarketMode(mode)) {
      setMarketSourceByMode((prev) => ({ ...prev, [mode]: MARKET_NONE_ID }));
      marketBaselineRef.current[mode] = null;
    }
    if (mode !== "president") {
      setSourceByMode((prev) => ({ ...prev, [mode]: "" }));
    }
  }, []);

  const handleUndo = useCallback(() => {
    clearSelections(state.mode);
    dispatch({ type: "undo" });
  }, [clearSelections, state.mode]);

  const handleReset = useCallback(() => {
    clearSelections(state.mode);
    dispatch({ type: "reset", mode: state.mode });
  }, [clearSelections, state.mode]);

  // The dropdown only applies to the rating-based modes. "Custom" means the
  // user has edited this mode's map so it no longer matches the source that
  // populated it (edit actions always write a fresh region map).
  const ratingMode: RatingMode | null =
    state.mode === "president" ? null : state.mode;
  const selectedSourceId = ratingMode
    ? sourceByMode[ratingMode]
    : DEFAULT_RATINGS_SOURCE;
  // Picking a poll or market on a race map deselects the ratings dropdown, and
  // picking a ratings source drops either overlay, so the three selects stay
  // mutually exclusive. House has no polling, but it does have a market.
  const pollingOn =
    raceMode != null && pollOptionByMode[raceMode] !== POLL_NONE_OPTION_ID;
  const marketsOn =
    marketMode != null && marketSourceByMode[marketMode] !== MARKET_NONE_ID;
  const ratingsSelectId = pollingOn || marketsOn ? "" : selectedSourceId;
  const selectedSourceRatings = ratingMode
    ? RATINGS_SOURCE_BY_ID[selectedSourceId]?.[ratingMode]
    : undefined;
  const ratingsCustom =
    !pollingOn &&
    !marketsOn &&
    ratingMode != null &&
    selectedSourceRatings != null &&
    state.assignments[ratingMode] !== selectedSourceRatings;
  // True when the user has painted over the poll overlay since polling began.
  // The baseline is stored by the poll-transition effect, so it is null on the
  // first render after entering polling (until the effect runs).
  const activePollBaseline = raceMode ? pollBaselineRef.current[raceMode] : null;
  const activeMarketBaseline = marketMode
    ? marketBaselineRef.current[marketMode]
    : null;
  const pollCustom =
    pollingOn &&
    raceMode != null &&
    activePollBaseline !== null &&
    state.assignments[raceMode] !== activePollBaseline;
  const marketCustom =
    marketsOn &&
    marketMode != null &&
    activeMarketBaseline !== null &&
    state.assignments[marketMode] !== activeMarketBaseline;

  const loading = !states || !districts;
  const currentFeatures = state.mode === "house" ? districts : states;
  const senateFips = useMemo(() => new Set(SENATE_2026_FIPS), []);
  const governorFips = useMemo(() => new Set(GOVERNOR_2026_FIPS), []);

  return (
    <div className="app">
      <header className="header">
        <div className="header__top">
          <div className="header__brand">
            <Logo />
            <h1>2026 Election Mapper</h1>
          </div>
          <div className="header__actions">
            <button type="button" onClick={handleCopyLink} disabled={loading}>
              {copied ? "✅ Link copied!" : "🔗 Copy link"}
            </button>
            <button type="button" onClick={handleExport} disabled={loading}>
              🖼️ Export PNG
            </button>
          </div>
        </div>
      </header>

      <ModeTabs
        mode={state.mode}
        onChange={(mode) => {
          setAnalyzerOpen(false);
          dispatch({ type: "setMode", mode });
        }}
        analyzerActive={analyzerOpen}
        onAnalyzer={() => setAnalyzerOpen(true)}
      />

      {analyzerOpen && states && districts ? (
        <StateAnalyzer
          states={states}
          districts={districts}
          demographics={demographics}
          senateFips={senateFips}
          governorFips={governorFips}
          svgRef={svgRef}
        />
      ) : (
      <main className="layout">
        <section className="map-panel">
          {loading || !currentFeatures ? (
            <div className="loading">Loading map…</div>
          ) : (
            <RegionMap
              key={state.mode}
              features={currentFeatures}
              getId={getId}
              getLabel={getLabel}
              isActive={isActive}
              assignments={state.assignments[state.mode]}
              onRegionClick={handleRegionClick}
              svgRef={svgRef}
              stripePickups={stripePickups}
              getIncumbent={getIncumbent}
              poll={marketOverlay ?? pollOverlay}
            />
          )}
        </section>

        <aside className="side">
          <section className="panel">
            <h2 className="panel__title">Scoreboard</h2>
            <Scoreboard score={score} seats={seats} />
          </section>

          {ratingMode ? (
            <RatingsPanel
              mode={ratingMode}
              sourceId={ratingsSelectId}
              isCustom={ratingsCustom}
              active={ratingsSelectId !== ""}
              onChange={(sourceId) => handleSourceChange(ratingMode, sourceId)}
            />
          ) : null}

          {raceMode ? (
            <PollingPanel
              optionId={pollOptionByMode[raceMode]}
              onChange={handlePollChange}
              isCustom={pollCustom}
              active={pollingOn}
              onReapply={handlePollReapply}
              raceLabel={RACE_CONFIG[raceMode].label}
              raceCount={RACE_CONFIG[raceMode].fips.length}
              asOf={POLL_DATASETS[raceMode].asOf}
              options={POLL_DATASETS[raceMode].options}
            />
          ) : null}

          {marketMode ? (
            <MarketPanel
              sourceId={marketSourceByMode[marketMode]}
              onChange={handleMarketChange}
              status={activeMarketStatus}
              asOf={activeMarket?.asOf ?? null}
              count={activeMarket ? Object.keys(activeMarket.quotes).length : 0}
              error={activeMarketError}
              isCustom={marketCustom}
              active={marketsOn}
              onRefresh={() => setMarketRefresh((n) => n + 1)}
              onReapply={handleMarketReapply}
              raceLabel={MARKET_RACE[marketMode].label}
              raceCount={MARKET_RACE[marketMode].count}
              sources={MARKET_SOURCES_BY_MODE[marketMode]}
            />
          ) : null}

          {ratingMode ? (
            <PickupPanel
              stripePickups={stripePickups}
              onStripeChange={setStripePickups}
            />
          ) : null}

          <section className="panel">
            <h2 className="panel__title">Paint</h2>
            <PartyPalette brush={brush} onChange={setBrush} />
          </section>

          <section className="panel actions">
            <button
              type="button"
              onClick={handleUndo}
              disabled={state.history.length === 0}
            >
              Undo
            </button>
            <button type="button" onClick={handleReset}>
              Reset {MODE_LABEL[state.mode]}
            </button>
          </section>
        </aside>
      </main>
      )}

      <footer className="footer">
        House districts use the Census Bureau's 120th Congressional District
        boundaries (2026 election cycle). The Senate map shows the 35 seats
        contested in 2026 and the Governor map the 36 governorships on the
        ballot; all other states are grey.
      </footer>
    </div>
  );
}
