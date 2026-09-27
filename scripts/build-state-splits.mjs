// Estimate each state's demographic vote splits for the State Analyzer's
// no-poll baseline by ecological regression on real votes.
//
//   node scripts/build-state-splits.mjs
//
// Why. The no-poll baseline used to take the national 2024 exit-poll split for
// every group and shift *all of them by the same scalar* (the state's
// presidential lean plus the national environment). That reproduces the state
// top-line exactly but assumes every group in the state deviates from its
// national result by the same amount. This script replaces that one-parameter
// shift with a per-state, per-group estimate fit from how the state's districts
// actually voted, so the within-state spread across groups is no longer just the
// national one translated.
//
// Sources (all committed):
//   scripts/party/pres_by_cd.csv       The Downballot's 2024 presidential
//       two-party result for every district on the 2026 (120th Congress) lines.
//   public/data/demographics.json      Each district's ACS voting-age
//       composition (sex, age, race/ethnicity, education).
//
// Model. For each state and each demographic dimension, the district Democratic
// two-party share y_d is regressed on the district's category shares c_dg:
//
//   y_d = sum_g beta_g * c_dg + e_d
//
// where beta_g is group g's estimated Democratic share in that state. Because
// the shares in a dimension sum to one there is no intercept, but the slopes are
// usually collinear and many states have few districts, so the fit is ridge
// regularized toward the national exit-poll group splits b_g:
//
//   minimize  sum_d w_d (y_d - sum_g beta_g c_dg)^2
//             + lambda sum_g (beta_g - b_g)^2
//
// lambda is expressed as PRIOR_DISTRICTS worth of pseudo-observations — one
// identity row per category, target b_g — so a state with many districts is
// data-driven while a state with one or two is pinned near the national
// baseline. This is partial pooling: borrowing the national pattern only where
// the state's own votes cannot identify a group.
//
// Calibration. After fitting, every group is shifted by a constant so the
// VAP-weighted mean of the fitted state result equals the state's actual 2024
// two-party share. The state top-line is very well measured; the fit only
// reallocates *within* the state, and this pins the level to real votes. The
// 2026 environment shift is applied later by the app, exactly as before.
//
// Caveat. The composition is a voting-age *population* share while the exit-poll
// prior is among *voters*, so the regression absorbs some turnout difference
// into the group estimate. It is still strictly more state-specific than the
// uniform shift it replaces.
//
// The party dimension is not fit here: the map has no independent measure of how
// party-identified groups voted, and the national party-vote split is stable, so
// it keeps the shifted-national baseline.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRES_PATH = resolve(__dirname, "party/pres_by_cd.csv");
const DEMO_PATH = resolve(__dirname, "../public/data/demographics.json");
const OUT_PATH = resolve(__dirname, "../src/data/stateSplits.ts");

/**
 * Ridge prior strength, in units of average districts. The prior contributes
 * PRIOR_DISTRICTS identity pseudo-rows per dimension; a state with fewer usable
 * districts than this leans on the national exit-poll pattern, a state with many
 * is driven by its own votes.
 */
const PRIOR_DISTRICTS = 3;

/** National 2024 two-party presidential Democratic share (mirrors the other
 * scripts). Used only to report the fit, not to shift the results. */
const PRES_2024_NATIONAL_D = 0.4925;

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

/**
 * The dimensions the fit covers, the category order, and the national 2024
 * exit-poll Democratic two-party shares (fractions) used as the ridge prior.
 * Mirrors src/data/nationalDemographics.ts.
 */
const DIMENSIONS = {
  sex: {
    categories: ["male", "female"],
    prior: { male: 43 / 98, female: 53 / 98 },
  },
  age: {
    categories: ["18-29", "30-44", "45-64", "65+"],
    prior: {
      "18-29": 54 / 97,
      "30-44": 51 / 98,
      "45-64": 44 / 98,
      "65+": 49 / 99,
    },
  },
  race: {
    categories: ["white", "black", "hispanic", "asian", "other"],
    prior: {
      white: 42 / 99,
      black: 86 / 99,
      hispanic: 51 / 97,
      asian: 55 / 95,
      other: 41 / 96,
    },
  },
  education: {
    categories: ["no-hs", "hs", "some-college", "bachelors-plus"],
    prior: {
      "no-hs": 43 / 99,
      hs: 43 / 99,
      "some-college": 43 / 99,
      "bachelors-plus": 56 / 98,
    },
  },
};

const ROUND = 10000;
const pad2 = (n) => String(n).padStart(2, "0");
const round = (x) => Math.round(x * ROUND) / ROUND;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/**
 * The Downballot table, keyed to the app's district geoid: the 2024 Democratic
 * two-party presidential share.
 */
function readPres(text) {
  const pres = {};
  const lines = text.split(/\r?\n/);
  const header = lines.findIndex((l) => l.startsWith("District,"));
  for (const line of lines.slice(header + 2)) {
    const parts = line.split(",");
    if (parts.length < 5) continue;
    const [code, , , h24, t24] = parts;
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
    const v = share(h24, t24);
    if (v !== undefined) pres[`${fips}${pad2(dist)}`] = v;
  }
  return pres;
}

/**
 * Ridge solve for one state/dimension:
 *   (C^T W C + lambda I) beta = C^T W y + lambda b
 * with `rows` the district composition vectors, `y` and `w` the district targets
 * and weights, `prior` the national category shares, and `lambda` the prior
 * strength. Gauss-Jordan with partial pivoting; the matrices are tiny (<=5).
 */
function ridgeSolve(rows, y, w, prior, lambda) {
  const k = prior.length;
  const A = Array.from({ length: k }, () => new Array(k).fill(0));
  const rhs = new Array(k).fill(0);
  for (let r = 0; r < rows.length; r += 1) {
    for (let i = 0; i < k; i += 1) {
      rhs[i] += w[r] * rows[r][i] * y[r];
      for (let j = 0; j < k; j += 1) A[i][j] += w[r] * rows[r][i] * rows[r][j];
    }
  }
  for (let i = 0; i < k; i += 1) {
    A[i][i] += lambda;
    rhs[i] += lambda * prior[i];
  }
  const M = A.map((row, i) => [...row, rhs[i]]);
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

async function main() {
  const pres = readPres(await readFile(PRES_PATH, "utf8"));
  const demo = JSON.parse(await readFile(DEMO_PATH, "utf8"));

  // Every map district carrying a 2024 vote and a composition, grouped by state.
  const byState = {};
  for (const [geoid, comp] of Object.entries(demo.districts)) {
    const vote = pres[geoid];
    if (vote === undefined) continue;
    const fips = geoid.slice(0, 2);
    (byState[fips] ??= []).push({
      geoid,
      vote,
      vap: comp.votingAgePopulation ?? 1,
      comp,
    });
  }

  const result = {};
  let minGroups = Infinity;
  let maxGroups = 0;

  for (const [fips, districts] of Object.entries(byState)) {
    const meanVap =
      districts.reduce((s, d) => s + d.vap, 0) / districts.length || 1;
    const stateVote =
      districts.reduce((s, d) => s + d.vap * d.vote, 0) /
      districts.reduce((s, d) => s + d.vap, 0);
    result[fips] = {};

    for (const [dim, spec] of Object.entries(DIMENSIONS)) {
      const cats = spec.categories;
      // Normalized category shares per district, renormalized so a composition
      // that doesn't sum exactly to 1 still behaves.
      const rows = districts.map((d) => {
        const shares = cats.map((c) => d.comp[dim]?.[c] ?? 0);
        const total = shares.reduce((s, x) => s + x, 0);
        return total > 0 ? shares.map((x) => x / total) : shares.map(() => 1 / cats.length);
      });
      const y = districts.map((d) => d.vote);
      const w = districts.map((d) => d.vap / meanVap);
      const prior = cats.map((c) => spec.prior[c]);

      const beta = ridgeSolve(rows, y, w, prior, PRIOR_DISTRICTS);

      // Recenter so the VAP-weighted state mean matches the actual 2024 vote.
      const meanComp = cats.map((_, g) => {
        let num = 0;
        let den = 0;
        for (let d = 0; d < districts.length; d += 1) {
          num += districts[d].vap * rows[d][g];
          den += districts[d].vap;
        }
        return den > 0 ? num / den : 1 / cats.length;
      });
      const fitted =
        meanComp.reduce((s, c, g) => s + c * beta[g], 0) +
        0; // shares already sum to 1
      const shift = stateVote - fitted;
      const split = {};
      for (let g = 0; g < cats.length; g += 1) {
        split[cats[g]] = round(clamp(beta[g] + shift, 0.02, 0.98));
      }
      result[fips][dim] = split;
    }

    minGroups = Math.min(minGroups, districts.length);
    maxGroups = Math.max(maxGroups, districts.length);
  }

  const fipsList = Object.keys(result).sort((a, b) => a.localeCompare(b));
  const body = fipsList
    .map((fips) => {
      const dims = Object.entries(result[fips])
        .map(([dim, split]) => {
          const pairs = Object.entries(split)
            .map(([cat, value]) => `"${cat}": ${value}`)
            .join(", ");
          return `      ${dim}: { ${pairs} },`;
        })
        .join("\n");
      return `  "${fips}": {\n${dims}\n  },`;
    })
    .join("\n");

  const out = `/**
 * Per-state demographic vote splits for the State Analyzer's no-poll baseline,
 * as the Democratic two-party share of each group (0..1). Generated by
 * scripts/build-state-splits.mjs (npm run build:state-splits) by ridge
 * ecological regression of each state's district-level 2024 presidential
 * results (scripts/party/pres_by_cd.csv) on its ACS district composition
 * (public/data/demographics.json), partially pooled toward the national 2024
 * exit-poll group splits and recentered so the VAP-weighted state result
 * matches the state's actual 2024 vote. Party ID is absent by design; it keeps
 * the shifted national baseline. Each value is a 2024 result; the app applies
 * the 2026 environment shift.
 */
export const STATE_SPLITS: Record<
  string,
  Record<string, Record<string, number>>
> = {
${body}
};
`;
  await writeFile(OUT_PATH, out);
  console.log(
    `wrote splits for ${fipsList.length} states ` +
      `(${minGroups}-${maxGroups} districts/state, prior ${PRIOR_DISTRICTS}) ` +
      `to ${OUT_PATH} (national two-party D ${PRES_2024_NATIONAL_D})`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
