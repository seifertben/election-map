// Add a per-geography party composition (Democrat / Republican / Independent)
// to public/data/demographics.json.
//
//   node scripts/build-party.mjs
//
// The census has no party field, so this models party identification from two
// committed sources:
//
//   scripts/party/ces2024_party.json  Cooperative Election Study (CES) Common
//       Content 2024 (doi:10.7910/DVN/X11EP6): the weighted share of likely
//       voters identifying or leaning Democratic / Republican / Independent /
//       Other per state and per congressional district (cdid119), with sample
//       sizes. See scripts/party/aggregate-ces.py for the aggregation.
//   scripts/party/pres_by_cd.csv      The Downballot's 2024 and 2020 presidential
//       results for every district on the 2026 (120th Congress) lines.
//
// Model. Each district is summarized by two numbers: the partisan gap
// g = (D - R) / (D + R) and the nonpartisan share i = Independent + Other. Both
// are modelled in a state-anchored hierarchy, because party ID varies far more
// across states than within them and the state CES estimates are well measured
// while district samples are small:
//
//   prior:  g_d = a + b * (v_d - vbar_state) + c * stateGap
//           i_d = e + f * (v_d - vbar_state) + h * stateInd
//
// where v_d is the district's Democratic two-party presidential share, averaged
// over 2024 and 2020 when both exist (both are on the 120th-Congress lines for
// the states that did not redistrict), and vbar_state is the voting-age-
// population-weighted state mean. The coefficients are fit by sample-weighted
// least squares on the districts where the CES geography is trustworthy.
//
// Observation. The CES district measurement of g is combined with the prior by
// empirical-Bayes partial pooling. Its sampling variance is the multinomial
// variance of the gap (4 p (1-p) / n, inflated by a survey design effect); the
// prior variance tau^2 is the part of the observed residual variance the sample
// sizes do not explain. The posterior keeps more of the direct CES measurement
// where n is large and leans on the model where it is small.
//
// Redistricting. CES codes districts on the 119th-Congress lines while the
// committed map is the 120th. The ten mid-decade-redistricted states redrew
// their lines for 2026, so their CES district assignments describe the wrong
// geography and are dropped (the estimate comes entirely from the model). These
// are exactly the states whose 2020 presidential result The Downballot cannot
// publish on the new lines.
//
// Calibration. After pooling, each state's districts are recentered so their
// voting-age-population-weighted mean matches the well-measured state CES
// estimate. This keeps the within-state spread from the model while pinning the
// level to real state data.
//
// Environment. The CES observation is 2024; the map is a 2026 projection. Every
// district's gap is shifted by the national move from the 2024 presidential
// result to the 2026 generic congressional ballot, damped by PARTY_ID_RESPONSE
// (party ID is stickier than vote). The state calibration target is shifted by
// the same amount.
//
// Each district the model had to estimate rather than measure directly (a
// redistricted state, a missing CES sample, or a sample too small to carry half
// the posterior) is tagged `partyEstimated` so the UI can flag its breakdown.
// Re-run this after scripts/fetch-demographics.mjs, which rewrites the file
// without party.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMO_PATH = resolve(__dirname, "../public/data/demographics.json");
const CES_PATH = resolve(__dirname, "party/ces2024_party.json");
const PRES_PATH = resolve(__dirname, "party/pres_by_cd.csv");

/**
 * Survey design effect inflating the multinomial sampling variance of the CES
 * district shares (weighting, clustering). 1.5 is a conventional mid-range
 * value for a national online panel.
 */
const DESIGN_EFFECT = 1.5;
/**
 * Floors on the estimated prior variance (SD ~0.09 for the gap) so a lucky fit
 * cannot make the model overconfident and erase the direct CES signal.
 */
const GAP_PRIOR_FLOOR = 0.008;
const IND_PRIOR_FLOOR = 0.0015;
/**
 * How much of the national vote-environment swing passes through to the party
 * ID gap. 1 means party ID tracks the generic-ballot move one-for-one; below 1
 * means identification is stickier.
 */
const PARTY_ID_RESPONSE = 1;
/**
 * National 2024 two-party presidential Democratic share: Harris 75,017,613 of
 * the 152,320,193 two-party votes.
 */
const PRES_2024_NATIONAL_D = 0.4925;
/**
 * Silver Bulletin's 2026 generic congressional ballot average, D+7.5 as of
 * 2026-09-21, i.e. a 53.75% Democratic two-party share.
 */
const GENERIC_2026_D = 0.5375;
/** National 2024-to-2026 gap shift applied to every district. */
const ENV_SHIFT =
  (GENERIC_2026_D - PRES_2024_NATIONAL_D) * PARTY_ID_RESPONSE;

/**
 * The ten states whose congressional maps were redrawn mid-decade for 2026.
 * CES reports their districts on the 119th-Congress lines, so those district
 * assignments are not usable; the model stands in. They are also the states
 * whose 2020 presidential result The Downballot does not publish on the new
 * lines, which is a useful cross-check.
 */
const REDISTRICTED_STATES = new Set([
  "01", // Alabama
  "06", // California
  "12", // Florida
  "22", // Louisiana
  "29", // Missouri
  "37", // North Carolina
  "39", // Ohio
  "47", // Tennessee
  "48", // Texas
  "49", // Utah
]);

const ABBR_TO_FIPS = {
  AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09",
  DE: "10", DC: "11", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17",
  IN: "18", IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24",
  MA: "25", MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31",
  NV: "32", NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38",
  OH: "39", OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46",
  TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54",
  WI: "55", WY: "56",
};

const ROUND = 10000;

const pad2 = (n) => String(n).padStart(2, "0");
const round = (x) => Math.round(x * ROUND) / ROUND;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/** The partisan D-minus-R identification gap from a CES share set. */
function gapOf(p) {
  const dr = p.d + p.r;
  return dr > 0 ? (p.d - p.r) / dr : 0;
}

/**
 * The Downballot table, keyed to the app's district geoid, carrying the 2024 and
 * (when line-comparable) 2020 Democratic two-party presidential shares.
 */
function readPres(text) {
  const pres = {};
  const lines = text.split(/\r?\n/);
  const header = lines.findIndex((l) => l.startsWith("District,"));
  for (const line of lines.slice(header + 2)) {
    const parts = line.split(",");
    if (parts.length < 9) continue;
    const [code, , , h24, t24, , h20, t20] = parts;
    const m = /^([A-Z]{2})-(AL|\d{2})$/.exec(code);
    if (!m) continue;
    const fips = ABBR_TO_FIPS[m[1]];
    if (!fips) continue;
    const dist = m[2] === "AL" ? 0 : Number(m[2]);
    const share = (h, t) => {
      const a = Number(h);
      const b = Number(t);
      return a + b > 0 ? a / (a + b) : undefined;
    };
    pres[`${fips}${pad2(dist)}`] = { v24: share(h24, t24), v20: share(h20, t20) };
  }
  return pres;
}

/** Solve a (small, symmetric) weighted least-squares system. */
function wls(rows, y, w) {
  const k = rows[0].length;
  const A = Array.from({ length: k }, () => new Array(k).fill(0));
  const b = new Array(k).fill(0);
  for (let r = 0; r < rows.length; r += 1) {
    for (let i = 0; i < k; i += 1) {
      b[i] += w[r] * rows[r][i] * y[r];
      for (let j = 0; j < k; j += 1) A[i][j] += w[r] * rows[r][i] * rows[r][j];
    }
  }
  for (let i = 0; i < k; i += 1) A[i][i] += 1e-12;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < k; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < k; r += 1) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const p = M[col][col];
    for (let j = col; j <= k; j += 1) M[col][j] /= p;
    for (let r = 0; r < k; r += 1) {
      if (r === col) continue;
      const factor = M[r][col];
      for (let j = col; j <= k; j += 1) M[r][j] -= factor * M[col][j];
    }
  }
  return M.map((row) => row[k]);
}

const apply = (coef, x) => x.reduce((s, xi, i) => s + coef[i] * xi, 0);

/** VAP-weighted mean of `key` over a state's districts. */
function weightedMean(districts, key) {
  let num = 0;
  let den = 0;
  for (const d of districts) {
    num += d.vap * d[key];
    den += d.vap;
  }
  return den > 0 ? num / den : 0;
}

async function main() {
  const ces = JSON.parse(await readFile(CES_PATH, "utf8"));
  const pres = readPres(await readFile(PRES_PATH, "utf8"));
  const demo = JSON.parse(await readFile(DEMO_PATH, "utf8"));

  // At-large states appear as the "01" district in CES but as "00" in the map.
  const atLarge = new Set(
    Object.keys(demo.districts)
      .filter((g) => g.slice(2) === "00")
      .map((g) => g.slice(0, 2)),
  );
  const cesByGeoid = {};
  for (const [key, p] of Object.entries(ces.districts)) {
    const [fips, dd] = key.split("-");
    const geoid =
      atLarge.has(fips) && dd === "01" ? `${fips}00` : `${fips}${dd}`;
    cesByGeoid[geoid] = p;
  }

  // Assemble every map district with its CES observation and vote anchor.
  const districts = [];
  for (const geoid of Object.keys(demo.districts)) {
    const fips = geoid.slice(0, 2);
    const c = cesByGeoid[geoid];
    const state = ces.states[fips];
    const p = pres[geoid] ?? {};
    const redistricted = REDISTRICTED_STATES.has(fips);
    const v =
      p.v24 !== undefined && p.v20 !== undefined
        ? (p.v24 + p.v20) / 2
        : p.v24;
    districts.push({
      geoid,
      fips,
      vap: demo.districts[geoid].votingAgePopulation,
      redistricted,
      // A CES district measurement is usable only where the lines line up.
      hasCes: Boolean(c) && !redistricted,
      n: c?.n ?? 0,
      y: c ? gapOf(c) : null,
      ind: c ? c.i + (c.o ?? 0) : null,
      stateGap: state ? gapOf(state) : 0,
      stateInd: state ? state.i + (state.o ?? 0) : 0,
      v,
    });
  }

  const byState = {};
  for (const d of districts) (byState[d.fips] ??= []).push(d);
  const meanV = {};
  for (const [fips, ds] of Object.entries(byState)) {
    meanV[fips] = weightedMean(
      ds.filter((d) => d.v !== undefined),
      "v",
    );
  }

  const dev = (d) => (d.v ?? meanV[d.fips]) - meanV[d.fips];
  const clean = districts.filter((d) => d.hasCes && d.y !== null);

  const gapCoef = wls(
    clean.map((d) => [1, dev(d), d.stateGap]),
    clean.map((d) => d.y),
    clean.map((d) => Math.max(1, d.n)),
  );
  const indCoef = wls(
    clean.map((d) => [1, dev(d), d.stateInd]),
    clean.map((d) => d.ind),
    clean.map((d) => Math.max(1, d.n)),
  );

  // Split the observed residual variance into prior variance (tau^2) and the
  // sampling variance the sample sizes explain.
  const gapResid = clean.map((d) => d.y - apply(gapCoef, [1, dev(d), d.stateGap]));
  const indResid = clean.map((d) => d.ind - apply(indCoef, [1, dev(d), d.stateInd]));
  const meanSq = (xs) => xs.reduce((s, x) => s + x * x, 0) / xs.length;
  const meanNoiseGap =
    (DESIGN_EFFECT *
      clean.reduce((s, d) => {
        const p = (d.y + 1) / 2;
        return s + (4 * p * (1 - p)) / d.n;
      }, 0)) /
    clean.length;
  const meanNoiseInd =
    (DESIGN_EFFECT *
      clean.reduce((s, d) => s + (d.ind * (1 - d.ind)) / d.n, 0)) /
    clean.length;
  const tau2Gap = Math.max(GAP_PRIOR_FLOOR, meanSq(gapResid) - meanNoiseGap);
  const tau2Ind = Math.max(IND_PRIOR_FLOOR, meanSq(indResid) - meanNoiseInd);

  // Empirical-Bayes posterior per district.
  for (const d of districts) {
    const muGap = apply(gapCoef, [1, dev(d), d.stateGap]);
    const muInd = apply(indCoef, [1, dev(d), d.stateInd]);
    if (!d.hasCes || d.y === null) {
      d.gap = muGap;
      d.indPost = muInd;
      d.gapWeight = 0;
      d.indWeight = 0;
      continue;
    }
    const p = (d.y + 1) / 2;
    const gapWeight = tau2Gap / (tau2Gap + (DESIGN_EFFECT * 4 * p * (1 - p)) / d.n);
    const indWeight = tau2Ind / (tau2Ind + (DESIGN_EFFECT * d.ind * (1 - d.ind)) / d.n);
    d.gap = muGap + gapWeight * (d.y - muGap);
    d.indPost = muInd + indWeight * (d.ind - muInd);
    d.gapWeight = gapWeight;
    d.indWeight = indWeight;
  }

  // Recenter each state onto the well-measured state CES estimate (shifted to
  // the 2026 environment), preserving the model's within-state spread.
  for (const ds of Object.values(byState)) {
    const gapShift =
      ds[0].stateGap + ENV_SHIFT - weightedMean(ds, "gap");
    const indShift = ds[0].stateInd - weightedMean(ds, "indPost");
    for (const d of ds) {
      d.gap = clamp(d.gap + gapShift, -0.95, 0.95);
      d.indPost = clamp(d.indPost + indShift, 0.02, 0.6);
    }
  }

  const byGeoid = new Map(districts.map((d) => [d.geoid, d]));
  let estimated = 0;
  for (const [geoid, comp] of Object.entries(demo.districts)) {
    const d = byGeoid.get(geoid);
    if (!d) continue;
    const partisan = 1 - d.indPost;
    comp.party = {
      democrat: round((partisan * (1 + d.gap)) / 2),
      republican: round((partisan * (1 - d.gap)) / 2),
      independent: round(d.indPost),
    };
    const needsModel =
      d.redistricted || !d.hasCes || d.gapWeight < 0.5 || d.indWeight < 0.5;
    if (needsModel) {
      comp.partyEstimated = true;
      estimated += 1;
    } else {
      delete comp.partyEstimated;
    }
  }

  demo.partySource =
    "Party ID: Cooperative Election Study 2024 (Dem/Rep incl. leaners), " +
    "state-anchored hierarchical model with within-state presidential lean, " +
    "empirical-Bayes pooling of district samples, and calibration to the state " +
    "CES estimate; redistricted states estimated from the 2024 presidential " +
    "vote and state party ID";
  await writeFile(DEMO_PATH, `${JSON.stringify(demo)}\n`);

  console.log(
    `gap fit:  ${gapCoef[0].toFixed(3)} + ${gapCoef[1].toFixed(3)} * lean + ` +
      `${gapCoef[2].toFixed(3)} * stateGap  (tau=${Math.sqrt(tau2Gap).toFixed(3)})`,
  );
  console.log(
    `ind fit:  ${indCoef[0].toFixed(3)} + ${indCoef[1].toFixed(3)} * lean + ` +
      `${indCoef[2].toFixed(3)} * stateInd  (tau=${Math.sqrt(tau2Ind).toFixed(3)})`,
  );
  console.log(
    `wrote party to ${Object.keys(demo.states).length} states and ` +
      `${districts.length} districts; ${estimated} flagged as estimated`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
