# USA Election Map Builder

Build and share your own election maps for the **President**, **Senate**, and
**House**. Click a state or district to change its color, watch the live
scoreboard, then share the result with a link or export it as a PNG.

## Features

- **President** — all 50 states + DC, weighted by electoral votes (270 to win).
- **Senate** — the 35 seats contested in 2026 (all 33 Class 2 seats plus the
  Florida and Ohio special elections); everything else is grey.
- **House** — the 435 voting districts using the Census Bureau's **120th
  Congressional District** boundaries, i.e. the 2026 election cycle lines
  (including the ten states that redrew mid-decade).
- The Senate and House maps load the **Cook Political Report** 2026 race
  ratings by default, drawn as Solid / Likely / Lean shades of blue and red
  (plus Toss Up). Hover a region to see its rating.
- A **Ratings dropdown** in the sidebar swaps the 2026 Senate/House ratings
  between six outlets: Cook Political Report, Inside Elections, Sabato's
  Crystal Ball, Split Ticket, Decision Desk HQ, and Fox News Power Rankings.
  Each entry shows the outlet's publish date, links to its ratings page, and
  loading another source is undoable. Editing a map afterwards marks it
  **custom** with an option to re-apply the source's ratings.
- **Stripe party pickups**: when a seat's projected party differs from the
  party currently holding it, the district is filled with a diagonal stripe
  pattern — a D pickup is drawn in two blues, an R pickup in two reds —
  instead of mixing the holder's color in. Toggle it in the Ratings panel; it
  works for any source, for the flat party colors you paint, and the tooltip
  calls out the pickup direction.
- Click **Cycle** to step a region through Democrat → Republican → Tossup →
  clear, or pick a party to paint directly. Clicking always paints a flat
  party color; the lean/likely/solid tones only come from the sourced ratings.
- Every map is zoomable and draggable: scroll to zoom, drag to pan,
  double-click to zoom in (shift to zoom out), pinch on touch, or use the
  on-map +/−/Reset controls.
- Live totals bar for the active map.
- Undo, per-map reset, reset-all.
- Copy a shareable link (the whole map is encoded in the URL hash).
- Export the current map as a PNG.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run build      # type-check + production bundle into dist/
npm run preview    # serve the production build
npm test           # vitest (codec, reducer, ratings data, scoreboard, geography)
npm run build:geo  # regenerate public/data from Census geography sources
```

## Architecture

```
scripts/build-geo.mjs   fetch + generalize Census geography -> public/data/
public/data/            committed states.json + cd120.json
src/data/               parties, states + electoral votes, 2026 Senate races
src/data/ratings/       per-outlet 2026 House + Senate race ratings
src/data/ratingsSources.ts  ratings-source registry consumed by the UI
src/data/house2026Holder.ts incumbent party per district (drives pickup stripes)
src/state/              reducer (assignments/history) + URL-hash codec
src/lib/                projection, scoreboard math, PNG export
src/components/         RegionMap, ModeTabs, PartyPalette, Scoreboard, RatingsPanel
```

- Rendering uses `d3-geo`'s `geoAlbersUsa` projection (with Alaska/Hawaii
  insets) and a plain SVG per region — no map tile server, no runtime API.
- `RegionMap` memoizes its path list so hovering a 435-district map does not
  re-render every path, and event handling is delegated through `data-*`
  attributes.
- State is a single `useReducer` store. Each edit pushes a snapshot onto a
  bounded history stack for undo.
- The URL hash uses a fixed-width, one-character-per-region encoding
  (`0`=none, `1`=D, `2`=R, `3`=tossup) over a stable region order, so links
  stay short and are validated against the current data length on load.

## Geography

Boundaries are built from Census Bureau sources and committed to
`public/data/` so builds are hermetic:

- `TIGERweb/Legislative/MapServer/0` — 120th Congressional Districts (2026).
- `cb_2025_us_state_500k` — 2025 cartographic boundary file (1:500,000).

TIGERweb serves legal boundaries, which extend into the Great Lakes and
offshore waters. The cartographic boundary file is clipped to the U.S.
shoreline, so `npm run build:geo` uses it for the states and intersects each
district with its state's clipped polygon — keeping water (the Great Lakes,
Cape Cod Bay, ...) out of every region. Districts are generalized with
`maxAllowableOffset` (~1.1 km) and all coordinates are rounded to 4 decimals.
Re-run it when the Census publishes updated boundaries.

## Notes & limitations

- The presidential map is state-level winner-take-all; the Maine and Nebraska
  congressional-district splits are not broken out.
- DC is included for the presidency but is a non-voting delegate, so it is not
  part of the 435-district House map.
- House districts for at-large states render as a single region.
- A "pickup" is a district whose projected party differs from its incumbent
  party (`src/data/house2026Holder.ts`, and the Senate race list's
  `incumbentParty`). Toss Ups, independent-held seats, and the eight new 2026
  seats with no incumbent are never striped.
- The non-Cook ratings are compiled from the Wikipedia «2026 United States
  Senate elections» and «2026 United States House of Representatives election
  ratings» pages on the dates noted in `src/data/ratings/*.ts`. A district
  absent from Wikipedia's competitive-seats list is shaded Solid for the party
  holding the seat, except six seats every outlet rates Safe for the opposite
  party (four new 2026 seats and the California 1 / Louisiana 6 redistricting
  flips); see the generator's comments in `scripts/` history and the per-file
  headers. Inside Elections' "Tilt" ratings are shown as Lean.

## Deployment

`npm run build` produces a fully static `dist/`. Host it on any static host
(Cloudflare Pages, Netlify, GitHub Pages, S3). If you deploy under a subpath,
set Vite's `base` option accordingly.
