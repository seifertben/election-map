import { geoAlbersUsa, geoPath } from "d3-geo";
import type { GeoPath, GeoProjection } from "d3-geo";
import type { RegionFeature } from "../types";

export const MAP_WIDTH = 975;
export const MAP_HEIGHT = 610;

export interface MapProjection {
  path: GeoPath;
  projection: GeoProjection;
}

/**
 * Build an Albers USA projection (with Alaska/Hawaii insets) fitted to the
 * supplied features. Each map (states, districts) gets its own projection so
 * the geometry fills the viewport.
 */
export function createMapProjection(features: RegionFeature[]): MapProjection {
  const projection = geoAlbersUsa();
  const collection = {
    type: "FeatureCollection",
    features,
  } as unknown as Parameters<GeoProjection["fitSize"]>[1];
  projection.fitSize([MAP_WIDTH, MAP_HEIGHT], collection);
  return { path: geoPath(projection), projection };
}

/**
 * Projected SVG path strings per feature array, cached by array identity.
 * Projecting ~270k coordinates is expensive and RegionMap remounts on every
 * mode switch, so the cache lives at module level: switching back to a map
 * that was already shown (or between President/Senate, which share the same
 * state geometry) costs nothing. WeakMap keys are the stable feature arrays
 * held in App state, so nothing leaks.
 */
const pathStringCache = new WeakMap<RegionFeature[], string[]>();

export function projectFeatures(features: RegionFeature[]): string[] {
  let ds = pathStringCache.get(features);
  if (!ds) {
    const { path } = createMapProjection(features);
    ds = features.map((feature) => path(feature as never) ?? "");
    pathStringCache.set(features, ds);
  }
  return ds;
}
