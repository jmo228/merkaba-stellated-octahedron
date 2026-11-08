// Builds everything the pages need (hub/tube world positions, pixel positions,
// DMX chain with globe heads, universe/address map, nodes, power per tie point, mass)
// from data/merkaba.json.
// No Three.js here, so the specs and wiring pages stay light.

const DATA_URL = new URL('../data/merkaba.json', import.meta.url);
let cache = null;

export async function loadData() {
  if (!cache) {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`Could not load merkaba.json (${res.status})`);
    cache = await res.json();
  }
  return cache;
}

export async function loadJSON(name) {
  const res = await fetch(new URL(`../data/${name}`, import.meta.url));
  if (!res.ok) throw new Error(`Could not load ${name} (${res.status})`);
  return res.json();
}

// ---- remembered variant (shared between pages, per browser) ----
const KEY = 'merkaba.variant';
export function savedVariant(data) {
  try {
    const v = localStorage.getItem(KEY);
    if (v && data.variants.some(x => x.id === v)) return v;
  } catch (e) { /* storage unavailable */ }
  return data.defaultVariant;
}
export function saveVariant(id) {
  try { localStorage.setItem(KEY, id); } catch (e) { /* ignore */ }
}

// ---- vector helpers ----
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => Math.sqrt(dot(a, a));
const norm = a => mul(a, 1 / len(a));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// World frame: metres, +Y up, origin at the sculpture centre.
function orientBasis(upAxis) {
  const u = norm(upAxis);
  let e1 = Math.abs(u[2]) < 0.9 ? cross([0, 0, 1], u) : cross([1, 0, 0], u);
  // prefer a stable, readable x axis for the default [1,1,1] axis
  if (upAxis[0] === upAxis[1] && upAxis[1] === upAxis[2]) e1 = [1, -1, 0];
  e1 = norm(e1);
  const e2 = norm(cross(e1, u));
  return p => [dot(p, e1), dot(p, u), dot(p, e2)];
}

// ---- DMX chain planner ----
// Every universe starts at a tie-point (middle) hub, where that tie point's DMX node and
// power feed are, and runs outward to a tip. A universe is one or more "runs": a run is a
// trail of tubes that plug into each other at shared hubs, from a middle hub out to a tip.
// When a universe holds more than one run, an XLR jumper links the tip where one run ends
// to the middle hub where the next one starts. Tubes and heads are never split across universes.
// The planner tries many random splits (seeded, so the result is the same every time) and
// keeps the best one: fewest node outputs over capacity, then supplies over their continuous
// rating, universes, jumpers, worst supply load and total jumper length.

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pickOne = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];

// split all tubes into runs, each from a middle hub out to a tip, at most maxTubes long
function randomRuns(ctx, rnd, maxTubes, stopChance) {
  const { tubes, adj, type, middles } = ctx;
  const used = new Array(tubes.length).fill(false);
  const deg = {};
  for (const k in adj) deg[k] = adj[k].length;
  let left = tubes.length;
  const runs = [];
  while (left) {
    const mids = middles.filter(h => deg[h] > 0);
    if (!mids.length) return null;                       // only tip-to-tip tubes left: no valid start
    const odd = mids.filter(h => deg[h] % 2);            // an odd middle must start another run
    let cur = pickOne(odd.length ? odd : mids, rnd);
    const run = [];
    for (;;) {
      const opts = adj[cur].filter(i => !used[i]);
      if (!opts.length) break;
      if (type[cur] === 'tip' && run.length && (run.length >= maxTubes || rnd() < stopChance)) break;
      if (run.length >= maxTubes) return null;
      const i = pickOne(opts, rnd);
      const t = tubes[i];
      const to = t.from === cur ? t.to : t.from;
      used[i] = true; left--; deg[cur]--; deg[to]--;
      run.push({ tubeIndex: i, from: cur, to });
      cur = to;
    }
    if (!run.length || type[cur] !== 'tip') return null; // runs must end at a tip
    runs.push(run);
  }
  return runs;
}

// the chain items one run adds, with heads patched in where the run passes their hub
function runItems(ctx, run, placed) {
  const items = [];
  const local = new Set();
  const has = h => placed.has(h) || local.has(h);
  for (const s of run) {
    if (ctx.headsInChain && ctx.type[s.from] === 'middle' && !has(s.from)) {
      local.add(s.from); items.push({ kind: 'head', hub: s.from });
    }
    items.push({ kind: 'tube', ...s });
  }
  const end = run[run.length - 1].to;
  if (ctx.headsInChain && !has(end)) { local.add(end); items.push({ kind: 'head', hub: end }); }
  return { items, local };
}

const itemCh = (ctx, it) => it.kind === 'tube' ? ctx.chPerTube : ctx.chPerHead;
const itemW = (ctx, it) => it.kind === 'tube' ? ctx.tubeW : ctx.headW;

// heads on a universe of their own: middle hubs first (nearest next), then the tips, so it
// starts at a tie point and ends at a tip like every other universe
function headsUniverse(ctx, startHub) {
  const order = [startHub];
  const left = new Set(ctx.hubIds.filter(h => h !== startHub));
  const nearest = (from, pool) => pool.reduce((b, h) => (ctx.dist(from, h) < ctx.dist(from, b) ? h : b));
  for (const kind of ['middle', 'tip']) {
    for (;;) {
      const pool = [...left].filter(h => ctx.type[h] === kind);
      if (!pool.length) break;
      const next = nearest(order[order.length - 1], pool);
      order.push(next); left.delete(next);
    }
  }
  return order;
}

function packRuns(ctx, runs, rnd) {
  // group runs by the tie point they start at (random order inside a group)
  const order = runs.map(r => ({ r, k: ctx.tieOf[r[0].from] * 10 + rnd() })).sort((a, b) => a.k - b.k).map(x => x.r);
  const placed = new Set();
  const universes = [];
  let cur = null;
  for (const run of order) {
    const { items, local } = runItems(ctx, run, placed);
    const ch = items.reduce((s, it) => s + itemCh(ctx, it), 0);
    if (ch > ctx.perUniverse) return null;
    if (!cur || cur.ch + ch > ctx.perUniverse) { cur = { runs: [], items: [], ch: 0 }; universes.push(cur); }
    cur.runs.push(run); cur.items.push(...items); cur.ch += ch;
    local.forEach(h => placed.add(h));
  }
  const plan = universes.map(u => ({
    kind: ctx.headsInChain ? 'mixed' : 'tubes',
    runs: u.runs, items: u.items,
    startHub: u.runs[0][0].from,
    tie: ctx.tieOf[u.runs[0][0].from],
  }));
  if (!ctx.headsInChain) {
    // heads universe starts at the tie point with the fewest universes so far
    const counts = ctx.tiePoints.map((_, k) => plan.filter(u => u.tie === k).length);
    const k = counts.indexOf(Math.min(...counts));
    const startHub = ctx.tiePoints[k].hubs[0];
    const hubs = headsUniverse(ctx, startHub);
    plan.push({ kind: 'heads', runs: [], items: hubs.map(h => ({ kind: 'head', hub: h })), startHub, tie: k });
  }
  return plan;
}

function scorePlan(ctx, plan) {
  const perTie = ctx.tiePoints.map(() => ({ n: 0, w: 0 }));
  let jumpers = 0, jumperLen = 0;
  for (const u of plan) {
    perTie[u.tie].n++;
    perTie[u.tie].w += u.items.reduce((s, it) => s + itemW(ctx, it), 0);
    for (let i = 1; i < u.runs.length; i++) {
      jumpers++;
      jumperLen += ctx.dist(u.runs[i - 1][u.runs[i - 1].length - 1].to, u.runs[i][0].from);
    }
  }
  const overflow = perTie.reduce((s, t) => s + Math.max(0, t.n - ctx.outputsPerNode), 0);
  const overSupply = perTie.filter(t => t.w > ctx.supplyUsableW).length;
  const maxW = Math.max(...perTie.map(t => t.w));
  return [overflow, overSupply, plan.length, jumpers, Math.round(maxW / 10), jumperLen];
}
const better = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false; };

function planChain(ctx) {
  const rnd = seeded(ctx.seed);
  let best = null, bestScore = null;
  const headCost = ctx.headsInChain ? 2 * ctx.chPerHead : 0;
  const maxTubes = Math.max(1, Math.floor((ctx.perUniverse - headCost) / ctx.chPerTube));
  for (let i = 0; i < ctx.tries; i++) {
    const stop = 0.1 + 0.6 * rnd();
    const runs = randomRuns(ctx, rnd, maxTubes, stop);
    if (!runs) continue;
    const plan = packRuns(ctx, runs, rnd);
    if (!plan) continue;
    const sc = scorePlan(ctx, plan);
    if (!best || better(sc, bestScore)) { best = plan; bestScore = sc; }
  }
  if (!best) throw new Error('DMX planner found no valid layout. Check the tube size and channels per universe.');
  // number universes by tie point, then start hub
  best.sort((a, b) => (a.kind === 'heads') - (b.kind === 'heads') || a.tie - b.tie || a.startHub.localeCompare(b.startHub));
  return best;
}

const planCache = new Map();

export function buildModel(data, variantId, opts = {}) {
  const variant = data.variants.find(v => v.id === variantId) || data.variants.find(v => v.id === data.defaultVariant);
  const L = variant.tubeLengthM;
  const n = variant.pixelsPerTube;
  const off = data.hub.centreToTubeEndMm / 1000;
  const edge = L + 2 * off;                 // hub centre to hub centre
  const scale = edge / Math.SQRT2;          // metres per cube unit
  const toWorld = orientBasis(data.geometry.upAxis);
  const gh = data.globeHead;
  const placement = opts.headPlacement || data.dmx.headPlacement || 'inChain';

  const hubs = data.geometry.hubs.map(h => ({ ...h, world: mul(toWorld(h.pos), scale), tubes: [] }));
  const hubById = Object.fromEntries(hubs.map(h => [h.id, h]));
  const tubes = data.geometry.tubes.map((t, i) => ({ ...t, index: i }));
  tubes.forEach(t => { hubById[t.from].tubes.push(t.id); hubById[t.to].tubes.push(t.id); });

  // tie points = winches: each holds a DMX node and a power supply feeding its two middle hubs
  const p = data.power;
  const supplyW = p.supplyVolts * p.supplyAmps * (p.suppliesPerTiePoint || 1);
  const supplyUsableW = supplyW * p.continuousLoadPct / 100;
  const tiePoints = data.rig.winches.map((w, k) => ({ id: w.id, index: k, hubs: w.hubs, node: `N${k + 1}`, supply: `PSU${k + 1}` }));
  const tieOf = {};
  tiePoints.forEach(tp => tp.hubs.forEach(h => { tieOf[h] = tp.index; }));

  // ---- chain + universes ----
  const chPerTube = n * data.dmx.channelsPerPixel;
  const chPerHead = gh.channels.length;
  const tubeW = data.tube.wattsPerMetreFullWhite * L;
  const adj = {};
  tubes.forEach((t, i) => { (adj[t.from] ||= []).push(i); (adj[t.to] ||= []).push(i); });
  const ctx = {
    tubes, adj, chPerTube, chPerHead, tubeW, headW: gh.watts,
    type: Object.fromEntries(hubs.map(h => [h.id, h.type])),
    hubIds: hubs.map(h => h.id),
    middles: hubs.filter(h => h.type === 'middle').map(h => h.id),
    dist: (a, b) => len(sub(hubById[a].world, hubById[b].world)),
    tiePoints, tieOf,
    perUniverse: data.dmx.channelsPerUniverse,
    headsInChain: placement === 'inChain',
    outputsPerNode: data.dmx.nodes.outputs,
    supplyUsableW,
    seed: data.dmx.plannerSeed ?? 1,
    tries: data.dmx.plannerTries ?? 4000,
  };
  const key = `${variant.id}|${placement}|${ctx.seed}|${ctx.tries}`;
  if (!planCache.has(key)) planCache.set(key, planChain(ctx));
  const plan = planCache.get(key);

  const chain = [];
  const universes = plan.map((u, k) => {
    const number = k + 1;
    let addr = data.dmx.firstAddress;
    const jumpers = [];
    const items = u.items.map((src, j) => {
      const c = { ...src, universe: number, position: j + 1, tie: u.tie };
      c.channels = itemCh(ctx, c);
      c.startAddress = addr;
      c.endAddress = addr + c.channels - 1;
      addr += c.channels;
      const prev = j ? u.items[j - 1] : null;
      const prevHub = prev ? (prev.kind === 'tube' ? prev.to : prev.hub) : null;
      const here = c.kind === 'tube' ? c.from : c.hub;
      c.prevHub = prevHub;
      if (!prev) c.feed = 'node';
      else if (c.kind === 'head' && u.kind === 'heads') { c.feed = 'link'; c.linkM = ctx.dist(prevHub, here); }
      else if (prevHub === here) c.feed = c.kind === 'head' ? 'patch' : (prev.kind === 'head' ? 'head' : 'chain');
      else { c.feed = 'jumper'; c.jumperM = ctx.dist(prevHub, here); jumpers.push({ from: prevHub, to: here, lengthM: c.jumperM }); }
      chain.push(c);
      return c;
    });
    const last = items[items.length - 1];
    return {
      number, kind: u.kind, items, tie: u.tie,
      startHub: u.startHub,
      endHub: last.kind === 'tube' ? last.to : last.hub,
      channelsUsed: addr - data.dmx.firstAddress,
      tubes: items.filter(c => c.kind === 'tube').length,
      heads: items.filter(c => c.kind === 'head').length,
      watts: items.reduce((s, c) => s + itemW(ctx, c), 0),
      jumpers,
    };
  });
  chain.forEach((c, i) => { c.order = i; if (c.kind === 'tube') tubes[c.tubeIndex].dmx = c; });
  const heads = hubs.map(h => chain.find(c => c.kind === 'head' && c.hub === h.id)).map((c, i) => ({ ...c, hubType: hubs[i].type, index: i }));
  const headByHub = Object.fromEntries(heads.map(h => [h.hub, h]));

  // nodes: each tie point's node drives the universes that start there, one output each
  tiePoints.forEach(tp => {
    tp.universes = universes.filter(u => u.tie === tp.index);
    tp.universes.forEach((u, k) => { u.node = tp.node; u.output = k + 1; });
    tp.outputsNeeded = tp.universes.length;
    tp.outputsShort = Math.max(0, tp.universes.length - data.dmx.nodes.outputs);
    tp.loadW = tp.universes.reduce((s, u) => s + u.watts, 0);
    tp.loadA = tp.loadW / p.supplyVolts;
    tp.loadPct = tp.loadW / supplyW;
    tp.over = tp.loadW > supplyUsableW;
    const fc = p.feedCable;
    tp.feedDropV = tp.loadA * 2 * fc.lengthM * fc.ohmsPerMetre;
    tp.feedDropPct = tp.feedDropV / p.supplyVolts;
  });

  // pixels in global DMX order (universe, then address); heads take chain slots but no pixels
  const pixels = [];
  chain.forEach(c => {
    if (c.kind !== 'tube') return;
    const t = tubes[c.tubeIndex];
    const a = hubById[c.from].world, b = hubById[c.to].world;
    const dir = norm(sub(b, a));
    for (let q = 0; q < n; q++) {
      const d = off + (q + 0.5) / n * L;
      pixels.push({ pos: add(a, mul(dir, d)), dir, tube: t.id, tubeIndex: t.index, shape: t.shape, order: c.order, local: q, tubeT: (q + 0.5) / n, tie: c.tie });
    }
  });

  // dimensions
  const ys = hubs.map(h => h.world[1]);
  let width = 0;
  for (const h1 of hubs) for (const h2 of hubs) {
    width = Math.max(width, Math.hypot(h1.world[0] - h2.world[0], h1.world[2] - h2.world[2]));
  }
  const dims = {
    tubeLengthM: L,
    edgeCentreToCentreM: edge,
    tetraEdgeM: 2 * edge,
    boundingCubeM: Math.SQRT2 * edge,
    heightM: Math.max(...ys) - Math.min(...ys),
    widthM: width,
    totalTubeLengthM: tubes.length * L,
  };

  // power: tubes + heads, one supply per tie point
  const tubesW = tubeW * tubes.length;
  const headsW = gh.watts * heads.length;
  const w = tubesW + headsW;
  const worst = Math.max(...tiePoints.map(tp => tp.loadW));
  const power = {
    fullWhiteW: w, tubesW, headsW,
    fullWhiteA: w / data.tube.voltageV,
    perTubeW: tubeW,
    perPixelW: tubeW / n,
    perHeadW: gh.watts,
    supplyCount: tiePoints.length,
    supplyW,                                     // one supply
    supplyUsableW,                               // one supply, continuous
    usableW: supplyUsableW * tiePoints.length,   // all supplies, continuous
    tiePoints,
    maxBrightness: Math.min(1, supplyUsableW / worst),
    ok: tiePoints.every(tp => !tp.over),
  };
  const massKg = tubes.length * L * data.tube.massKgPerMetre + hubs.length * data.hub.massKg + heads.length * gh.massKg;

  const jumpers = universes.flatMap(u => u.jumpers);
  return {
    data, variant, hubs, hubById, tubes, chain, universes, heads, headByHub, pixels, dims, power, tiePoints,
    headPlacement: placement,
    mass: { totalKg: massKg, perWinchKg: massKg / data.rig.winches.length },
    dmx: {
      channelsPerTube: chPerTube, channelsPerHead: chPerHead,
      tubesPerUniverseMax: Math.floor(data.dmx.channelsPerUniverse / chPerTube),
      universeCount: universes.length,
      totalChannels: chain.reduce((s, c) => s + c.channels, 0),
      totalPixels: tubes.length * n,
      jumpers,
      nodeCount: tiePoints.length,
      outputsAvailable: tiePoints.length * data.dmx.nodes.outputs,
      outputsShort: tiePoints.reduce((s, tp) => s + tp.outputsShort, 0),
    },
  };
}

export const fmt = {
  m: v => `${v.toFixed(2)} m`,
  mm: v => `${Math.round(v * 1000)} mm`,
  w: v => `${Math.round(v)} W`,
  a: v => `${v.toFixed(1)} A`,
  kg: v => `${v.toFixed(1)} kg`,
  pct: v => `${Math.round(v * 100)}%`,
};
