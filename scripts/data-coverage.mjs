#!/usr/bin/env node
// Validates the curated Wave 1 data against docs/CONTRACTS.md §4/§4a/§6 and prints coverage.
// No dependencies, so it runs before `pnpm install`. Exit code 1 if any error is found.
// Usage: node scripts/data-coverage.mjs [--facts data/sources/locality-facts.json]
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);
const readJson = (p) => {
  const file = join(root, p);
  if (!existsSync(file)) { err(`missing ${p}`); return null; }
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch (e) { err(`${p}: invalid JSON (${e.message})`); return null; }
};

const LOCALITIES = ['hinjewadi', 'wakad', 'baner', 'balewadi', 'aundh', 'kothrud', 'viman-nagar', 'kharadi', 'hadapsar', 'koregaon-park', 'shivajinagar', 'camp', 'kondhwa', 'wagholi', 'lohegaon', 'pimple-saudagar', 'pimple-nilakh', 'pimpri', 'chinchwad', 'magarpatta'];
const PHASES = ['hinjewadi-phase-1', 'hinjewadi-phase-2', 'hinjewadi-phase-3'];
const PRIORITY = ['hinjewadi', 'wakad', 'baner', 'kharadi', 'hadapsar', 'wagholi', 'pimple-saudagar', 'kothrud'];
const DISHES = ['biryani', 'samosa', 'vada-pav', 'misal-pav', 'momos', 'dosa', 'pizza', 'burger', 'poha', 'pav-bhaji', 'shawarma', 'chole-bhature', 'thali', 'kebab', 'sandwich', 'desserts'];
const TOP_SERVICES = ['waterproofing', 'painting', 'bathroom-renovation', 'modular-kitchen', 'house-construction'];
const SUB_SERVICES = { waterproofing: ['terrace-waterproofing', 'bathroom-waterproofing', 'external-wall-waterproofing', 'basement-waterproofing', 'leakage-repair'], painting: ['interior-painting', 'exterior-painting'] };
const ALL_SERVICES = [...TOP_SERVICES, ...Object.values(SUB_SERVICES).flat()];
const TIERS = ['budget', 'standard', 'premium'];
const RESERVED = /^(late-night-food|budget-food|veg-food|veg|late-night|family|office-lunch|ask|about|api|mr|hi|ui-fixtures)$|^under-|-cost$/;
const FACT_TOPICS = ['housing_stock', 'building_age', 'water', 'soil', 'rainfall', 'rules', 'access', 'demand', 'other'];

function checkSourceRef(s, where) {
  if (!s || typeof s !== 'object') return err(`${where}: SourceRef missing`);
  for (const k of ['url', 'title', 'publisher', 'retrieved_at']) if (!s[k]) err(`${where}: SourceRef.${k} missing`);
  if (s.url && !/^https:\/\//.test(s.url)) err(`${where}: SourceRef.url must be https (${s.url})`);
  if (s.retrieved_at && !/^\d{4}-\d{2}-\d{2}$/.test(s.retrieved_at)) err(`${where}: retrieved_at must be YYYY-MM-DD`);
  if (!('quote' in s)) err(`${where}: SourceRef.quote key missing (use null)`);
}
const checkFact = (f, where) => {
  if (!f.id || !f.text) err(`${where}: fact id/text missing`);
  if (!FACT_TOPICS.includes(f.topic)) err(`${where}: bad topic ${f.topic}`);
  for (const s of f.services ?? []) if (!ALL_SERVICES.includes(s)) err(`${where}: unknown service ${s}`);
  if (!Array.isArray(f.sources) || f.sources.length < 1) err(`${where}: fact needs ≥ 1 source`);
  (f.sources ?? []).forEach((s, i) => checkSourceRef(s, `${where}.sources[${i}]`));
  if (!['draft', 'reviewed'].includes(f.status)) err(`${where}: bad status`);
};

// --- localities ---
const locs = readJson('data/localities.json');
const factsArg = process.argv.indexOf('--facts');
const factsFile = factsArg > -1 ? process.argv[factsArg + 1] : 'data/sources/locality-facts.json';
if (Array.isArray(locs)) {
  const byId = new Map(locs.map((l) => [l.id, l]));
  for (const id of [...LOCALITIES, ...PHASES]) if (!byId.has(id)) err(`localities: missing ${id}`);
  const landmarks = locs.filter((l) => l.kind === 'landmark');
  if (landmarks.length < 8) err(`localities: ${landmarks.length} landmarks, need ≥ 8`);
  for (const l of locs) {
    const w = `localities[${l.id}]`;
    if (!LOCALITIES.includes(l.id) && !PHASES.includes(l.id) && !/^near-[a-z0-9-]+$/.test(l.id)) err(`${w}: id not in §4a`);
    if (l.kind === 'landmark' && !byId.has(l.parent_id)) err(`${w}: landmark needs a valid parent`);
    if (RESERVED.test(l.id)) err(`${w}: reserved slug`);
    if (typeof l.geo?.lat !== 'number' || typeof l.geo?.lng !== 'number') err(`${w}: geo missing`);
    else if (l.geo.lat < 18.3 || l.geo.lat > 18.8 || l.geo.lng < 73.6 || l.geo.lng > 74.2) err(`${w}: geo outside Pune bounds`);
    checkSourceRef(l.geo_source, `${w}.geo_source`);
    if (!['PMC', 'PCMC', 'PMRDA', 'cantonment', 'other'].includes(l.jurisdiction)) err(`${w}: bad jurisdiction`);
    if ((l.neighbours ?? []).length > 6) err(`${w}: > 6 neighbours`);
    for (const n of l.neighbours ?? []) {
      if (!byId.has(n)) err(`${w}: unknown neighbour ${n}`);
      else if (!(byId.get(n).neighbours ?? []).includes(l.id)) err(`${w}: neighbour ${n} not symmetric`);
    }
    for (const k of ['aliases', 'pincodes', 'landmarks', 'commercial_centres', 'office_clusters', 'residential_clusters', 'construction_facts', 'food_notes']) if (!Array.isArray(l[k])) err(`${w}: ${k} must be an array`);
    (l.construction_facts ?? []).forEach((f, i) => checkFact(f, `${w}.construction_facts[${i}]`));
    if (!l.i18n || !('mr' in l.i18n) || !('hi' in l.i18n)) err(`${w}: i18n.mr/hi keys missing`);
  }
}

// --- facts coverage (merged into localities or still in the staging file) ---
const staged = existsSync(join(root, factsFile)) ? readJson(factsFile) : null;
const factsFor = (id) => [...((Array.isArray(locs) ? locs.find((l) => l.id === id)?.construction_facts : null) ?? []), ...((staged && staged[id]) ?? [])];
if (staged) for (const [id, facts] of Object.entries(staged)) facts.forEach((f, i) => checkFact(f, `${factsFile}[${id}][${i}]`));
const coverage = [];
for (const loc of PRIORITY) {
  const facts = factsFor(loc);
  const row = { locality: loc };
  for (const s of TOP_SERVICES) {
    const subs = [s, ...(SUB_SERVICES[s] ?? [])];
    row[s] = facts.filter((f) => (f.services ?? []).some((x) => subs.includes(x))).length;
    if (row[s] < 3) warn(`facts: ${loc} × ${s} has ${row[s]} (< 3) — gate path (c) not met`);
  }
  coverage.push(row);
}

// --- dishes ---
const dishes = readJson('data/dishes.json');
if (Array.isArray(dishes)) {
  const ids = new Set(dishes.map((d) => d.id));
  for (const id of DISHES) if (!ids.has(id)) err(`dishes: missing ${id}`);
  const variants = dishes.filter((d) => d.parent_id);
  if (variants.length > 12) err(`dishes: ${variants.length} variants (> 12)`);
  for (const d of dishes) {
    const w = `dishes[${d.id}]`;
    if (RESERVED.test(d.id)) err(`${w}: reserved slug`);
    if (d.parent_id && (!ids.has(d.parent_id) || !d.id.endsWith(`-${d.parent_id}`))) err(`${w}: variant id must be {variant}-{parent}`);
    if (!DISHES.includes(d.id) && !d.parent_id) err(`${w}: unknown top-level dish`);
    if (!Array.isArray(d.price_bands_inr) || d.price_bands_inr.some((b, i, a) => !Number.isInteger(b) || (i && b <= a[i - 1]))) err(`${w}: price_bands_inr must be ascending integers`);
    if (!(d.price_sanity_inr?.min < d.price_sanity_inr?.max)) err(`${w}: price_sanity_inr invalid`);
    if (!['veg', 'non_veg', 'egg', 'both'].includes(d.diet)) err(`${w}: bad diet`);
  }
  const cravings = new Set(dishes.flatMap((d) => d.cravings ?? []));
  for (const c of ['spicy', 'sweet']) if (!cravings.has(c)) err(`dishes: craving '${c}' not covered`);
}

// --- service packs and cost models ---
const modelCells = {};
for (const s of TOP_SERVICES) {
  const def = readJson(`data/services/${s}.json`);
  if (def) {
    if (def.id !== s) err(`services/${s}: id mismatch`);
    const subIds = (def.sub_services ?? []).map((x) => x.id);
    for (const sub of SUB_SERVICES[s] ?? []) if (!subIds.includes(sub)) err(`services/${s}: missing sub-service ${sub}`);
    for (const k of ['questions_to_ask', 'common_mistakes']) if ((def[k] ?? []).length < 6) err(`services/${s}: ${k} < 6`);
    if ((def.faq ?? []).length < 5) err(`services/${s}: faq < 5`);
  }
  const models = readJson(`data/cost-models/${s}.json`);
  if (!Array.isArray(models)) continue;
  const ids = new Set();
  for (const m of models) {
    const w = `cost-models/${s}[${m.id}]`;
    if (ids.has(m.id)) err(`${w}: duplicate id`); ids.add(m.id);
    if (![s, ...(SUB_SERVICES[s] ?? [])].includes(m.service_id)) err(`${w}: service_id ${m.service_id} not in this pack`);
    if (!TIERS.includes(m.tier)) err(`${w}: bad tier`);
    const r = m.rate_inr ?? {};
    if (![r.low, r.expected, r.high].every(Number.isInteger) || !(r.low <= r.expected && r.expected <= r.high)) err(`${w}: rate_inr must be integers with low ≤ expected ≤ high`);
    const sum = Object.values(m.components ?? {}).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > 0.01) err(`${w}: components sum ${sum.toFixed(3)} ≠ 1`);
    const publishers = new Set((m.sources ?? []).map((x) => (x.publisher ?? '').trim().toLowerCase()));
    if ((m.sources ?? []).length < 2 || publishers.size < 2) err(`${w}: needs ≥ 2 sources from different publishers`);
    (m.sources ?? []).forEach((x, i) => checkSourceRef(x, `${w}.sources[${i}]`));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m.valid_until ?? '')) err(`${w}: valid_until missing`);
    modelCells[`${m.service_id}|${m.tier}`] = (modelCells[`${m.service_id}|${m.tier}`] ?? 0) + 1;
  }
}
const missingCells = ALL_SERVICES.flatMap((s) => TIERS.filter((t) => !modelCells[`${s}|${t}`]).map((t) => `${s}/${t}`));
for (const c of missingCells) warn(`cost models: no model for ${c} — that cost guide cannot pass the gate`);

// --- configs, CSV templates, guides ---
for (const f of ['seasonal-calendar', 'lead-pricing', 'gate', 'ad-slots', 'experiments', 'aggregators']) readJson(`data/${f}.json`);
const CSV = {
  'places.csv': 'name,kind,locality_id,address,lat,lng,phone,website,cuisines,diet,price_level,service_modes,opening_hours,tags,source_url,retrieved_at,valid_until',
  'place_dishes.csv': 'place_name,locality_id,dish_id,variant_label,price_inr,source_url,retrieved_at,valid_until',
  'providers.csv': 'name,locality_id,address,phone,website,services,service_localities,specializations,experience_years,accepts_leads,min_job_inr,source_url,retrieved_at',
  'experiences.csv': 'place_name,locality_id,visited_at,dish_id,price_paid_inr,rating,would_recommend,tags,notes',
  'local_facts.csv': 'locality_id,topic,services,text,source_url,source_title,publisher,retrieved_at',
};
for (const [f, header] of Object.entries(CSV)) {
  const p = join(root, 'data/curation', f);
  if (!existsSync(p)) { err(`missing data/curation/${f}`); continue; }
  const lines = readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean);
  if (lines[0] !== header) err(`data/curation/${f}: header differs from CONTRACTS §6`);
  if (lines.slice(1).filter((l) => l.startsWith('EXAMPLE') || l.startsWith('"EXAMPLE')).length !== 1) err(`data/curation/${f}: needs exactly one EXAMPLE row`);
}
const guideDir = join(root, 'content/locality-guides');
const guides = existsSync(guideDir) ? readdirSync(guideDir).filter((f) => f.endsWith('.md')) : [];
for (const loc of PRIORITY) if (!guides.includes(`${loc}.md`)) err(`content/locality-guides/${loc}.md missing`);
for (const g of guides) {
  const text = readFileSync(join(guideDir, g), 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) { err(`${g}: frontmatter missing`); continue; }
  if (!/status:\s*(draft|reviewed)/.test(m[1])) err(`${g}: frontmatter status missing`);
  const words = m[2].replace(/<!--[\s\S]*?-->/g, '').split(/\s+/).filter(Boolean).length;
  if (words < 400) err(`${g}: ${words} body words (< 400)`);
}

// --- report ---
console.log('\nFacts coverage (priority locality × top-level service, need ≥ 3 each):');
console.table(coverage);
console.log(`Cost-model coverage: ${ALL_SERVICES.length * TIERS.length - missingCells.length}/${ALL_SERVICES.length * TIERS.length} service×tier cells filled`);
for (const w of warnings) console.log(`WARN  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`\n${errors.length} error(s), ${warnings.length} coverage warning(s)`);
process.exit(errors.length ? 1 : 0);
