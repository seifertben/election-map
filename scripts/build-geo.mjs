// Fetch the 2026 election-cycle geography, clip it to the U.S. shoreline,
// and write compact GeoJSON into public/data/.
//
//   node scripts/build-geo.mjs
//
// Sources:
//   - 120th Congressional Districts (2026 boundaries)
//     TIGERweb/Legislative/MapServer/0
//   - States, 2025 cartographic boundary file (1:500,000)
//     https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_us_state_500k.zip
//
// TIGERweb serves legal boundaries, which extend into the Great Lakes and
// offshore waters. The Census cartographic boundary file is clipped to the
// shoreline, so states are used as-is and each district is intersected with
// its state's clipped polygon — that is what keeps water (the Great Lakes,
// Cape Cod Bay, ...) out of the rendered regions.
//
// The output is committed to the repo so production builds never touch the
// network. Re-run this only when the Census publishes updated boundaries.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { geoArea } from "d3-geo";
import polygonClipping from "polygon-clipping";
import shp from "shpjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../public/data");

const TIGERWEB = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb";
const STATES_URL =
  "https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_us_state_500k.zip";

// Generalization tolerance in degrees (~1.1 km at the equator) for the
// TIGERweb district query. Small enough to keep every district recognizable,
// large enough to keep the payload tiny.
const MAX_OFFSET = 0.01;
// Coordinates are rounded to 4 decimals (~11 m), well below on-screen pixel size.
const DECIMALS = 4;
// Slivers smaller than ~1 km² (a byproduct of clipping generalized district
// lines against the detailed shoreline) are dropped.
const MIN_AREA_SR = 2.5e-8;

// 50 states + DC, matching src/data/states.ts.
const KEPT_FIPS = new Set([
  "01", "02", "04", "05", "06", "08", "09", "10", "11", "12", "13",
  "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25",
  "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36",
  "37", "38", "39", "40", "41", "42", "44", "45", "46", "47", "48",
  "49", "50", "51", "53", "54", "55", "56",
]);

async function query(path, fields) {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: fields,
    returnGeometry: "true",
    outSR: "4326",
    maxAllowableOffset: String(MAX_OFFSET),
    f: "geojson",
  });
  const url = `${TIGERWEB}/${path}/query?${params.toString()}`;
  process.stdout.write(`Fetching ${path} ... `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const json = await res.json();
  if (json.error) throw new Error(JSON.stringify(json.error));
  console.log(`${json.features.length} features`);
  return json;
}

async function fetchStates() {
  process.stdout.write("Fetching cb_2025_us_state_500k.zip ... ");
  const res = await fetch(STATES_URL);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${STATES_URL}`);
  const out = await shp(await res.arrayBuffer());
  const fc = Array.isArray(out) ? out[0] : out;
  console.log(`${fc.features.length} features`);
  return fc;
}

function roundCoords(coords) {
  if (typeof coords[0] === "number") {
    return [
      Number(coords[0].toFixed(DECIMALS)),
      Number(coords[1].toFixed(DECIMALS)),
    ];
  }
  return coords.map(roundCoords);
}

// Planar signed ring area (shoelace); only the sign matters, for winding.
function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return sum / 2;
}

// polygon-clipping expects GeoJSON winding (CCW exterior, CW holes); Census
// shapefiles use the opposite convention, so normalize before clipping.
function rewind(polys) {
  return polys.map((rings) =>
    rings.map((ring, i) => {
      const isCcw = ringArea(ring) > 0;
      return i === 0 === isCcw ? ring : ring.slice().reverse();
    }),
  );
}

function toMultiPolygon(geometry) {
  return geometry.type === "Polygon"
    ? [geometry.coordinates]
    : geometry.coordinates;
}

// ArcGIS serves RFC 7946 GeoJSON (counterclockwise exterior rings), but
// d3-geo expects the opposite spherical winding; with RFC 7946 winding it
// renders each region's complement — a full-viewport rectangle with the
// region cut out as a hole. A correctly wound region covers less than a
// hemisphere, so flip the rings of anything larger.
function ensureD3Winding(feature) {
  if (geoArea(feature) <= 2 * Math.PI) return feature;
  const g = feature.geometry;
  const reverseRings = (rings) => rings.map((ring) => ring.slice().reverse());
  const geometry =
    g.type === "Polygon"
      ? { ...g, coordinates: reverseRings(g.coordinates) }
      : g.type === "MultiPolygon"
        ? { ...g, coordinates: g.coordinates.map(reverseRings) }
        : g;
  return { ...feature, geometry };
}

function compact(feature, properties) {
  return ensureD3Winding({
    type: "Feature",
    id: properties.geoid ?? properties.fips,
    properties,
    geometry: {
      type: feature.geometry.type,
      coordinates: roundCoords(feature.geometry.coordinates),
    },
  });
}

// Spherical area of one polygon, winding-agnostic.
function polygonArea(rings) {
  let area = geoArea({ type: "Polygon", coordinates: rings });
  if (area > 2 * Math.PI) area = 4 * Math.PI - area;
  return area;
}

// Remove the water portion of a district by intersecting it with its state's
// shoreline-clipped polygon.
function clipToShore(geometry, statePolys) {
  const clipped = polygonClipping.intersection(
    rewind(toMultiPolygon(geometry)),
    statePolys,
  );
  if (clipped.length === 0) {
    throw new Error("district clipped away entirely");
  }
  const kept = clipped.filter((rings) => polygonArea(rings) >= MIN_AREA_SR);
  if (kept.length === 0) kept.push(clipped[0]);
  return { type: "MultiPolygon", coordinates: kept };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const statesFc = await fetchStates();
  const keptStates = statesFc.features.filter((f) =>
    KEPT_FIPS.has(f.properties.STATEFP),
  );

  const stateFeatures = keptStates.map((f) =>
    compact(f, {
      fips: f.properties.STATEFP,
      abbr: f.properties.STUSPS,
      name: f.properties.NAME,
    }),
  );

  // Full-precision shoreline polygons, used to clip the districts.
  const shoreByFips = new Map(
    keptStates.map((f) => [
      f.properties.STATEFP,
      rewind(toMultiPolygon(f.geometry)),
    ]),
  );

  const districts = await query(
    "Legislative/MapServer/0",
    "GEOID,STATE,CD120,NAME",
  );
  const cdFeatures = districts.features
    .filter(
      (f) =>
        KEPT_FIPS.has(f.properties.STATE) &&
        // DC is a non-voting delegate, not part of the 435.
        f.properties.STATE !== "11" &&
        // "ZZ" covers unassigned water areas that belong to no district.
        f.properties.CD120 !== "ZZ",
    )
    .map((f) => {
      const geometry = clipToShore(
        f.geometry,
        shoreByFips.get(f.properties.STATE),
      );
      return compact(
        { ...f, geometry },
        {
          geoid: f.properties.GEOID,
          state: f.properties.STATE,
          district: f.properties.CD120,
          name: f.properties.NAME,
        },
      );
    });

  const cdCollection = { type: "FeatureCollection", features: cdFeatures };
  const stateCollection = { type: "FeatureCollection", features: stateFeatures };

  await writeFile(
    resolve(OUT_DIR, "cd120.json"),
    JSON.stringify(cdCollection),
  );
  await writeFile(
    resolve(OUT_DIR, "states.json"),
    JSON.stringify(stateCollection),
  );

  console.log(`\ncd120.json   : ${cdFeatures.length} districts`);
  console.log(`states.json  : ${stateFeatures.length} states + DC`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
