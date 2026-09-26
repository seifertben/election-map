# 2026 Election Map

Build and share your own election maps for the **President**, **Senate**,
**Governor**, and **House**. Click a state or district to change its color,
watch the live scoreboard, then share the result with a link or export it as a
PNG.

## Features

- **President** — all 50 states + DC, weighted by electoral votes (270 to win).
  There is no presidential election in 2026, so the map loads the **2024**
  state-by-state results as its starting point.
- **Senate** — the 35 seats contested in 2026 (all 33 Class 2 seats plus the
  Florida and Ohio special elections); everything else is grey.
- **Governor** — the 36 governorships contested in 2026; everything else is
  grey. The scoreboard tracks the full 50-state field, so the 14 states without
  a 2026 election are folded in at their current party.
- **House** — the 435 voting districts using the Census Bureau's **120th
  Congressional District** boundaries, i.e. the 2026 election cycle lines
  (including the ten states that redrew mid-decade).
- The Senate, Governor, and House maps load the **Cook Political Report**
  2026 race ratings by default, drawn as Solid / Likely / Lean shades of blue
  and red (plus Toss Up). Hover a region to see its rating.
- A **Polling** panel on the Senate and Governor maps colors the contested
  states by 2026 polling margin on a diverging blue-to-red scale. Pick a single
  pollster or a rolling average (last 5, last 10, or all polls); states with no
  matching poll stay grey and the hover tooltip shows the aggregate (plus the
  poll date when a single pollster is selected). You can paint over
  individual states while the poll view is up, but those paints are ephemeral:
  setting either sidebar dropdown — selecting or changing the poll option, or
  choosing a ratings source — resets the map to that source and clears every
  paint.
- A **Betting Markets** panel on the Senate, Governor, and House maps colors
  the contested seats by live Polymarket implied win probability on the same
  diverging blue-to-red scale, refreshed every 30 seconds. Senate and Governor
  states with no market stay grey; House districts likewise. Painting over the
  overlay is ephemeral, and choosing ratings or polling drops the market (and
  vice versa) so the three sources stay mutually exclusive.
- A **Ratings dropdown** in the sidebar swaps the 2026 Senate/Governor/House
  ratings between six outlets: Cook Political Report, Inside Elections,
  Sabato's Crystal Ball, Split Ticket, Decision Desk HQ, and Fox News Power
  Rankings. Each entry shows the outlet's publish date and links to its ratings
  page; loading another source is undoable. Editing a map afterwards marks it
  **custom** with an option to re-apply the source's ratings. Split Ticket does
  not publish 2026 governor ratings, so the Governor dropdown lists the other
  five outlets.
- **Stripe party pickups**: when a seat's projected party differs from the
  party currently holding it, the district is filled with a diagonal stripe
  pattern — a D pickup is drawn in two blues, an R pickup in two reds —
  instead of mixing the holder's color in. The wider band is the projected
  shade; the narrower band is a lighter tint of it. Toggle it in the Pickups
  panel; it works for any source, for the flat party colors you paint, and for
  the polling view. The tooltip calls out the pickup direction.
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
npm run build:polls  # regenerate the committed 2026 Senate polling snapshot
npm run build:gov-polls  # regenerate the committed 2026 Governor polling snapshot
npm run fetch:polls  # re-scrape the Wikipedia polling tables (scripts/*-polls-wiki.json)
```

The Wikipedia scraper takes `--governor` to fetch the 36 governor races instead
of the 35 Senate seats:

```bash
node scripts/fetch-wiki-polls.mjs --governor
```

## Architecture

```
scripts/build-geo.mjs     fetch + generalize Census geography -> public/data/
scripts/fetch-wiki-polls.mjs  scrape Wikipedia per-race polling -> scripts/*-polls-wiki.json
scripts/build-polls.mjs   compile 2026 Senate polling -> src/data/polling/
scripts/build-gov-polls.mjs  compile 2026 Governor polling -> src/data/polling/
public/data/              committed states.json + cd120.json
src/data/                 parties, states + electoral votes, 2026 Senate/Governor races
src/data/ratings/         per-outlet 2026 House + Senate + Governor race ratings
src/data/polling/         committed 2026 Senate/Governor polling snapshots
src/data/ratingsSources.ts  ratings-source registry consumed by the UI
src/data/house2026Holder.ts incumbent party per district (drives pickup stripes)
src/state/                reducer (assignments/history) + URL-hash codec
src/lib/                  projection, scoreboard math, polling aggregation, markets, PNG export
src/components/           RegionMap, ModeTabs, PartyPalette, Scoreboard, RatingsPanel, PollingPanel, PickupPanel, MarketPanel
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
- The Senate polling snapshot in `src/data/polling/senate2026.ts` is committed
  so the app stays hermetic. Its **primary source is Wikipedia**: each of the
  35 seats' articles is scraped for the general-election polling table of the
  actual nominee matchup (`scripts/fetch-wiki-polls.mjs` →
  `scripts/senate-polls-wiki.json`, which also carries sample sizes).
  **electoral-vote.com**'s nonpartisan Senate poll list, plus hand-checked
  Wikipedia rows for Kentucky, Idaho, Oklahoma and Tennessee, fills the seats
  Wikipedia has no general-election polls for — Alaska and Minnesota. Each seat
  is taken from a single source so the head-to-head is never blended across
  candidate matchups. States with no public polling (CO, DE, IL, NJ, OR, WV,
  WY) are omitted and render grey. Nebraska's `d` column is the independent
  challenger Dan Osborn — the state has no Democratic nominee.
  `npm run fetch:polls` re-scrapes Wikipedia (the committed HTML responses are
  cached under `/tmp/opencode/wiki-polls`); `npm run build:polls` regenerates
  the module, and `--evp` re-compiles the fallback base from a fresh
  electoral-vote.com CSV. Averages are unweighted means of the selected polls;
  pollster options use that pollster's individual polls only.
- The Governor polling snapshot in `src/data/polling/governor2026.ts` is
  committed the same way. Its source is **Wikipedia**: each of the 36 states'
  «2026 <state> gubernatorial election» articles is scraped for the
  general-election polling table of the actual nominee matchup
  (`node scripts/fetch-wiki-polls.mjs --governor` →
  `scripts/governor-polls-wiki.json`), then `npm run build:gov-polls` compiles
  it. Alaska, Colorado, Hawaii, Minnesota, Oklahoma, South Dakota and Wyoming
  have no public 2026 general-election polling and render grey; the other 29
  states are shaded.
- The Governor ratings in `src/data/ratings/*.ts` come from the Wikipedia
  «2026 United States gubernatorial elections» predictions table for Cook,
  Inside Elections, Sabato, Decision Desk HQ and Fox News (as of the dates noted
  in each file). Split Ticket does not publish 2026 governor ratings, so it is
  omitted from the Governor dropdown and `governor` is undefined for that
  source.
- The Governor **Betting Markets** overlay reads Polymarket's
  «Governor Elections» tag (`104094`) and colors states by implied win
  probability. Polymarket's governor candidate markets list candidates without a
  party tag, so `src/lib/markets.ts` carries a per-state candidate→party map
  (built from the Wikipedia race summary) to total the Democratic and Republican
  columns.
- The House **Betting Markets** overlay reads Polymarket's «House Elections»
  tag (`103899`), whose per-district winner events are titled by seat
  («TX-05 House Election Winner», «AK-AL …») and keyed to the map's district
  geoid. Candidates are normally party-tagged (or sold as generic
  «Democratic Party» / «Republican Party» markets); the lone exception —
  California's 40th, offered only as an "(Individual)" market — gets a
  per-district candidate→party entry in `src/lib/markets.ts`.

## Deployment

`npm run build` produces a fully static `dist/`. Host it on any static host
(Cloudflare Pages, Netlify, GitHub Pages, S3). If you deploy under a subpath,
set Vite's `base` option accordingly.
