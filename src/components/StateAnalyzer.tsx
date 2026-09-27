import { useCallback, useEffect, useMemo, useState } from "react";
import type { Ref } from "react";
import { GOVERNOR_RACE_BY_FIPS } from "../data/governor2026";
import { HOUSE_2026_HOLDER } from "../data/house2026Holder";
import { SENATE_RACE_BY_FIPS } from "../data/senate2026";
import { STATE_BY_FIPS } from "../data/states";
import { ANALYZER_POLLS, ANALYZER_POLL_BY_ID } from "../data/analyzerPolls";
import type { AnalyzerPoll } from "../data/analyzerPolls";
import { colorForStrength, formatMargin } from "../lib/polling";
import type { PollOverlay, PollSummary } from "../lib/polling";
import {
  DIMENSIONS,
  DIMENSION_BY_ID,
  adjustComposition,
  analyze,
  compositionMap,
  initialSplits,
  marginStrength,
  scenarioFromComposition,
  winnerOf,
} from "../lib/analyzer";
import { splitsFromCrosstab, compositionFromCrosstab } from "../lib/analyzerPolls";
import { baselineSplitsForState } from "../lib/analyzerBaseline";
import type {
  AnalyzerResult,
  CompositionMap,
  DemographicsData,
  DimensionId,
  GeographyComposition,
  Splits,
} from "../lib/analyzer";
import type { RegionFeature } from "../types";
import { RegionMap } from "./RegionMap";

export type AnalyzerElection = "senate" | "house" | "governor";

const ELECTION_LABEL: Record<AnalyzerElection, string> = {
  senate: "Senate (2026)",
  governor: "Governor (2026)",
  house: "House (2026)",
};

export interface StateAnalyzerProps {
  states: RegionFeature[];
  districts: RegionFeature[];
  demographics: DemographicsData | null;
  /** State FIPS with a 2026 Senate race. */
  senateFips: Set<string>;
  /** State FIPS with a 2026 Governor race. */
  governorFips: Set<string>;
  svgRef?: Ref<SVGSVGElement>;
}

function fipsOf(feature: RegionFeature): string {
  return String(feature.properties.fips ?? "");
}

function geoidOf(feature: RegionFeature): string {
  return String(feature.properties.geoid ?? "");
}

function districtLabel(feature: RegionFeature): string {
  const abbr = STATE_BY_FIPS[String(feature.properties.state)]?.abbr ?? "??";
  const code = String(feature.properties.district);
  return code === "00" || code === "98"
    ? `${abbr} (at-large)`
    : `${abbr}-${Number.parseInt(code, 10)}`;
}

function uniformComposition(): GeographyComposition {
  const shares = (ids: string[]) =>
    Object.fromEntries(ids.map((id) => [id, 1 / ids.length]));
  const sex = shares(["male", "female"]);
  const age = shares(["18-29", "30-44", "45-64", "65+"]);
  const race = shares(["white", "black", "hispanic", "asian", "other"]);
  const education = shares(["no-hs", "hs", "some-college", "bachelors-plus"]);
  const party = shares(["democrat", "republican", "independent"]);
  return {
    population: 1,
    votingAgePopulation: 1,
    sex,
    age,
    race,
    education,
    party,
  };
}

const FALLBACK = uniformComposition();

/** Which 2026 elections the selected state can hold. */
function electionsFor(
  fips: string,
  hasDistricts: boolean,
  senateFips: Set<string>,
  governorFips: Set<string>,
): AnalyzerElection[] {
  const list: AnalyzerElection[] = [];
  if (senateFips.has(fips)) list.push("senate");
  if (governorFips.has(fips)) list.push("governor");
  if (hasDistricts) list.push("house");
  return list;
}

/** Whether a poll has crosstabs for the state, regardless of the race. */
function pollCoversState(id: string, fips: string): boolean {
  const poll = ANALYZER_POLL_BY_ID[id];
  return Boolean(poll && poll.states[fips]);
}

export function StateAnalyzer({
  states,
  districts,
  demographics,
  senateFips,
  governorFips,
  svgRef,
}: StateAnalyzerProps) {
  const stateFeatures = useMemo(
    () =>
      [...states].sort((a, b) =>
        String(a.properties.name).localeCompare(String(b.properties.name)),
      ),
    [states],
  );
  const districtFips = useMemo(
    () => new Set(districts.map((d) => String(d.properties.state))),
    [districts],
  );
  // The analyzer models 2026 races only, so states without one are not offered.
  const availableStates = useMemo(
    () =>
      stateFeatures.filter(
        (f) =>
          electionsFor(
            fipsOf(f),
            districtFips.has(fipsOf(f)),
            senateFips,
            governorFips,
          ).length > 0,
      ),
    [stateFeatures, districtFips, senateFips, governorFips],
  );
  const initialFips = availableStates.some((f) => fipsOf(f) === "06")
    ? "06"
    : availableStates[0]
      ? fipsOf(availableStates[0])
      : "";
  const [stateFips, setStateFips] = useState<string>(initialFips);
  const [election, setElection] = useState<AnalyzerElection>(() => {
    const options = electionsFor(
      initialFips,
      districtFips.has(initialFips),
      senateFips,
      governorFips,
    );
    return options.includes("house") ? "house" : options[0] ?? "house";
  });
  // Category partisanship is re-seeded for the active state from the national
  // exit-poll baseline shifted by its 2024 presidential lean, or from a loaded
  // poll's own crosstabs when one covers the race. The composition scenario is
  // seeded from the active state's census, or from that poll's electorate.
  const [splits, setSplits] = useState<Splits>(() =>
    baselineSplitsForState(initialFips),
  );
  const [scenario, setScenario] = useState<CompositionMap>(() =>
    scenarioFromComposition(
      demographics?.states[initialFips] ?? FALLBACK,
    ),
  );
  // Which crosstab poll seeded the current splits and composition, or "" for
  // the random/census baseline. Cleared when it no longer covers the race.
  const [pollId, setPollId] = useState("");
  const [seed, setSeed] = useState(0);
  // Off by default: the analyzer shows plain projections until the user asks
  // to stripe the regions whose projected party flips the incumbent's.
  const [showFlips, setShowFlips] = useState(false);
  // True once a manual slider move has diverged from the loaded poll's
  // crosstabs, which enables resetting the sliders back to that poll.
  const [pollDirty, setPollDirty] = useState(false);

  const censusFor = (fips: string) =>
    demographics?.states[fips] ?? FALLBACK;

  const handleStateChange = (fips: string) => {
    setStateFips(fips);
    const nextOptions = electionsFor(
      fips,
      districtFips.has(fips),
      senateFips,
      governorFips,
    );
    const nextElection = nextOptions.includes(election)
      ? election
      : nextOptions.includes("house")
        ? "house"
        : nextOptions[0];
    if (nextElection !== election) {
      setElection(nextElection);
    }
    const covers = pollId !== "" && pollCoversState(pollId, fips);
    const census = censusFor(fips);
    setScenario(
      covers
        ? compositionFromCrosstab(
            ANALYZER_POLL_BY_ID[pollId].states[fips].composition,
            census,
          )
        : scenarioFromComposition(census),
    );
    if (!covers) {
      if (pollId !== "") setPollId("");
      setSplits(baselineSplitsForState(fips));
    }
    setPollDirty(false);
  };

  const handleElectionChange = (next: AnalyzerElection) => {
    setElection(next);
    const covers = pollId !== "" && pollCoversState(pollId, stateFips);
    const census = censusFor(stateFips);
    setScenario(
      covers
        ? compositionFromCrosstab(
            ANALYZER_POLL_BY_ID[pollId].states[stateFips].composition,
            census,
          )
        : scenarioFromComposition(census),
    );
    if (pollId !== "" && !covers) {
      setPollId("");
      setSplits(baselineSplitsForState(stateFips));
    }
    setPollDirty(false);
  };

  const handlePollChange = (id: string) => {
    setPollId(id);
    const crosstab = ANALYZER_POLL_BY_ID[id]?.states[stateFips] ?? null;
    const census = censusFor(stateFips);
    setSplits(
      crosstab ? splitsFromCrosstab(crosstab) : baselineSplitsForState(stateFips),
    );
    setScenario(
      crosstab
        ? compositionFromCrosstab(crosstab.composition, census)
        : scenarioFromComposition(census),
    );
    setPollDirty(false);
  };

  // Sliders write through these so any manual move can flag the loaded poll as
  // edited; the reset button restores the poll's published crosstabs.
  const handleSplitsChange = (next: Splits) => {
    setSplits(next);
    if (pollId) setPollDirty(true);
  };
  const handleScenarioChange = (next: CompositionMap) => {
    setScenario(next);
    if (pollId) setPollDirty(true);
  };
  const handleResetPoll = () => {
    if (pollId) handlePollChange(pollId);
  };

  const stateFeature = availableStates.find((f) => fipsOf(f) === stateFips);
  if (!stateFeature) {
    return <div className="loading">No 2026 races for this state.</div>;
  }
  const options = electionsFor(
    stateFips,
    districtFips.has(stateFips),
    senateFips,
    governorFips,
  );
  const activeElection = options.includes(election) ? election : options[0];
  // Any poll with crosstabs for this state can seed the race; polls fielded for
  // the active race come first, and applying the others is flagged as an
  // extrapolation.
  const polls = ANALYZER_POLLS.filter((poll) => poll.states[stateFips]).sort(
    (a, b) =>
      Number(a.election !== activeElection) -
      Number(b.election !== activeElection),
  );

  return (
    <main className="layout">
      <StateAnalysis
        key={stateFips}
        stateFeature={stateFeature}
        districts={districts}
        demographics={demographics}
        stateFeatures={availableStates}
        election={activeElection}
        electionOptions={options}
        onStateChange={handleStateChange}
        onElectionChange={handleElectionChange}
        splits={splits}
        onSplitsChange={handleSplitsChange}
        scenario={scenario}
        onScenarioChange={handleScenarioChange}
        polls={polls}
        pollId={pollId}
        onPollChange={handlePollChange}
        pollDirty={pollDirty}
        onResetPoll={handleResetPoll}
        onRandomize={() => {
          setSplits(initialSplits(`state-analyzer-${seed + 1}`));
          setSeed(seed + 1);
          setPollId("");
          setPollDirty(false);
        }}
        showFlips={showFlips}
        onShowFlipsChange={setShowFlips}
        svgRef={svgRef}
      />
    </main>
  );
}

interface StateAnalysisProps {
  stateFeature: RegionFeature;
  stateFeatures: RegionFeature[];
  districts: RegionFeature[];
  demographics: DemographicsData | null;
  election: AnalyzerElection;
  electionOptions: AnalyzerElection[];
  onStateChange: (fips: string) => void;
  onElectionChange: (election: AnalyzerElection) => void;
  splits: Splits;
  onSplitsChange: (splits: Splits) => void;
  /** Composition scenario (share of the electorate by category). */
  scenario: CompositionMap;
  onScenarioChange: (scenario: CompositionMap) => void;
  /** Crosstab polls available for the active state's race. */
  polls: AnalyzerPoll[];
  /** Selected poll id, or "" for the random baseline. */
  pollId: string;
  onPollChange: (id: string) => void;
  /** Whether the loaded poll's sliders have been edited since it was seeded. */
  pollDirty: boolean;
  onResetPoll: () => void;
  onRandomize: () => void;
  /** Whether projected party flips are striped. */
  showFlips: boolean;
  onShowFlipsChange: (enabled: boolean) => void;
  svgRef?: Ref<SVGSVGElement>;
}

function StateAnalysis({
  stateFeature,
  stateFeatures,
  districts,
  demographics,
  election,
  electionOptions,
  onStateChange,
  onElectionChange,
  splits,
  onSplitsChange,
  scenario,
  onScenarioChange,
  polls,
  pollId,
  onPollChange,
  pollDirty,
  onResetPoll,
  onRandomize,
  showFlips,
  onShowFlipsChange,
  svgRef,
}: StateAnalysisProps) {
  const stateFips = fipsOf(stateFeature);
  const stateName = STATE_BY_FIPS[stateFips]?.name ?? stateFips;
  const [activeDimension, setActiveDimension] = useState<DimensionId>("race");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  useEffect(() => {
    if (!showHelp) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowHelp(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showHelp]);
  const selectedPoll = ANALYZER_POLL_BY_ID[pollId] ?? null;
  const selectedPollExtrapolated = Boolean(
    selectedPoll && selectedPoll.election !== election,
  );
  // A poll that did not crosstab the active dimension by vote leaves its
  // categories inheriting the poll's overall split, which the sliders flag.
  const pollCrosstab = selectedPoll?.states[stateFips] ?? null;
  const pollMissingDimension = Boolean(
    pollCrosstab &&
      Object.keys(pollCrosstab[activeDimension] ?? {}).length === 0,
  );

  const baseComposition = demographics?.states[stateFips] ?? FALLBACK;
  const baseMap = useMemo(
    () => compositionMap(baseComposition),
    [baseComposition],
  );

  const features = useMemo(
    () =>
      election === "house"
        ? districts.filter((d) => String(d.properties.state) === stateFips)
        : stateFeatures.filter((f) => fipsOf(f) === stateFips),
    [election, districts, stateFeatures, stateFips],
  );

  // The composition each region is projected from: a district's own census
  // scaled by the statewide scenario, or the scenario itself for statewide
  // races. Also feeds the hover breakdown so it matches the projection.
  const regionCompositions = useMemo(() => {
    const comps = new Map<string, CompositionMap>();
    if (election === "house") {
      for (const feature of features) {
        const geoid = geoidOf(feature);
        const comp = demographics?.districts[geoid] ?? baseComposition;
        comps.set(
          geoid,
          adjustComposition(compositionMap(comp), baseMap, scenario),
        );
      }
    } else {
      comps.set(stateFips, scenario);
    }
    return comps;
  }, [
    election,
    features,
    demographics,
    baseComposition,
    baseMap,
    scenario,
    stateFips,
  ]);

  // A potential result per region on the map (House districts, or the single
  // state for statewide races).
  const regionResults = useMemo(() => {
    const results = new Map<string, AnalyzerResult>();
    for (const [id, comp] of regionCompositions) {
      results.set(id, analyze(comp, [activeDimension], splits));
    }
    return results;
  }, [regionCompositions, activeDimension, splits]);

  // Statewide result: a population-weighted roll-up of the districts, or the
  // state's own projection for statewide races.
  const statewide = useMemo<AnalyzerResult>(() => {
    if (election !== "house") {
      return (
        regionResults.get(stateFips) ?? analyze(scenario, [activeDimension], splits)
      );
    }
    let d = 0;
    let r = 0;
    let o = 0;
    let weight = 0;
    for (const feature of features) {
      const geoid = geoidOf(feature);
      const result = regionResults.get(geoid);
      if (!result) continue;
      const w = demographics?.districts[geoid]?.votingAgePopulation ?? 1;
      d += result.d * w;
      r += result.r * w;
      o += result.o * w;
      weight += w;
    }
    if (weight === 0) {
      return { d: 50, r: 50, o: 0, margin: 0, winner: "TOSS", segments: [] };
    }
    const dd = d / weight;
    const rr = r / weight;
    return {
      d: dd,
      r: rr,
      o: o / weight,
      margin: dd - rr,
      winner: winnerOf(dd, rr),
      segments: [],
    };
  }, [
    election,
    regionResults,
    features,
    demographics,
    stateFips,
    scenario,
    activeDimension,
    splits,
  ]);

  const districtTally = useMemo(() => {
    const tally = { D: 0, R: 0, TOSS: 0 };
    if (election !== "house") return tally;
    for (const feature of features) {
      const result = regionResults.get(geoidOf(feature));
      if (result) tally[result.winner] += 1;
    }
    return tally;
  }, [election, features, regionResults]);

  // The party currently holding a region, for the flip stripes. House races
  // key off the district geoid; statewide races have a single holder per state.
  const getIncumbent = useCallback(
    (id: string): string | null => {
      if (election === "house") return HOUSE_2026_HOLDER[id] ?? null;
      if (election === "governor") {
        return GOVERNOR_RACE_BY_FIPS[id]?.incumbentParty ?? null;
      }
      return SENATE_RACE_BY_FIPS[id]?.incumbentParty ?? null;
    },
    [election],
  );

  const overlay = useMemo<PollOverlay>(
    () => ({
      fills: Object.fromEntries(
        [...regionResults.entries()].map(([id, result]) => [
          id,
          colorForStrength(marginStrength(result.margin)),
        ]),
      ),
      // RegionMap reads this to stripe flips: the projected leader becomes the
      // pickup party and the fill (already in `fills`) its confidence band.
      summaryFor: (id): PollSummary | null => {
        const result = regionResults.get(id);
        if (!result || result.winner === "TOSS") return null;
        return {
          d: result.d,
          r: result.r,
          margin: result.margin,
          leader: result.winner,
          polls: 0,
          latest: "",
        };
      },
      optionLabel: "Demographic model",
      isPainted: () => false,
      describe: (id) => {
        const result = regionResults.get(id);
        if (!result) return null;
        const other = result.o > 0.05 ? ` / O ${result.o.toFixed(1)}` : "";
        return `D ${result.d.toFixed(1)} / R ${result.r.toFixed(1)}${other} · ${formatMargin(
          result.margin,
        )}`;
      },
      // The active lens's composition for the region, i.e. the breakdown the
      // projection is built from.
      breakdown: (id) => {
        const comp = regionCompositions.get(id);
        if (!comp) return null;
        const dimension = DIMENSION_BY_ID[activeDimension];
        const shares = comp[activeDimension] ?? {};
        const parts = dimension.categories
          .map((category) => {
            const share = Math.round((shares[category.id] ?? 0) * 100);
            return `${category.short} ${share}%`;
          })
          .join(" · ");
        // House district party ID is modeled from the 2024 presidential vote
        // where CES had too little data; flag those breakdowns on hover.
        const estimated =
          election === "house" &&
          activeDimension === "party" &&
          demographics?.districts[id]?.partyEstimated;
        return `${dimension.label}: ${parts}${
          estimated ? " (estimated from the 2024 vote)" : ""
        }`;
      },
    }),
    [regionResults, regionCompositions, activeDimension, election, demographics],
  );

  // Shares are independent fixed values; setting one never moves another. They
  // are normalized only when the projection is computed.
  const updateShare = (dimension: DimensionId, category: string, pct: number) => {
    onScenarioChange({
      ...scenario,
      [dimension]: { ...scenario[dimension], [category]: pct / 100 },
    });
  };

  // The split is a single track with two knobs: the left sets the Democratic
  // share of the D/R portion, the right marks where R ends and Other begins.
  // D/R is therefore whatever portion the Other knob leaves behind.
  const updateSplit = (dimension: DimensionId, category: string, d: number) => {
    const split = splits[dimension]?.[category] ?? { d: 50, r: 50, o: 0 };
    const dd = Math.max(0, Math.min(d, 100 - split.o));
    onSplitsChange({
      ...splits,
      [dimension]: {
        ...splits[dimension],
        [category]: { d: dd, r: 100 - dd - split.o, o: split.o },
      },
    });
  };

  const updateOther = (dimension: DimensionId, category: string, o: number) => {
    const split = splits[dimension]?.[category] ?? { d: 50, r: 50, o: 0 };
    const other = Math.max(0, Math.min(o, 100 - split.d));
    onSplitsChange({
      ...splits,
      [dimension]: {
        ...splits[dimension],
        [category]: {
          d: split.d,
          r: 100 - split.d - other,
          o: other,
        },
      },
    });
  };

  const resetScenario = () => onScenarioChange(scenarioFromComposition(baseComposition));

  const selectedResult = selectedRegion
    ? regionResults.get(selectedRegion)
    : undefined;
  const activeDimensionDef = DIMENSION_BY_ID[activeDimension];
  const shareTotal = Object.values(scenario[activeDimension] ?? {}).reduce(
    (sum, value) => sum + value,
    0,
  );
  const shareTotalPct = shareTotal * 100;
  const shareComplete = Math.abs(shareTotalPct - 100) < 0.5;

  return (
    <>
      <section className="map-panel">
        <RegionMap
          key={`${stateFips}:${election}`}
          features={features}
          getId={election === "house" ? geoidOf : fipsOf}
          getLabel={
            election === "house"
              ? districtLabel
              : () => `${stateName} · ${ELECTION_LABEL[election]}`
          }
          isActive={() => true}
          assignments={{}}
          onRegionClick={(id) => {
            if (election === "house") setSelectedRegion(id);
          }}
          svgRef={svgRef}
          stripePickups={showFlips}
          getIncumbent={getIncumbent}
          poll={overlay}
        />
      </section>

      <aside className="side">
        <section className="panel panel--active">
          <div className="panel__head">
            <h2 className="panel__title">State Analyzer</h2>
            <button
              type="button"
              className="analyzer__help-button"
              onClick={() => setShowHelp(true)}
            >
              How it works
            </button>
          </div>
          <label className="ratings__label" htmlFor="analyzer-state">
            State
          </label>
          <select
            id="analyzer-state"
            className="ratings__select"
            value={stateFips}
            onChange={(event) => onStateChange(event.target.value)}
          >
            {stateFeatures.map((feature) => (
              <option key={fipsOf(feature)} value={fipsOf(feature)}>
                {STATE_BY_FIPS[fipsOf(feature)]?.name ?? fipsOf(feature)}
              </option>
            ))}
          </select>

          <label className="ratings__label" htmlFor="analyzer-election">
            Election
          </label>
          <select
            id="analyzer-election"
            className="ratings__select"
            value={election}
            onChange={(event) =>
              onElectionChange(event.target.value as AnalyzerElection)
            }
          >
            {electionOptions.map((option) => (
              <option key={option} value={option}>
                {ELECTION_LABEL[option]}
              </option>
            ))}
          </select>

          <label className="ratings__label" htmlFor="analyzer-poll">
            Poll
          </label>
          <select
            id="analyzer-poll"
            className="ratings__select"
            value={pollId}
            onChange={(event) => onPollChange(event.target.value)}
          >
            <option value="">No poll loaded</option>
            {polls.map((poll) => (
              <option key={poll.id} value={poll.id}>
                {poll.label}
              </option>
            ))}
          </select>
          {selectedPoll ? (
            <p className="ratings__note">
              Loaded {selectedPoll.label} ({selectedPoll.pollster}). Each group's
              share of the electorate and vote split start from the poll's
              crosstabs — drag either slider to model a different result.{" "}
              <a
                href={selectedPoll.source}
                target="_blank"
                rel="noreferrer"
              >
                Source
              </a>
              {selectedPollExtrapolated ? (
                <>
                  {" "}
                  <strong>Extrapolation:</strong> this is a{" "}
                  {ELECTION_LABEL[selectedPoll.election]} poll applied to the{" "}
                  {ELECTION_LABEL[election]} race. Its crosstabs were not
                  published for this race, so the result is a proxy.
                </>
              ) : null}
            </p>
          ) : (
            <p className="ratings__note">
              {polls.length
                ? "Load a poll to set each group's share of the electorate and vote split from its published crosstabs. Polls fielded for another race in this state can be extrapolated. Otherwise shares come from the census and vote splits start from a national exit-poll baseline shifted by the state's lean."
                : "No crosstab poll is available for this state yet, so shares come from the census and vote splits start from a national exit-poll baseline shifted by the state's lean."}
            </p>
          )}
        </section>

        <section className="panel panel--active">
          <h2 className="panel__title">{stateName} projection</h2>
          <ResultSummary
            result={statewide}
            tally={election === "house" ? districtTally : null}
            regionCount={election === "house" ? features.length : 1}
          />
          {election === "house" && selectedRegion && selectedResult ? (
            <p className="ratings__note">
              Selected {districtLabel(
                features.find((f) => geoidOf(f) === selectedRegion) as RegionFeature,
              )}
              : D {selectedResult.d.toFixed(1)} / R{" "}
              {selectedResult.r.toFixed(1)} ({formatMargin(selectedResult.margin)}
              ).
            </p>
          ) : null}
        </section>

        <section className="panel panel--active">
          <h2 className="panel__title">Pickups</h2>
          <label className="ratings__toggle">
            <input
              type="checkbox"
              checked={showFlips}
              onChange={(event) => onShowFlipsChange(event.target.checked)}
            />
            Stripe party flips
          </label>
          <p className="ratings__note">
            Regions whose projected party differs from the incumbent are
            striped: the wider band is the projected shade, the narrower one a
            lighter tint.
          </p>
        </section>

        <section className="panel panel--active">
          <h2 className="panel__title">Demographic lens</h2>
          <div
            className="analyzer__dimensions"
            role="radiogroup"
            aria-label="Demographic dimension"
          >
            {DIMENSIONS.map((dimension) => (
              <label
                key={dimension.id}
                className={
                  activeDimension === dimension.id
                    ? "analyzer__dimension analyzer__dimension--active"
                    : "analyzer__dimension"
                }
              >
                <input
                  type="radio"
                  name="analyzer-dimension"
                  checked={activeDimension === dimension.id}
                  onChange={() => setActiveDimension(dimension.id)}
                />
                {dimension.label}
              </label>
            ))}
          </div>
          <p className="ratings__note">
            Only the selected group drives the map and the roll-up. Composition
            comes from the census, or from a loaded poll's electorate; drag a
            share to model a different electorate, or a split to change how that
            group votes.
          </p>
        </section>

        <section className="panel panel--active" key={activeDimension}>
          <h2 className="panel__title">{activeDimensionDef.label}</h2>
          <div className="analyzer__total">
            <span>Total</span>
            <span
              className={
                shareComplete
                  ? "analyzer__total-value analyzer__total-value--ok"
                  : "analyzer__total-value analyzer__total-value--off"
              }
            >
              {shareTotalPct.toFixed(0)}%
            </span>
          </div>
          <p className="analyzer__hint">
            Each share is fixed — moving one doesn't change the others. Shares
            are normalized to 100% for the projection.
          </p>
          {pollMissingDimension ? (
            <p className="ratings__note">
              {selectedPoll?.pollster} did not report vote splits for{" "}
              {activeDimensionDef.label.toLowerCase()}, so each group falls back
              to the poll's overall result.
            </p>
          ) : null}
          <ul
            className={
              shareComplete
                ? "analyzer__rows analyzer__rows--complete"
                : "analyzer__rows"
            }
          >
            {activeDimensionDef.categories.map((category) => {
              const share = scenario[activeDimension]?.[category.id] ?? 0;
              const split = splits[activeDimension]?.[category.id] ?? {
                d: 50,
                r: 50,
                o: 0,
              };
              return (
                <li key={category.id} className="analyzer__row">
                  <div className="analyzer__row-head">
                    <span>{category.label}</span>
                    <span className="analyzer__pct">
                      {(share * 100).toFixed(0)}% of electorate
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(share * 100)}
                    aria-label={`${category.label} share of electorate`}
                    onChange={(event) =>
                      updateShare(
                        activeDimension,
                        category.id,
                        Number(event.target.value),
                      )
                    }
                  />
                  <div className="analyzer__row-head">
                    <span className="analyzer__splitlabel">
                      D {split.d.toFixed(0)} / R {split.r.toFixed(0)}
                      {split.o > 0.05 ? ` / O ${split.o.toFixed(0)}` : ""}
                    </span>
                    <span className="analyzer__pct">vote split</span>
                  </div>
                  <div className="analyzer__split">
                    <div className="analyzer__split-track" aria-hidden="true">
                      <span
                        className="analyzer__split-seg analyzer__split-seg--d"
                        style={{ width: `${split.d}%` }}
                      />
                      <span
                        className="analyzer__split-seg analyzer__split-seg--r"
                        style={{ width: `${split.r}%` }}
                      />
                      <span
                        className="analyzer__split-seg analyzer__split-seg--o"
                        style={{ width: `${split.o}%` }}
                      />
                    </div>
                    <input
                      type="range"
                      className="analyzer__split-knob"
                      min={0}
                      max={100}
                      value={Math.round(split.d)}
                      aria-label={`${category.label} Democratic vote share`}
                      onChange={(event) =>
                        updateSplit(
                          activeDimension,
                          category.id,
                          Number(event.target.value),
                        )
                      }
                    />
                    <input
                      type="range"
                      className="analyzer__split-knob"
                      min={0}
                      max={100}
                      value={100 - Math.round(split.o)}
                      aria-label={`${category.label} other vote share`}
                      onChange={(event) =>
                        updateOther(
                          activeDimension,
                          category.id,
                          100 - Number(event.target.value),
                        )
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="panel actions">
          <button type="button" onClick={onRandomize}>
            Randomize splits
          </button>
          <button type="button" onClick={resetScenario}>
            Reset shares
          </button>
          {selectedPoll ? (
            <button
              type="button"
              onClick={onResetPoll}
              disabled={!pollDirty}
              title="Restore the sliders to this poll's published crosstabs"
            >
              Reset poll
            </button>
          ) : null}
        </section>
      </aside>
      {showHelp ? <AnalyzerHelp onClose={() => setShowHelp(false)} /> : null}
    </>
  );
}

function AnalyzerHelp({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="analyzer__help"
      role="dialog"
      aria-modal="true"
      aria-label="How the State Analyzer works"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="analyzer__help-card">
        <div className="analyzer__help-head">
          <h2>How the State Analyzer works</h2>
          <button
            type="button"
            className="analyzer__help-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="analyzer__help-body">
          <p>
            The analyzer is not a poll average. It projects a race from two
            inputs: <strong>who is in the electorate</strong> (each group's
            share of voters) and <strong>how each group votes</strong> (its
            Democratic / Republican / Other split). Drag any slider to model a
            different electorate or a different result.
          </p>

          <h3>1. Composition — who votes</h3>
          <ul>
            <li>
              <strong>Statewide races</strong> start from the American Community
              Survey (ACS) 5-year composition for the state: sex, age,
              race/ethnicity and education.
            </li>
            <li>
              <strong>House races</strong> use each district's own ACS
              composition, scaled so that a change to the statewide scenario
              flows through the district proportionally, then renormalized. The
              statewide figure is a voting-age-population-weighted roll-up of
              the districts.
            </li>
            <li>
              <strong>Party ID</strong> has no census field, so it comes from the
              2024 Cooperative Election Study (party ID with leaners counted as
              partisans) modelled against The Downballot's 2024 presidential
              results by district, with redistricted states estimated from the
              2024 vote and state party ID. The whole map is shifted to the 2026
              generic-ballot environment (Silver Bulletin D+7.5).
            </li>
            <li>
              <strong>Loading a poll</strong> replaces the census composition
              with the poll's own "percentage of total electorate" rows.
              Aggregates the poll only reports in total (a single "No B.A." or
              "Non-white") are split across the finer bands in proportion to the
              census.
            </li>
          </ul>

          <h3>2. Partisan splits — how each group votes</h3>
          <p>
            This is the heart of the model. Each category carries a Democratic,
            Republican and Other share that always total 100. There are three
            sources, in priority order:
          </p>
          <ul>
            <li>
              <strong>A loaded poll.</strong> The vote splits are transcribed
              from the poll's published crosstabs. If the poll reports a group it
              did not break out by vote, that group inherits the poll's overall
              result. If the poll's rounded shares fall short of 100, the
              remainder becomes the Other share. If the poll never crossed a
              whole dimension with the vote (for example, education in the
              InsiderAdvantage and YouGov books), every category in that
              dimension falls back to the poll's overall result and the panel
              flags it.
            </li>
            <li>
              <strong>No poll loaded.</strong> The baseline is a national 2024
              exit-poll table (Roper Center / CBS News–Edison) giving each
              demographic group's Democratic and Republican vote, normalized to
              a two-way split. It is then shifted in two steps: by the state's
              2024 presidential lean (the state's Democratic two-party share
              minus the national 49.25%, built from The Downballot's results by
              district and weighted by voting-age population), and by the
              national move into the 2026 environment (+4.5 points to the
              Democrat, the same shift the party-ID model uses). A state that
              voted five points more Democratic than the country therefore
              starts five points more Democratic in every group.
            </li>
            <li>
              <strong>Randomize splits</strong> replaces the splits with
              seeded pseudo-random values between 30 and 70, stable for a given
              seed, as a neutral "what if there were no real signal" baseline.
            </li>
          </ul>
          <p>
            The vote-split slider has two knobs on one track: the left knob sets
            the Democratic share within the two-party portion, and the right knob
            marks where the Republican share ends and Other begins. Democratic
            and Republican therefore always split whatever the Other knob leaves
            behind.
          </p>

          <h3>3. The projection math</h3>
          <ul>
            <li>
              Only the <strong>selected lens</strong> drives the map and the
              statewide number. Each category is weighted by its share of the
              electorate, and the projection is the composition-weighted average
              of the category splits. The dimensions are treated as independent;
              a segment's vote is the mean of its categories' splits.
            </li>
            <li>
              Shares are <strong>independent fixed values</strong>. Moving one
              share never moves another; they are normalized to 100% only when
              the projection is computed. The "Total" indicator shows whether the
              active lens sums to 100.
            </li>
            <li>
              Margins are mapped onto a confidence scale capped at 15 points, and
              a race within 0.05 points is a tossup.
            </li>
          </ul>

          <h3>4. Map, pickups and extrapolation</h3>
          <ul>
            <li>
              <strong>Stripe party flips</strong> marks regions whose projected
              party differs from the current holder: the Senate or governor
              incumbent's party, or the 2026 House seat holder. The wider band is
              the projected shade, the narrower one a lighter tint.
            </li>
            <li>
              A poll fielded for one race can seed another race in the same
              state. The panel labels that an <strong>extrapolation</strong>,
              since no crosstab was published for the active race.
            </li>
            <li>
              Hovering a region shows the active lens's breakdown, and flags a
              House district's Party ID as estimated when it was modelled from
              the 2024 vote rather than measured directly.
            </li>
          </ul>

          <h3>5. Assumptions and caveats</h3>
          <ul>
            <li>
              Demographic dimensions are modelled as <strong>independent</strong>
              — the analyzer does not capture interactions such as young Black
              men or non-college white women as their own groups.
            </li>
            <li>
              Census composition is a <strong>population</strong> share, not a
              turnout or likely-voter model, so it can differ from an actual
              electorate.
            </li>
            <li>
              The no-poll baseline is a <strong>2024 result</strong> (exit poll
              plus 2024 state lean) adjusted by a single national 2026
              environment shift; it is not a 2026 poll and carries no
              state-specific 2026 information.
            </li>
            <li>
              Education is usually a <strong>binary</strong> college /
              non-college split; the three non-college census bands inherit the
              same result.
            </li>
            <li>
              Race groups a poll did not break out inherit its broadest
              non-white column, so <strong>Asian and Other are approximate</strong>
              outside the states that report them.
            </li>
            <li>
              Poll shares are rounded and omit third-party and undecided voters,
              which are folded into <strong>Other</strong>.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

interface ResultSummaryProps {
  result: AnalyzerResult;
  tally: { D: number; R: number; TOSS: number } | null;
  regionCount: number;
}

function ResultSummary({ result, tally, regionCount }: ResultSummaryProps) {
  const winnerLabel =
    result.winner === "D" ? "Democrats" : result.winner === "R" ? "Republicans" : "Tossup";
  return (
    <div className="analyzer__result">
      <div className="analyzer__result-headline">
        <span className="analyzer__result-d">{result.d.toFixed(1)}%</span>
        <span className="analyzer__result-mid">
          <strong>{winnerLabel}</strong>
          <span>{formatMargin(result.margin)}</span>
        </span>
        <span className="analyzer__result-r">{result.r.toFixed(1)}%</span>
      </div>
      <div className="analyzer__result-bar" role="img" aria-label="Vote split">
        <div
          className="analyzer__result-fill analyzer__result-fill--d"
          style={{ width: `${result.d}%` }}
        />
        <div
          className="analyzer__result-fill analyzer__result-fill--r"
          style={{ width: `${result.r}%` }}
        />
        <div
          className="analyzer__result-fill analyzer__result-fill--o"
          style={{ width: `${result.o}%` }}
        />
      </div>
      {result.o > 0.05 ? (
        <div className="analyzer__tally">Other {result.o.toFixed(1)}%</div>
      ) : null}
      {tally ? (
        <div className="analyzer__tally">
          {regionCount} districts · D {tally.D} / R {tally.R}
          {tally.TOSS ? ` / Tossup ${tally.TOSS}` : ""}
        </div>
      ) : null}
    </div>
  );
}
