#!/usr/bin/env node
/**
 * WikiSpin pool builder.
 *
 * Queries the Wikidata Query Service (SPARQL) and writes compact JSON "pools"
 * of English Wikipedia article titles into src/data/pools/, plus a country
 * lookup table in src/data/countries.json.
 *
 * Usage:
 *   node tools/build-pools.mjs                 # build everything
 *   node tools/build-pools.mjs --only=people.writers,wars.battles
 *   node tools/build-pools.mjs --check         # print labels of every QID used, then exit
 *   node tools/build-pools.mjs --max=6000      # per-pool cap (default 6000)
 *
 * Set WIKISPIN_CONTACT to your e-mail or URL so Wikimedia can reach you
 * (required by https://meta.wikimedia.org/wiki/User-Agent_policy).
 *
 * The app never runs these heavy queries itself; it only reads the generated files.
 */
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'src', 'data', 'pools');
const COUNTRIES_FILE = path.join(ROOT, 'src', 'data', 'countries.json');

const CONTACT = process.env.WIKISPIN_CONTACT || 'set-WIKISPIN_CONTACT@example.com';
const USER_AGENT = `WikiSpinPoolBuilder/1.0 (${CONTACT}) node/${process.versions.node}`;
const SPARQL = 'https://query.wikidata.org/sparql';
const WD_API = 'https://www.wikidata.org/w/api.php';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const MAX_PER_POOL = Number(args.max ?? 6000);
const ONLY = typeof args.only === 'string' ? new Set(args.only.split(',')) : null;

// ---------------------------------------------------------------------------
// Query templates
// ---------------------------------------------------------------------------

const ENWIKI = `?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title .`;

/** People with a given occupation, randomly sampled with Blazegraph's bd:sample service. */
const peopleByOccupation = (occupationQid, sampleSize) => `
SELECT ?item ?title ?s ?c ?date WHERE {
  SERVICE bd:sample {
    ?item wdt:P106 wd:${occupationQid} .
    bd:serviceParam bd:sample.limit ${sampleSize} .
    bd:serviceParam bd:sample.sampleType "RANDOM" .
  }
  ?item wdt:P31 wd:Q5 ; wikibase:sitelinks ?s .
  ${ENWIKI}
  OPTIONAL { ?item wdt:P27 ?c }
  OPTIONAL { ?item wdt:P569 ?date }
}`;

/**
 * National heads of state / government: people who held the office that a country names
 * as its head of state (P1906) or head of government (P1313). The country of that office
 * becomes the person's country here.
 *
 * Note: the spec suggested "positions that are subclasses of head of state (Q48352) /
 * head of government (Q2285706)". That query times out on Wikidata because mayors and
 * other local leaders are subclasses of head of government, so this narrower,
 * national-level query is used instead.
 */
const politicalLeaders = () => `
SELECT ?item ?title ?s ?c ?date
WITH {
  SELECT DISTINCT ?pos ?c WHERE {
    VALUES ?t { wd:Q3624078 wd:Q3024240 wd:Q6256 }
    ?c wdt:P31 ?t ; wdt:P1906|wdt:P1313 ?pos .
  }
} AS %pos
WHERE {
  INCLUDE %pos .
  ?item wdt:P39 ?pos ; wdt:P31 wd:Q5 ; wikibase:sitelinks ?s .
  ${ENWIKI}
  OPTIONAL { ?item wdt:P569 ?date }
}`;

/** Species under a plant family, identified by its scientific name (P225) and rank family (Q35409). */
const plantSpeciesInFamily = (familyName) => `
SELECT ?item ?title ?s WHERE {
  ?root wdt:P225 "${familyName}" ; wdt:P105 wd:Q35409 .
  ?item wdt:P171+ ?root ; wdt:P105 wd:Q7432 ; wikibase:sitelinks ?s .
  ${ENWIKI}
}`;

/** Instances of a class (or its subclasses), e.g. wars, battles. Country = location or participant. */
const eventsOfClass = (classQid, minSitelinks = 1) => `
SELECT ?item ?title ?s ?c ?date WHERE {
  ?item wdt:P31/wdt:P279* wd:${classQid} ; wikibase:sitelinks ?s .
  FILTER(?s >= ${minSitelinks})
  ${ENWIKI}
  OPTIONAL { ?item wdt:P17|wdt:P710 ?c }
  OPTIONAL { ?item wdt:P580|wdt:P585 ?date }
}`;

/** Sports and disciplines (instances of "sport" or "type of sport"). Country = country of origin. */
const sportsDisciplines = () => `
SELECT ?item ?title ?s ?c ?date WHERE {
  VALUES ?cls { wd:Q349 wd:Q31629 }
  ?item wdt:P31 ?cls ; wikibase:sitelinks ?s .
  ${ENWIKI}
  OPTIONAL { ?item wdt:P495 ?c }
  OPTIONAL { ?item wdt:P571 ?date }
}`;

/**
 * Sports competitions. "sports competition" has a huge subclass tree, so a single
 * P31/P279* query times out. Instead: (1) fetch the subclass tree, (2) query direct
 * instances in chunks of classes, keeping only articles with 3+ sitelinks.
 */
async function sportsCompetitionRows() {
  const classes = (await sparql('SELECT DISTINCT ?cls WHERE { ?cls wdt:P279* wd:Q13406554 . }')).map((r) => r.cls.value.split('/').pop());
  console.log(`  ${classes.length} competition classes`);
  const rows = [];
  for (let i = 0; i < classes.length; i += 150) {
    const chunk = classes.slice(i, i + 150);
    try {
      rows.push(
        ...(await sparql(`
SELECT ?item ?title ?s ?c ?date WHERE {
  VALUES ?cls { ${chunk.map((q) => `wd:${q}`).join(' ')} }
  ?item wdt:P31 ?cls ; wikibase:sitelinks ?s .
  FILTER(?s >= 3)
  ${ENWIKI}
  OPTIONAL { ?item wdt:P17 ?c }
  OPTIONAL { ?item wdt:P580|wdt:P585|wdt:P571 ?date }
} LIMIT 4000`)),
      );
    } catch (e) {
      console.warn(`  chunk ${i / 150 + 1} failed: ${e.message.slice(0, 80)}`);
    }
    process.stdout.write(`  classes ${Math.min(i + 150, classes.length)}/${classes.length}, ${rows.length} rows\r`);
  }
  console.log();
  return rows;
}

// ---------------------------------------------------------------------------
// Pool definitions. IDs must match src/core/categories.ts.
// ---------------------------------------------------------------------------

const occ = (id, qids, sample = 12000) => ({ id, queries: qids.map((q) => peopleByOccupation(q, sample)) });

const POOLS = [
  { id: 'people.leaders', queries: [politicalLeaders()] },
  occ('people.politicians', ['Q82955'], 30000),
  occ('people.writers', ['Q36180', 'Q49757', 'Q6625963']),
  occ('people.scientists', ['Q901', 'Q169470', 'Q593644', 'Q170790']),
  occ('people.artists', ['Q1028181', 'Q1281618']),
  occ('people.musicians', ['Q639669', 'Q177220', 'Q36834']),
  occ('people.actors', ['Q33999', 'Q10800557']),
  occ('people.athletes', ['Q2066131', 'Q937857', 'Q3665646', 'Q10833314']),
  occ('people.military', ['Q189290', 'Q47064']),
  {
    id: 'plants.flowers',
    queries: ['Orchidaceae', 'Rosaceae', 'Asteraceae', 'Liliaceae', 'Ranunculaceae', 'Iridaceae', 'Amaryllidaceae', 'Ericaceae'].map(plantSpeciesInFamily),
  },
  {
    id: 'plants.trees',
    queries: ['Pinaceae', 'Fagaceae', 'Betulaceae', 'Sapindaceae', 'Cupressaceae', 'Arecaceae', 'Myrtaceae', 'Salicaceae'].map(plantSpeciesInFamily),
  },
  {
    id: 'plants.edible',
    queries: ['Solanaceae', 'Brassicaceae', 'Cucurbitaceae', 'Apiaceae', 'Lamiaceae', 'Rutaceae', 'Musaceae', 'Amaranthaceae'].map(plantSpeciesInFamily),
  },
  {
    id: 'plants.succulents',
    queries: ['Cactaceae', 'Crassulaceae', 'Aizoaceae', 'Asphodelaceae'].map(plantSpeciesInFamily),
  },
  { id: 'sports.disciplines', queries: [sportsDisciplines()] },
  { id: 'sports.competitions', queries: [], run: sportsCompetitionRows },
  { id: 'wars.wars', queries: [eventsOfClass('Q198')] },
  { id: 'wars.battles', queries: [eventsOfClass('Q178561')] },
];

/** Every QID referenced above, printed with its label by --check so mistakes are easy to spot. */
const QIDS_USED = [
  'Q5', 'Q48352', 'Q2285706', 'Q82955', 'Q36180', 'Q49757', 'Q6625963', 'Q901', 'Q169470', 'Q593644',
  'Q170790', 'Q1028181', 'Q1281618', 'Q639669', 'Q177220', 'Q36834', 'Q33999', 'Q10800557', 'Q2066131',
  'Q937857', 'Q3665646', 'Q10833314', 'Q189290', 'Q47064', 'Q35409', 'Q7432', 'Q349', 'Q31629',
  'Q13406554', 'Q198', 'Q178561', 'Q6256', 'Q7275', 'Q3624078', 'Q3024240',
];

// ---------------------------------------------------------------------------
// HTTP helpers with polite rate limiting
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function politeFetch(url, init = {}, attempt = 1) {
  const res = await fetch(url, {
    ...init,
    headers: { 'User-Agent': USER_AGENT, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(90_000),
  }).catch((e) => ({ ok: false, status: 0, error: e }));

  if (res.ok) return res;

  const retryable = res.status === 0 || res.status === 429 || res.status >= 500;
  // A 504 means the query itself hit the 60 s server limit; retrying more than once won't help.
  const gaveUp = attempt >= 6 || (res.status === 504 && attempt >= 2);
  if (!retryable || gaveUp) {
    const body = res.text ? (await res.text()).slice(0, 300) : String(res.error);
    throw new Error(`HTTP ${res.status} after ${attempt} attempt(s): ${body}`);
  }
  const retryAfter = Number(res.headers?.get?.('retry-after'));
  const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(120_000, 5_000 * 2 ** attempt);
  console.warn(`  ! HTTP ${res.status || 'network error'}, retrying in ${Math.round(wait / 1000)}s (attempt ${attempt + 1})`);
  await sleep(wait);
  return politeFetch(url, init, attempt + 1);
}

async function sparql(query) {
  const res = await politeFetch(SPARQL, {
    method: 'POST',
    headers: {
      Accept: 'application/sparql-results+json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ query }).toString(),
  });
  const json = await res.json();
  await sleep(1500); // stay well below the query service's per-minute budget
  return json.results.bindings;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const qidNum = (uri) => Number(uri.slice(uri.lastIndexOf('/Q') + 2));

function parseYear(value) {
  // xsd:dateTime like "1882-07-07T00:00:00Z" or "-0500-01-01T00:00:00Z"
  const m = /^(-?)0*(\d+)-/.exec(value ?? '');
  if (!m) return null;
  const y = Number(m[2]) * (m[1] ? -1 : 1);
  return Number.isFinite(y) ? y : null;
}

/** Merge SPARQL rows (one row per item × country × date) into one entry per item. */
function mergeRows(rows, into = new Map()) {
  for (const r of rows) {
    const q = qidNum(r.item.value);
    let e = into.get(q);
    if (!e) {
      e = { t: r.title.value, s: Number(r.s.value), c: new Set(), y: null };
      into.set(q, e);
    }
    if (r.c?.value?.includes('/entity/Q')) e.c.add(qidNum(r.c.value));
    const y = parseYear(r.date?.value);
    if (y !== null && (e.y === null || y < e.y)) e.y = y; // earliest date wins (birth / start)
  }
  return into;
}

/** Deterministic shuffle (mulberry32) so rebuilds with the same data give the same subset. */
function seededShuffle(list, seed = 42) {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const isJunkTitle = (t) =>
  /^(List of|Lists of|Index of|Outline of|Timeline of)\b/i.test(t) ||
  /^\d{1,4}s? in /.test(t) || // "1964 in the Vietnam War"-style year articles
  t.includes('(disambiguation)');

// ---------------------------------------------------------------------------
// Countries
// ---------------------------------------------------------------------------

const flagFromIso = (iso) =>
  iso && /^[A-Z]{2}$/.test(iso) ? String.fromCodePoint(...[...iso].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)) : '';

async function resolveCountries(qidNums) {
  const ids = [...qidNums];
  const result = {};
  for (let i = 0; i < ids.length; i += 300) {
    const chunk = ids.slice(i, i + 300);
    const rows = await sparql(`
SELECT ?c ?label ?iso WHERE {
  VALUES ?c { ${chunk.map((n) => `wd:Q${n}`).join(' ')} }
  ?c wdt:P31/wdt:P279* ?type .
  VALUES ?type { wd:Q6256 wd:Q7275 }
  ?c rdfs:label ?label . FILTER(LANG(?label) = "en")
  OPTIONAL { ?c wdt:P297 ?iso }
}`);
    for (const r of rows) {
      const n = qidNum(r.c.value);
      const prev = result[n];
      const iso = r.iso?.value ?? prev?.iso ?? null;
      result[n] = { n: r.label.value, iso, f: flagFromIso(iso) };
    }
    process.stdout.write(`  countries: ${Math.min(i + 300, ids.length)}/${ids.length}\r`);
  }
  console.log();
  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function check() {
  const url = `${WD_API}?action=wbgetentities&props=labels&languages=en&format=json&ids=${QIDS_USED.join('|')}`;
  const json = await (await politeFetch(url)).json();
  for (const q of QIDS_USED) console.log(q.padEnd(10), json.entities?.[q]?.labels?.en?.value ?? '??? (missing)');
}

async function buildPool(def) {
  console.log(`\n▶ ${def.id}`);
  const merged = new Map();
  if (def.run) {
    try {
      mergeRows(await def.run(), merged);
    } catch (e) {
      console.warn(`  FAILED: ${e.message}`);
    }
  }
  for (const [i, q] of def.queries.entries()) {
    const t0 = Date.now();
    try {
      const rows = await sparql(q);
      mergeRows(rows, merged);
      console.log(`  query ${i + 1}: ${rows.length} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${merged.size} items`);
    } catch (e) {
      console.warn(`  query ${i + 1} FAILED: ${e.message}`);
    }
  }
  let items = [...merged.values()].filter((e) => !isJunkTitle(e.t));
  if (items.length > MAX_PER_POOL) items = seededShuffle(items).slice(0, MAX_PER_POOL);
  return items;
}

async function main() {
  if (args.check) return check();
  await mkdir(OUT_DIR, { recursive: true });

  const built = {};
  for (const def of POOLS) {
    if (ONLY && !ONLY.has(def.id)) continue;
    built[def.id] = await buildPool(def);
  }

  // Resolve countries for all newly built pools, merging with any existing table.
  const existing = existsSync(COUNTRIES_FILE) ? JSON.parse(await readFile(COUNTRIES_FILE, 'utf8')) : {};
  const wanted = new Set();
  for (const items of Object.values(built)) for (const e of items) for (const c of e.c) if (!existing[c]) wanted.add(c);
  console.log(`\nResolving ${wanted.size} country candidates…`);
  const countries = { ...existing, ...(await resolveCountries(wanted)) };

  for (const [id, items] of Object.entries(built)) {
    if (items.length === 0) {
      console.warn(`✗ ${id}: empty, keeping the previous file (if any)`);
      continue;
    }
    const compact = items
      .map((e) => [e.t, e.s, [...e.c].filter((c) => countries[c]).sort((a, b) => a - b), e.y])
      .sort((a, b) => b[1] - a[1]);
    const file = { id, generatedAt: new Date().toISOString(), count: compact.length, items: compact };
    await writeFile(path.join(OUT_DIR, `${id}.json`), JSON.stringify(file));
    const withCountry = compact.filter((x) => x[2].length).length;
    const withYear = compact.filter((x) => x[3] !== null).length;
    const samples = seededShuffle(compact, Date.now() % 1000).slice(0, 4).map((x) => `"${x[0]}" (${x[1]})`);
    console.log(`✓ ${id}: ${compact.length} items, ${withCountry} with country, ${withYear} with year. e.g. ${samples.join(', ')}`);
  }

  await writeFile(COUNTRIES_FILE, JSON.stringify(countries));
  await writeIndex();
  console.log(`\nDone. ${Object.keys(countries).length} countries in table.`);
}

/** Generate src/data/pools/index.ts with lazy requires for every pool file present. */
async function writeIndex() {
  const files = (await readdir(OUT_DIR)).filter((f) => f.endsWith('.json')).sort();
  const lines = files.map((f) => `  '${f.replace(/\.json$/, '')}': () => require('./${f}'),`);
  const src = `// AUTO-GENERATED by tools/build-pools.mjs — do not edit by hand.
import type { PoolFile } from '@/core/pools/types';

export const POOL_LOADERS: Record<string, () => PoolFile> = {
${lines.join('\n')}
};
`;
  await writeFile(path.join(OUT_DIR, 'index.ts'), src);
  let total = 0;
  for (const f of files) total += (await readFile(path.join(OUT_DIR, f))).length;
  console.log(`Pools on disk: ${files.length} files, ${(total / 1024 / 1024).toFixed(2)} MB total.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
