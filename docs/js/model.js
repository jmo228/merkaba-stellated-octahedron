// Builds everything the pages need (hub/tube world positions, pixel positions,
// DMX chain, universe/address map, dimensions, power, mass) from data/merkaba.json.
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
// Splits the 36 tubes into daisy-chain trails (each tube's data flows from the hub where
// the trail enters it to the hub where it leaves). Tips have 3 tubes (odd), so trails
// start and end at tips; virtual pairs join tips to make an Euler circuit we can cut.
function planChain(data) {
  const tubes = data.geometry.tubes;
  const edges = tubes.map((t, i) => ({ i, a: t.from, b: t.to, virtual: false, id: t.id }));
  data.dmx.virtualPairs.forEach(([a, b], k) => edges.push({ i: edges.length, a, b, virtual: true, id: `V${k}` }));
  const adj = {};
  for (const e of edges) {
    (adj[e.a] ||= []).push(e);
    (adj[e.b] ||= []).push(e);
  }
  for (const k in adj) adj[k].sort((x, y) => (x.virtual - y.virtual) || x.id.localeCompare(y.id));
  const used = new Array(edges.length).fill(false);
  const start = data.dmx.virtualPairs[0][0];
  const stack = [{ v: start, step: null }];
  const circuit = [];
  while (stack.length) {
    const top = stack[stack.length - 1];
    const next = adj[top.v].find(e => !used[e.i]);
    if (next) {
      used[next.i] = true;
      const other = next.a === top.v ? next.b : next.a;
      stack.push({ v: other, step: { e: next, from: top.v, to: other } });
    } else {
      stack.pop();
      if (top.step) circuit.push(top.step);
    }
  }
  circuit.reverse();
  // rotate so the circuit begins right after a virtual edge, then cut on virtual edges
  const firstV = circuit.findIndex(s => s.e.virtual);
  const rot = firstV >= 0 ? circuit.slice(firstV + 1).concat(circuit.slice(0, firstV + 1)) : circuit;
  const trails = [];
  let cur = [];
  for (const s of rot) {
    if (s.e.virtual) { if (cur.length) trails.push(cur); cur = []; }
    else cur.push({ tubeIndex: s.e.i, from: s.from, to: s.to });
  }
  if (cur.length) trails.push(cur);
  return trails;
}

export function buildModel(data, variantId) {
  const variant = data.variants.find(v => v.id === variantId) || data.variants.find(v => v.id === data.defaultVariant);
  const L = variant.tubeLengthM;
  const n = variant.pixelsPerTube;
  const off = data.hub.centreToTubeEndMm / 1000;
  const edge = L + 2 * off;                 // hub centre to hub centre
  const scale = edge / Math.SQRT2;          // metres per cube unit
  const toWorld = orientBasis(data.geometry.upAxis);

  const hubs = data.geometry.hubs.map(h => ({ ...h, world: mul(toWorld(h.pos), scale), tubes: [] }));
  const hubById = Object.fromEntries(hubs.map(h => [h.id, h]));
  const tubes = data.geometry.tubes.map((t, i) => ({ ...t, index: i }));
  tubes.forEach(t => { hubById[t.from].tubes.push(t.id); hubById[t.to].tubes.push(t.id); });

  // chain + universes
  const trails = planChain(data);
  const chain = [];
  trails.forEach((tr, r) => tr.forEach(s => chain.push({ ...s, trail: r })));
  const chPerTube = n * data.dmx.channelsPerPixel;
  const perU = Math.max(1, Math.floor(data.dmx.channelsPerUniverse / chPerTube));
  const nU = Math.ceil(chain.length / perU);
  const base = Math.floor(chain.length / nU), extra = chain.length % nU;
  const universes = [];
  let k = 0;
  for (let u = 0; u < nU; u++) {
    const count = base + (u < extra ? 1 : 0);
    const items = chain.slice(k, k + count);
    let addr = data.dmx.firstAddress;
    items.forEach((c, j) => {
      const tube = tubes[c.tubeIndex];
      c.universe = u + 1;
      c.position = j + 1;
      c.startAddress = addr;
      c.endAddress = addr + chPerTube - 1;
      c.feed = j === 0 ? 'controller' : (items[j - 1].to === c.from ? 'chain' : 'jumper');
      c.prevHub = j === 0 ? null : items[j - 1].to;
      tube.dmx = c;
      addr += chPerTube;
    });
    universes.push({ number: u + 1, items, channelsUsed: count * chPerTube, jumpers: items.filter(c => c.feed === 'jumper').length });
    k += count;
  }

  // pixels in global DMX order (universe, then address)
  const pixels = [];
  chain.forEach((c, order) => {
    const t = tubes[c.tubeIndex];
    const a = hubById[c.from].world, b = hubById[c.to].world;
    const dir = norm(sub(b, a));
    for (let p = 0; p < n; p++) {
      const d = off + (p + 0.5) / n * L;
      pixels.push({ pos: add(a, mul(dir, d)), dir, tube: t.id, tubeIndex: t.index, shape: t.shape, order, local: p, tubeT: (p + 0.5) / n });
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

  // power + mass
  const w = data.tube.wattsPerMetreFullWhite * L * tubes.length;
  const supplyW = data.power.supplyVolts * data.power.supplyAmps;
  const usableW = supplyW * data.power.continuousLoadPct / 100;
  const power = {
    fullWhiteW: w,
    fullWhiteA: w / data.tube.voltageV,
    perTubeW: data.tube.wattsPerMetreFullWhite * L,
    perPixelW: data.tube.wattsPerMetreFullWhite * L / n,
    supplyW, usableW,
    maxBrightness: Math.min(1, usableW / w),
    ok: w <= usableW,
  };
  const massKg = tubes.length * L * data.tube.massKgPerMetre + hubs.length * data.hub.massKg;

  return {
    data, variant, hubs, hubById, tubes, chain, trails, universes, pixels, dims, power,
    mass: { totalKg: massKg, perWinchKg: massKg / data.rig.winches.length },
    dmx: { channelsPerTube: chPerTube, tubesPerUniverseMax: perU, universeCount: nU, totalChannels: chain.length * chPerTube, totalPixels: chain.length * n },
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
