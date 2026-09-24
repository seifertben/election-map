import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { ModeTabs } from "./components/ModeTabs";
import { PartyPalette } from "./components/PartyPalette";
import type { Brush } from "./components/PartyPalette";
import { RatingsPanel } from "./components/RatingsPanel";
import { RegionMap } from "./components/RegionMap";
import { Scoreboard } from "./components/Scoreboard";
import { HOUSE_2026_RATINGS } from "./data/house2026";
import { HOUSE_2026_HOLDER } from "./data/house2026Holder";
import {
  SENATE_2026_FIPS,
  SENATE_2026_RATINGS,
  SENATE_RACE_BY_FIPS,
} from "./data/senate2026";
import { STATE_BY_FIPS } from "./data/states";
import {
  DEFAULT_RATINGS_SOURCE,
  RATINGS_SOURCE_BY_ID,
  RATINGS_SOURCES,
} from "./data/ratingsSources";
import { exportSvgAsPng } from "./lib/exportPng";
import { projectFeatures } from "./lib/projection";
import { houseScore, presidentScore, senateScore } from "./lib/scoreboard";
import { decodeHash, encodeHash } from "./state/encoding";
import type { RegionIds } from "./state/encoding";
import { createInitialState, reducer } from "./state/reducer";
import type { Mode, RegionFeature } from "./types";

const ACTIVE_SENATE = new Set(SENATE_2026_FIPS);

const MODE_LABEL: Record<Mode, string> = {
  president: "President",
  senate: "Senate",
  house: "House",
};

function featureId(feature: RegionFeature, key: "fips" | "geoid"): string {
  const value = feature.properties[key];
  return String(value ?? feature.id ?? "");
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    createInitialState(),
  );
  const [states, setStates] = useState<RegionFeature[] | null>(null);
  const [districts, setDistricts] = useState<RegionFeature[] | null>(null);
  const [brush, setBrush] = useState<Brush>("CYCLE");
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sourceByMode, setSourceByMode] = useState<
    Record<"senate" | "house", string>
  >({
    senate: DEFAULT_RATINGS_SOURCE,
    house: DEFAULT_RATINGS_SOURCE,
  });
  const [stripePickups, setStripePickups] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}data/states.json`).then((r) => r.json()),
      fetch(`${base}data/cd120.json`).then((r) => r.json()),
    ])
      .then(([statesJson, districtsJson]) => {
        const stateFeatures = statesJson.features as RegionFeature[];
        const districtFeatures = districtsJson.features as RegionFeature[];
        setStates(stateFeatures);
        setDistricts(districtFeatures);
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
      house: districts.map((f) => featureId(f, "geoid")),
    };
  }, [states, districts]);

  // Load a shared map from the URL hash once the data is ready.
  useEffect(() => {
    if (!regionIds || hydrated) return;
    const decoded = decodeHash(window.location.hash, regionIds);
    // Default the Senate and House maps to the Cook 2026 race ratings whenever
    // no assignments for them were decoded from the URL.
    const senate = Object.keys(decoded.assignments.senate).length
      ? decoded.assignments.senate
      : SENATE_2026_RATINGS;
    const house = Object.keys(decoded.assignments.house).length
      ? decoded.assignments.house
      : HOUSE_2026_RATINGS;
    dispatch({
      type: "hydrate",
      mode: decoded.mode ?? undefined,
      assignments: { ...decoded.assignments, senate, house },
    });
    setHydrated(true);
  }, [regionIds, hydrated]);

  // Keep the URL in sync with the current map.
  useEffect(() => {
    if (!regionIds || !hydrated) return;
    const assigned =
      Object.keys(state.assignments.president).length +
      Object.keys(state.assignments.senate).length +
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

  const isActive = useCallback(
    (id: string) => (state.mode === "senate" ? ACTIVE_SENATE.has(id) : true),
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
      if (state.mode === "senate") {
        return SENATE_RACE_BY_FIPS[id]?.incumbentParty ?? null;
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
      const race = SENATE_RACE_BY_FIPS[fips];
      return race
        ? `${name} · ${race.seatClass === "3s" ? "special election" : "Class 2"}`
        : `${name} · no 2026 election`;
    },
    [state.mode],
  );

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
      return presidentScore(state.assignments.president);
    }
    if (state.mode === "senate") {
      return senateScore(state.assignments.senate);
    }
    return houseScore(state.assignments.house);
  }, [state.mode, state.assignments]);

  const handleExport = useCallback(async () => {
    if (!svgRef.current) return;
    await exportSvgAsPng(svgRef.current, `election-map-${state.mode}.png`);
  }, [state.mode]);

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
    (mode: "senate" | "house", sourceId: string) => {
      const source = RATINGS_SOURCE_BY_ID[sourceId];
      if (!source) return;
      setSourceByMode((prev) => ({ ...prev, [mode]: sourceId }));
      dispatch({ type: "loadRatings", mode, assignments: source[mode] });
    },
    [],
  );

  // The dropdown only applies to the rating-based modes. "Custom" means the
  // user has edited this mode's map so it no longer matches the source that
  // populated it (edit actions always write a fresh region map).
  const ratingMode = state.mode === "president" ? null : state.mode;
  const selectedSourceId = ratingMode
    ? sourceByMode[ratingMode]
    : DEFAULT_RATINGS_SOURCE;
  const ratingsCustom =
    ratingMode != null &&
    state.assignments[ratingMode] !==
      (RATINGS_SOURCE_BY_ID[selectedSourceId] ?? RATINGS_SOURCES[0])[
        ratingMode
      ];

  const loading = !states || !districts;
  const currentFeatures =
    state.mode === "house" ? districts : states;

  return (
    <div className="app">
      <header className="header">
        <h1>USA Election Map Builder</h1>
        <p className="subtitle">
          Build your 2026 forecast. Click a state or district to change its
          color.
        </p>
      </header>

      <ModeTabs
        mode={state.mode}
        onChange={(mode) => dispatch({ type: "setMode", mode })}
      />

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
            />
          )}
        </section>

        <aside className="side">
          {ratingMode ? (
            <RatingsPanel
              mode={ratingMode}
              sourceId={selectedSourceId}
              isCustom={ratingsCustom}
              onChange={(sourceId) => handleSourceChange(ratingMode, sourceId)}
              stripePickups={stripePickups}
              onStripeChange={setStripePickups}
            />
          ) : null}

          <section className="panel">
            <h2 className="panel__title">Paint</h2>
            <PartyPalette brush={brush} onChange={setBrush} />
          </section>

          <section className="panel">
            <h2 className="panel__title">Scoreboard</h2>
            <Scoreboard score={score} />
          </section>

          <section className="panel actions">
            <button
              type="button"
              onClick={() => dispatch({ type: "undo" })}
              disabled={state.history.length === 0}
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "reset", mode: state.mode })}
            >
              Reset {MODE_LABEL[state.mode]}
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "resetAll" })}
            >
              Reset all
            </button>
            <button type="button" onClick={handleExport} disabled={loading}>
              Export PNG
            </button>
            <button type="button" onClick={handleCopyLink} disabled={loading}>
              {copied ? "Link copied!" : "Copy link"}
            </button>
          </section>
        </aside>
      </main>

      <footer className="footer">
        House districts use the Census Bureau's 120th Congressional District
        boundaries (2026 election cycle). The Senate map shows the 35 seats
        contested in 2026; all other states are grey.
      </footer>
    </div>
  );
}
