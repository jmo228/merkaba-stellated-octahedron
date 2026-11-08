// Hub fixtures: a snap-together frosted globe around each ball joint, lit from inside by a
// small DMX head. The globe is perforated: holes spread evenly over the shell (skipping the
// ports where tubes enter) let narrow beams shine straight out from the centre, while the
// rest of the shell glows as a diffuser. A beam through a hole from a central source spreads
// by about atan(hole radius / globe radius), so hole size sets the beam width.
// Each head is a DMX fixture with the channel layout from merkaba.json (globeHead.channels),
// and sits in the address map built by model.js. The panel's colour modes (follow the
// nearest LED pixels, one fixed colour, or white) are written into those channels, and
// the globes are drawn from the channel values, so an effect can drive a head directly.
// Tip and middle hubs have their own globe sizes.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const MAX_HOLES = 96;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

// ---- globe shell: diffuse glow, with the holes showing as bright hot spots ----
const globeVS = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    vLocal = normalize(position);
    gl_Position = projectionMatrix * mv;
  }
`;
const globeFS = /* glsl */`
  #define MAX_HOLES ${MAX_HOLES}
  uniform vec3 uColor;
  uniform vec3 uShell;
  uniform vec3 uHoles[MAX_HOLES];
  uniform int uHoleCount;
  uniform float uHoleCos;      // cos of the hole's angular radius
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;
  void main() {
    float facing = abs(dot(vNormal, vView));
    float hole = 0.0;
    for (int i = 0; i < MAX_HOLES; i++) {
      if (i >= uHoleCount) break;
      float d = dot(vLocal, uHoles[i]);
      hole = max(hole, smoothstep(uHoleCos - 0.002, uHoleCos + 0.002, d));
    }
    float glow = 0.35 + 0.45 * pow(facing, 1.4);        // light through the frosted plastic
    float rim = pow(1.0 - facing, 3.0) * 0.25;
    vec3 shell = uColor * glow + uShell * (0.6 + rim * 4.0);
    vec3 col = mix(shell, uColor * 2.2 + 0.05, hole);    // looking through a hole at the head
    gl_FragColor = vec4(col, 0.9);
  }
`;

// ---- beams: instanced additive haze cones, one per hole ----
const beamVS = /* glsl */`
  varying float vAlong;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vAlong = uv.y;                                       // 0 at the hole, 1 at the far end
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const beamFS = /* glsl */`
  uniform vec3 uColor;
  uniform float uIntensity;
  varying float vAlong;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float soft = pow(abs(dot(vNormal, vView)), 1.6);
    float a = uIntensity * soft * pow(1.0 - vAlong, 1.8);
    gl_FragColor = vec4(uColor * a, a);
  }
`;

// evenly spread points on a sphere (Fibonacci), minus any within `clearRad` of a tube port
function holeDirections(count, ports, clearRad) {
  const out = [];
  const clearCos = Math.cos(clearRad);
  // generate extra points so roughly `count` survive after clearing the ports
  for (let n = count; n <= count * 3 && out.length < count; n += Math.max(1, Math.round(count * 0.1))) {
    out.length = 0;
    for (let i = 0; i < n; i++) {
      const y = 1 - (i + 0.5) / n * 2, r = Math.sqrt(1 - y * y), th = GOLDEN * i;
      const d = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
      if (ports.every(p => p.dot(d) < clearCos)) out.push(d);
    }
  }
  return out.slice(0, Math.min(count, MAX_HOLES));
}

// fog/haze in the room: with none the beams are barely visible, in thick fog they glow.
// Hundreds of additive beams overlap near the centre, so the per-beam level is scaled down
// as the total beam count rises; without that, heavy fog turned the whole view white.
const fogToHaze = (f, beams) => (0.012 + 0.45 * Math.pow(f, 1.4)) * Math.min(1, Math.sqrt(120 / Math.max(1, beams)));
// UV shows as a deep violet in fog; white adds equally to R, G and B
const UV_TINT = [0.32, 0.08, 1.0];

export function createFixtures(parent) {
  const group = new THREE.Group();
  parent.add(group);

  const globeGeo = new THREE.SphereGeometry(1, 64, 40);

  const settings = {
    globes: true, where: 'all', globeMmTip: 160, globeMmMid: 200,
    colorMode: 'follow', color: [1, 1, 1],
    holes: 32, holeMm: 12, beams: true, beamLengthM: 3, fog: 0.5, white: 0, uv: 0,
  };
  let model = null, items = [];

  // DMX frame for the 14 heads, in the channel layout from merkaba.json (globeHead.channels).
  // The panel controls write it (encode), effects such as the address test can write it
  // directly (heads.active = true), and the globes are drawn from it (decode).
  const heads = { count: 0, channels: [], ch: {}, values: new Float32Array(0), active: false };
  function setLayout(m) {
    heads.channels = m.data.globeHead.channels;
    heads.ch = Object.fromEntries(heads.channels.map((name, i) => [name, i]));
    heads.count = m.heads.length;
    heads.values = new Float32Array(heads.count * heads.channels.length);
  }
  const chVal = (base, name, fallback) => (name in heads.ch ? heads.values[base + heads.ch[name]] : fallback);
  const chSet = (base, name, v) => { if (name in heads.ch) heads.values[base + heads.ch[name]] = v; };

  function clear() {
    for (const it of items) { it.globe.material.dispose(); it.beams.material.dispose(); it.beams.dispose(); }
    group.clear();
    items = [];
  }

  const globeMm = type => (type === 'tip' ? settings.globeMmTip : settings.globeMmMid);

  function build() {
    clear();
    if (!model) return;
    const near = model.variant.tubeLengthM * 0.25 + model.data.hub.centreToTubeEndMm / 1000;
    const hubs = model.hubs.filter(h => settings.where === 'all' || h.type === 'tip');

    for (const hub of hubs) {
      const R = globeMm(hub.type) / 2000;
      const holeAng = Math.atan((settings.holeMm / 2000) / R);
      const portClear = Math.asin(Math.min(1, (model.data.tube.diameterMm / 2000) / R)) + holeAng + 0.12;
      const centre = new THREE.Vector3(...hub.world);
      const ports = model.tubes.filter(t => t.from === hub.id || t.to === hub.id).map(t => {
        const other = model.hubById[t.from === hub.id ? t.to : t.from];
        return new THREE.Vector3(...other.world).sub(centre).normalize();
      });
      const dirs = settings.holes > 0 ? holeDirections(settings.holes, ports, portClear) : [];

      const holeUniform = Array.from({ length: MAX_HOLES }, (_, i) => dirs[i] ? dirs[i].clone() : new THREE.Vector3(0, 0, 0));
      const globe = new THREE.Mesh(globeGeo, new THREE.ShaderMaterial({
        vertexShader: globeVS, fragmentShader: globeFS,
        uniforms: {
          uColor: { value: new THREE.Color(0, 0, 0) },
          uShell: { value: new THREE.Color(0.05, 0.055, 0.065) },
          uHoles: { value: holeUniform },
          uHoleCount: { value: dirs.length },
          uHoleCos: { value: Math.cos(holeAng) },
        },
        transparent: true, depthWrite: false, toneMapped: false,
      }));
      globe.position.copy(centre);
      globe.scale.setScalar(R);
      globe.renderOrder = 5;

      const beams = new THREE.InstancedMesh(beamGeometry(0.01, 0.1), new THREE.ShaderMaterial({
        vertexShader: beamVS, fragmentShader: beamFS,
        uniforms: { uColor: { value: new THREE.Color(0, 0, 0) }, uIntensity: { value: 0 } },
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, toneMapped: false,
      }), Math.max(1, dirs.length));
      beams.count = dirs.length;
      beams.frustumCulled = false;
      beams.renderOrder = 10;
      beams.userData = { centre, dirs, R, holeAng };

      const pix = [];
      model.pixels.forEach((p, i) => { if (centre.distanceTo(new THREE.Vector3(...p.pos)) <= near) pix.push(i); });

      group.add(globe, beams);
      items.push({ id: hub.id, type: hub.type, head: model.headByHub[hub.id].index, globe, beams, pix, holes: dirs.length });
    }
    applyBeams();
  }

  // beam length/intensity change without rebuilding the holes
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  function applyBeams() {
    const totalBeams = items.reduce((s, it) => s + it.holes, 0);
    const haze = fogToHaze(settings.fog, totalBeams);
    for (const it of items) {
      const { centre, dirs, R, holeAng } = it.beams.userData;
      const holeR = R * Math.tan(holeAng);
      const farR = holeR + settings.beamLengthM * Math.tan(holeAng);   // spreads at the hole's angle
      dirs.forEach((d, i) => {
        q.setFromUnitVectors(UP, d);
        pos.copy(centre).addScaledVector(d, R);
        scl.set(1, settings.beamLengthM, 1);
        m4.compose(pos, q, scl);
        it.beams.setMatrixAt(i, m4);
      });
      it.beams.instanceMatrix.needsUpdate = true;
      it.beams.geometry = beamGeometry(holeR, farR);
      it.beams.visible = settings.beams && it.holes > 0;
      it.beams.material.uniforms.uIntensity.value = haze;
      it.globe.visible = settings.globes;
    }
  }

  // shared cone geometry per (hole radius, far radius); cached so sliders don't churn memory
  const geoCache = new Map();
  function beamGeometry(r0, r1) {
    const key = `${r0.toFixed(5)}|${r1.toFixed(5)}`;
    if (!geoCache.has(key)) {
      if (geoCache.size > 24) {
        const live = new Set(items.map(it => it.beams.geometry));
        for (const [k, g] of geoCache) if (!live.has(g)) { g.dispose(); geoCache.delete(k); }
      }
      const g = new THREE.CylinderGeometry(r1, r0, 1, 20, 1, true);   // top = far end, bottom = hole
      g.translate(0, 0.5, 0);
      geoCache.set(key, g);
    }
    return geoCache.get(key);
  }

  function setModel(m) {
    model = m;
    setLayout(m);
    build();
  }

  const REBUILD = ['where', 'globeMmTip', 'globeMmMid', 'holes', 'holeMm'];
  function set(opts) {
    const rebuild = REBUILD.some(k => k in opts && opts[k] !== settings[k]);
    Object.assign(settings, opts);
    rebuild ? build() : applyBeams();
  }

  // panel settings -> head DMX values (dimmer carries the master brightness)
  const c = [0, 0, 0];
  function encode(colors, brightness) {
    const n = heads.channels.length;
    const pixNear = {};
    for (const it of items) pixNear[it.head] = it.pix;
    for (let h = 0; h < heads.count; h++) {
      const base = h * n;
      if (settings.colorMode === 'follow') {
        const pix = pixNear[h] || [];
        c[0] = c[1] = c[2] = 0;
        for (const i of pix) { c[0] += colors[i * 3]; c[1] += colors[i * 3 + 1]; c[2] += colors[i * 3 + 2]; }
        const k = 1 / Math.max(1, pix.length);
        c[0] *= k; c[1] *= k; c[2] *= k;
      } else {
        const src = settings.colorMode === 'white' ? [1, 1, 1] : settings.color;
        c[0] = src[0]; c[1] = src[1]; c[2] = src[2];
      }
      heads.values.fill(0, base, base + n);
      chSet(base, 'dimmer', brightness);
      chSet(base, 'red', c[0]); chSet(base, 'green', c[1]); chSet(base, 'blue', c[2]);
      chSet(base, 'white', settings.white); chSet(base, 'uv', settings.uv);
    }
  }

  // head DMX values -> what each globe shows. Strobe: 0 = open, above that 1-10 Hz.
  function decode(it, t) {
    const base = it.head * heads.channels.length;
    const dim = chVal(base, 'dimmer', 1);
    const st = chVal(base, 'strobe', 0);
    const gate = st > 0.02 ? ((t * (1 + 9 * st)) % 1 < 0.3 ? 1 : 0) : 1;
    const k = dim * gate;
    const w = chVal(base, 'white', 0) * k, uv = chVal(base, 'uv', 0) * k * 0.7;
    c[0] = chVal(base, 'red', 0) * k + w + uv * UV_TINT[0];
    c[1] = chVal(base, 'green', 0) * k + w + uv * UV_TINT[1];
    c[2] = chVal(base, 'blue', 0) * k + w + uv * UV_TINT[2];
    return c;
  }

  // full-white share of each head's power, from its DMX values
  function headLoad(h) {
    const base = h * heads.channels.length;
    const emit = ['red', 'green', 'blue', 'white', 'uv'].filter(k => k in heads.ch);
    const mean = emit.reduce((s, k) => s + chVal(base, k, 0), 0) / Math.max(1, emit.length);
    return Math.min(1, chVal(base, 'dimmer', 1) * mean);
  }

  function update(colors, brightness, t = 0) {
    if (!colors || !heads.count) return;
    if (!heads.active) encode(colors, brightness);
    for (const it of items) {
      const col = decode(it, t);
      it.globe.material.uniforms.uColor.value.setRGB(col[0], col[1], col[2]);
      it.beams.material.uniforms.uColor.value.setRGB(col[0], col[1], col[2]);
    }
  }

  const beamDeg = mm => 2 * THREE.MathUtils.radToDeg(Math.atan((settings.holeMm / 2000) / (mm / 2000)));
  return {
    setModel, set, update, heads, headLoad,
    get count() { return items.length; },
    get holesPerGlobe() { return items.length ? Math.round(items.reduce((s, it) => s + it.holes, 0) / items.length) : 0; },
    get beamDeg() { return { tip: beamDeg(settings.globeMmTip), middle: beamDeg(settings.globeMmMid) }; },
    get settings() { return { ...settings }; },
  };
}
