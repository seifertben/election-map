// Build candidate cards from Wikipedia election infoboxes. Photos link to their
// original file pages for authorship and license information. No runtime API.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const cache = process.env.CANDIDATES_CACHE ?? '/tmp/election-map-candidates';
const pollCache = process.env.WIKI_POLLS_CACHE ?? '/tmp/opencode/wiki-polls';
const refresh = process.argv.includes('--refresh');
mkdirSync(cache, { recursive: true });
const clean = s => (s ?? '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
const wikiUrl = title => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`;
const absolute = value => value ? new URL(value, 'https://en.wikipedia.org').href.split('?')[0] : null;
async function request(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(45000), headers: { 'User-Agent': 'ElectionMap/1.0 (candidate snapshot; mapelection.com)' } });
    if (response.ok) return response;
    if (![502, 503, 504].includes(response.status)) throw Error(`${response.status}: ${url}`);
    await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
  }
  throw Error(`Retries exhausted: ${url}`);
}
async function article(title) {
  const filename = `${title.replace(/[^A-Za-z0-9_.-]/g, '_')}.html`;
  for (const dir of [cache, pollCache]) {
    const path = resolve(dir, filename);
    if (!refresh && existsSync(path)) return readFileSync(path, 'utf8');
  }
  let html;
  try {
    const response = await request(`https://en.wikipedia.org/w/api.php?action=parse&prop=text&format=json&formatversion=2&redirects=1&page=${encodeURIComponent(title)}`);
    const json = await response.json();
    if (!json.parse?.text) throw Error(`No article: ${title}`);
    html = json.parse.text;
  } catch {
    html = await (await request(wikiUrl(title))).text();
  }
  writeFileSync(resolve(cache, filename), html);
  return html;
}
// Keep DOM parsing bounded even on long statewide election articles.
function infoboxDocument(html) {
  const boxes = [];
  const starts = /<table\b[^>]*class=["'][^"']*\binfobox\b[^"']*["'][^>]*>/gi;
  let start;
  while ((start = starts.exec(html))) {
    const tags = /<\/?table\b[^>]*>/gi;
    tags.lastIndex = starts.lastIndex;
    let depth = 1, tag;
    while (depth && (tag = tags.exec(html))) depth += /^<\//.test(tag[0]) ? -1 : 1;
    if (depth) throw Error('Unclosed infobox');
    boxes.push(html.slice(start.index, tags.lastIndex));
    starts.lastIndex = tags.lastIndex;
  }
  return new JSDOM(boxes.join(''));
}
function portrait(cell) {
  const img = cell?.querySelector('img');
  const src = img?.getAttribute('src');
  if (!src || /3x4\.svg|placeholder|silhouette|no[_ -]image|question[_ -]mark/i.test(src)) return {};
  const credit = img.closest('a')?.getAttribute('href');
  return { photo: absolute(src), photoSource: absolute(credit) };
}
function parseNominees(box, source) {
  // Match cells within the same nested nominee table; outer infobox rows can
  // otherwise accidentally combine nominees with incumbent or party-leader images.
  const row = [...box.querySelectorAll('tr')].find(r => /^(Nominee|Candidate)$/i.test(clean(r.querySelector(':scope > th')?.textContent)));
  if (!row) return [];
  const table = row.closest('table');
  const rows = [...table.rows];
  const partyRow = rows.find(r => /^Party$/i.test(clean(r.cells[0]?.textContent)));
  const imageRow = rows.slice(0, rows.indexOf(row)).reverse().find(r => [...r.cells].some(c => c.querySelector('img')));
  return [...row.cells].slice(1).flatMap((cell, index) => {
    const name = clean(cell.textContent);
    const party = clean(partyRow?.cells[index + 1]?.textContent);
    if (!name || !party || /^(TBD|TBA|None|Unopposed|Vacant)$/i.test(name)) return [];
    const link = [...cell.querySelectorAll('a')].find(a => !a.closest('sup') && !/redlink=1/.test(a.getAttribute('href') ?? ''));
    return [{ name, party, partyCode: /Democrat/i.test(party) ? 'D' : /Republican/i.test(party) ? 'R' : /Independent/i.test(party) ? 'I' : 'O',
      source, ...(link ? { biography: absolute(link.getAttribute('href')) } : {}), ...portrait(imageRow?.cells[index + 1]) }];
  });
}
const states = [...readFileSync('src/data/states.ts', 'utf8').matchAll(/fips: "(\d+)", abbr: "([A-Z]+)", name: "([^"]+)"/g)].map(([, fips, abbr, name]) => ({ fips, abbr, name }));
const atLarge = new Set(['02', '10', '38', '46', '50', '56']);
const data = { senate: {}, governor: {}, house: {}, president: {} };
for (const mode of ['senate', 'governor']) {
  const fipsList = [...readFileSync(`src/data/${mode}2026.ts`, 'utf8').matchAll(/\{ fips: "(\d+)"/g)].map(m => m[1]);
  for (const fips of fipsList) {
    const state = states.find(s => s.fips === fips);
    const title = mode === 'governor' ? `2026 ${state.name} gubernatorial election` : `2026 United States Senate ${['12','39'].includes(fips) ? 'special ' : ''}election in ${state.name}`;
    const doc = infoboxDocument(await article(title)).window;
    const candidates = parseNominees(doc.document.querySelector('table.infobox'), wikiUrl(title));
    if (!candidates.length) throw Error(`No nominees: ${title}`);
    data[mode][fips] = candidates;
    doc.close();
    await new Promise(resolve => setTimeout(resolve, 0));
    globalThis.gc?.();
  }
  console.log(`${mode}: ${Object.keys(data[mode]).length} races`);
}
for (const state of states.filter(s => s.fips !== '11')) {
  const title = `2026 United States House of Representatives election${atLarge.has(state.fips) ? '' : 's'} in ${state.name}`;
  const html = await article(title);
  const window = infoboxDocument(html).window;
  for (const box of window.document.querySelectorAll('table.infobox')) {
    const caption = clean(box.querySelector('caption')?.textContent);
    // Only district general-election infoboxes, never party primaries.
    if (/primary/i.test(caption)) continue;
    const match = /(?:District\s+(\d+)|(\d+)(?:st|nd|rd|th) congressional district)/i.exec(caption);
    const district = atLarge.has(state.fips) ? '00' : match ? (match[1] ?? match[2]).padStart(2, '0') : null;
    if (!district) continue;
    const candidates = parseNominees(box, wikiUrl(title));
    if (candidates.length) data.house[`${state.fips}${district}`] = candidates;
  }
  if (!Object.keys(data.house).some(key => key.startsWith(state.fips))) {
    const overview = new JSDOM(html).window;
    for (const row of overview.document.querySelectorAll('table.wikitable tr')) {
      const cells = [...row.cells];
      const label = clean(cells[0]?.textContent);
      if (!label.startsWith(`${state.name} `)) continue;
      const districtMatch = /(?: (\d+)|at-large)$/.exec(label);
      if (!districtMatch) continue;
      const district = atLarge.has(state.fips) ? '00' : districtMatch[1]?.padStart(2, '0');
      if (!district) continue;
      const candidates = [...(cells.at(-1)?.querySelectorAll('li') ?? [])].flatMap(item => {
        const text = clean(item.textContent).replace(/^[▌\s]+/, '');
        const match = /^(.*?)\s*\(([^()]+)\)$/.exec(text);
        if (!match) return [];
        const [, name, party] = match;
        const link = [...item.querySelectorAll('a')].find(a => clean(a.textContent) === name && !/redlink=1/.test(a.getAttribute('href') ?? ''));
        return [{ name, party, partyCode: /Democrat/i.test(party) ? 'D' : /Republican/i.test(party) ? 'R' : /Independent/i.test(party) ? 'I' : 'O', source: wikiUrl(title), ...(link ? { biography: absolute(link.getAttribute('href')) } : {}) }];
      });
      if (candidates.length) data.house[`${state.fips}${district}`] = candidates;
    }
    // Louisiana's November jungle ballot lists all declared candidates instead
    // of party nominees. Stop at Withdrawn/Declined, never include those names.
    if (state.fips === '22') {
      let district = null, declared = false;
      for (const element of overview.document.querySelectorAll('h2,h3,h4,h5,ul')) {
        if (/^H/.test(element.tagName)) {
          const heading = clean(element.textContent).replace(/\[edit.*$/, '').trim();
          const match = /^District (\d+)$/.exec(heading);
          if (element.tagName === 'H2') district = match ? match[1].padStart(2, '0') : null;
          declared = /^Declared$/.test(heading);
          continue;
        }
        if (!district || !declared) continue;
        const candidates = [...element.querySelectorAll(':scope > li')].flatMap(item => {
          const match = /^(.*?)\s*\((Democratic|Republican|Independent|Libertarian|Green|No party[^)]*)\)/i.exec(clean(item.textContent));
          if (!match) return [];
          const [, name, party] = match;
          const link = [...item.querySelectorAll('a')].find(a => clean(a.textContent) === name && !/redlink=1/.test(a.getAttribute('href') ?? ''));
          return [{ name, party, partyCode: /Democrat/i.test(party) ? 'D' : /Republican/i.test(party) ? 'R' : /Independent/i.test(party) ? 'I' : 'O', source: wikiUrl(title), ...(link ? { biography: absolute(link.getAttribute('href')) } : {}) }];
        });
        if (candidates.length) data.house[`${state.fips}${district}`] = candidates;
      }
    }
    overview.close();
  }
  console.log(`House ${state.abbr}: ${Object.keys(data.house).filter(k => k.startsWith(state.fips)).length} districts`);
  window.close();
  await new Promise(resolve => setTimeout(resolve, 0));
  globalThis.gc?.();
}
const presidentialTitle = '2024 United States presidential election';
const presWindow = infoboxDocument(await article(presidentialTitle)).window;
const president = parseNominees(presWindow.document.querySelector('table.infobox'), wikiUrl(presidentialTitle));
if (!president.length) throw Error('Missing presidential nominees');
for (const state of states) data.president[state.fips] = president;
presWindow.close();
// Fill missing infobox portraits from linked, unambiguous biography pages.
const missing = [...new Set(Object.values(data).flatMap(races => Object.values(races).flat()).filter(c => !c.photo && c.biography).map(c => c.biography))];
const enriched = new Map();
for (let offset = 0; offset < missing.length; offset += 30) {
  const biographies = missing.slice(offset, offset + 30);
  const titles = biographies.map(url => decodeURIComponent(new URL(url).pathname.replace('/wiki/', '')).replaceAll('_', ' '));
  const path = resolve(cache, `portraits-${offset}.json`);
  try {
    let response;
    if (!refresh && existsSync(path)) {
      const cached = JSON.parse(readFileSync(path, 'utf8'));
      if (JSON.stringify(cached.titles) === JSON.stringify(titles)) response = cached.response;
    }
    if (!response) {
      response = await (await request(`https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=pageimages&piprop=thumbnail|name&pithumbsize=160&pilicense=any&titles=${encodeURIComponent(titles.join('|'))}`)).json();
      writeFileSync(path, JSON.stringify({ titles, response }));
    }
    const pages = response.query?.pages ?? [];
    const redirects = [...(response.query?.normalized ?? []), ...(response.query?.redirects ?? [])];
    for (let i = 0; i < biographies.length; i++) {
      let title = titles[i];
      for (const redirect of redirects) if (redirect.from === title) title = redirect.to;
      const page = pages.find(page => page.title === title);
      if (page?.thumbnail && !/elections?|list of/i.test(page.title) && !/flag|logo|signature|seal|placeholder|3x4\.svg/i.test(page.pageimage ?? '') && page.thumbnail.width / page.thumbnail.height < 1.3) enriched.set(biographies[i], { photo: absolute(page.thumbnail.source), photoSource: wikiUrl(`File:${page.pageimage}`) });
    }
  } catch (error) { console.warn(`Portrait lookup unavailable: ${error.message}`); }
}
for (const races of Object.values(data)) for (const candidates of Object.values(races)) for (const c of candidates) if (!c.photo && enriched.has(c.biography)) Object.assign(c, enriched.get(c.biography));
// Reuse known photos when the same candidate appears in another race.
const people = Object.values(data).flatMap(races => Object.values(races).flat());
const photos = new Map(people.filter(c => c.photo && c.biography).map(c => [c.biography, c]));
for (const c of people) if (!c.photo && photos.has(c.biography)) {
  const photo = photos.get(c.biography); c.photo = photo.photo; c.photoSource = photo.photoSource;
}
// Persist an audit before validation so missing district infoboxes can be investigated.
writeFileSync(resolve(cache, 'candidate-audit.json'), JSON.stringify(data, null, 2));
const houseCount = Object.keys(data.house).length;
if (houseCount !== 435) throw Error(`Expected 435 House races, found ${houseCount}; inspect ${cache}/candidate-audit.json`);
const output = { asOf: new Date().toISOString().slice(0, 10), source: 'Wikipedia election infoboxes; photo credits and licenses are linked per candidate.', ...data };
mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/candidates.json', JSON.stringify(output));
console.log(`Wrote candidate snapshot; ${people.filter(c => c.photo).length}/${people.length} candidate appearances have portraits.`);
