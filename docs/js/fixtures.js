// Hub fixtures: a snap-together frosted globe around each ball joint, lit from inside by a
// small DMX head. The globe is perforated: holes spread evenly over the shell (skipping the
// ports where tubes enter) let narrow beams shine straight out from the centre, while the
// rest of the shell glows as a diffuser. A beam through a hole from a central source spreads
// by about atan(hole radius / globe radius), so hole size sets the beam width.
// Colour can follow the LED pixels nearest the hub, be one fixed colour, or white.
// Visual prototype: the heads are not yet in the DMX address map or power estimate.
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

// fog/haze in the room: with none the beams are barely visible, in thick fog they glow
const fogToHaze = f => 0.02 + 0.9 * Math.pow(f, 1.3);
// UV shows as a deep violet in fog; white adds equally to R, G and B
const UV_TINT = [0.32, 0.08, 1.0];

export function createFixtures(parent) {
  const group = new THREE.Group();
  parent.add(group);

  const globeGeo = new THREE.SphereGeometry(1, 64, 40);
  // narrow open cylinder flaring to a cone: base (hole) at y=0, far end at y=1
  const beamGeo = new THREE.CylinderGeometry(1, 0, 1, 20, 1, true);
  beamGeo.translate(0, 0.5, 0);

  const settings = {
    globes: true, where: 'all', globeMm: 160,
    colorMode: 'follow', color: [1, 1, 1],
    holes: 32, holeMm: 12, beams: true, beamLengthM: 3, fog: 0.5, white: 0, uv: 0,
  };
  let model = null, items = [];

  function clear() {
    for (const it of items) { it.globe.material.dispose(); it.beams.material.dispose(); it.beams.dispose(); }
    group.clear();
    items = [];
  }

  function build() {
    clear();
    if (!model) return;
    const near = model.variant.tubeLengthM * 0.25 + model.data.hub.centreToTubeEndMm / 1000;
    const hubs = model.hubs.filter(h => settings.where === 'all' || h.type === 'tip');
    const R = settings.globeMm / 2000;
    const holeAng = Math.atan((settings.holeMm / 2000) / R);
    const portClear = Math.asin(Math.min(1, (model.data.tube.diameterMm / 2000) / R)) + holeAng + 0.12;

    for (const hub of hubs) {
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

      const beams = new THREE.InstancedMesh(beamGeo, new THREE.ShaderMaterial({
        vertexShader: beamVS, fragmentShader: beamFS,
        uniforms: { uColor: { value: new THREE.Color(0, 0, 0) }, uIntensity: { value: fogToHaze(settings.fog) } },
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
      items.push({ id: hub.id, globe, beams, pix, holes: dirs.length });
    }
    applyBeams();
  }

  // beam length/intensity change without rebuilding the holes
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  function applyBeams() {
    for (const it of items) {
      const { centre, dirs, R, holeAng } = it.beams.userData;
      const holeR = R * Math.tan(holeAng);
      const farR = holeR + settings.beamLengthM * Math.tan(holeAng);   // spreads at the hole's angle
      dirs.forEach((d, i) => {
        q.setFromUnitVectors(UP, d);
        pos.copy(centre).addScaledVector(d, R);
        // geometry radius is 1 at y=0 (hole end) and 0 at y=1; scale so it widens instead
        scl.set(1, settings.beamLengthM, 1);
        m4.compose(pos, q, scl);
        it.beams.setMatrixAt(i, m4);
      });
      it.beams.instanceMatrix.needsUpdate = true;
      it.beams.userData.radii = [holeR, farR];
      it.beams.geometry = beamGeometry(holeR, farR);
      it.beams.visible = settings.beams && it.holes > 0;
      it.beams.material.uniforms.uIntensity.value = fogToHaze(settings.fog);
      it.globe.visible = settings.globes;
    }
  }

  // shared cone geometry per (hole radius, far radius); cached so sliders don't churn memory
  const geoCache = new Map();
  function beamGeometry(r0, r1) {
    const key = `${r0.toFixed(5)}|${r1.toFixed(5)}`;
    if (!geoCache.has(key)) {
      if (geoCache.size > 24) { for (const g of geoCache.values()) g.dispose(); geoCache.clear(); }
      const g = new THREE.CylinderGeometry(r1, r0, 1, 20, 1, true);   // top = far end, bottom = hole
      g.translate(0, 0.5, 0);
      geoCache.set(key, g);
    }
    return geoCache.get(key);
  }

  function setModel(m) { model = m; build(); }

  const REBUILD = ['where', 'globeMm', 'holes', 'holeMm'];
  function set(opts) {
    const rebuild = REBUILD.some(k => k in opts && opts[k] !== settings[k]);
    Object.assign(settings, opts);
    rebuild ? build() : applyBeams();
  }

  const c = [0, 0, 0];
  function update(colors, brightness) {
    if (!colors || !(settings.globes || settings.beams)) return;
    for (const it of items) {
      if (settings.colorMode === 'follow') {
        c[0] = c[1] = c[2] = 0;
        for (const i of it.pix) { c[0] += colors[i * 3]; c[1] += colors[i * 3 + 1]; c[2] += colors[i * 3 + 2]; }
        const k = brightness / Math.max(1, it.pix.length);
        c[0] *= k; c[1] *= k; c[2] *= k;
      } else {
        const src = settings.colorMode === 'white' ? [1, 1, 1] : settings.color;
        c[0] = src[0] * brightness; c[1] = src[1] * brightness; c[2] = src[2] * brightness;
      }
      const w = settings.white * brightness, uv = settings.uv * brightness * 0.7;
      c[0] += w + uv * UV_TINT[0]; c[1] += w + uv * UV_TINT[1]; c[2] += w + uv * UV_TINT[2];
      it.globe.material.uniforms.uColor.value.setRGB(c[0], c[1], c[2]);
      it.beams.material.uniforms.uColor.value.setRGB(c[0], c[1], c[2]);
    }
  }

  return {
    setModel, set, update,
    get count() { return items.length; },
    get holesPerGlobe() { return items.length ? Math.round(items.reduce((s, it) => s + it.holes, 0) / items.length) : 0; },
    get beamDeg() { return 2 * THREE.MathUtils.radToDeg(Math.atan((settings.holeMm / 2000) / (settings.globeMm / 2000))); },
    get settings() { return { ...settings }; },
  };
}
