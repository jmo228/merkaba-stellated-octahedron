// Hub fixtures: a snap-together frosted diffuser globe around each ball joint, lit from
// inside by a small DMX head, plus an optional soft beam shining outward from each globe.
// Colour can follow the LED pixels nearest the hub (so globes track the running effect),
// be one fixed colour, or white. These are a visual prototype: the heads are not yet in
// the DMX address map (see PROGRESS.md).
import * as THREE from 'three';

const DOWN = new THREE.Vector3(0, -1, 0);

// ---- globe: frosted plastic, brighter where you look straight through the middle ----
const globeVS = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const globeFS = /* glsl */`
  uniform vec3 uColor;
  uniform vec3 uShell;   // unlit plastic tint
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float facing = abs(dot(vNormal, vView));
    float lit = 0.55 + 0.65 * pow(facing, 1.4);          // hot centre, softer rim
    float rim = pow(1.0 - facing, 3.0) * 0.25;           // faint edge of the shell
    vec3 col = uColor * lit + uShell * (0.6 + rim * 4.0);
    gl_FragColor = vec4(col, 0.9);
  }
`;

// ---- beam: soft additive haze cone, fading along its length and toward its edges ----
const beamVS = /* glsl */`
  varying float vAlong;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vAlong = 1.0 - uv.y;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
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

export function createFixtures(parent) {
  const group = new THREE.Group();
  parent.add(group);

  const globeGeo = new THREE.SphereGeometry(1, 40, 28);
  const beamGeo = new THREE.ConeGeometry(1, 1, 40, 1, true);
  beamGeo.translate(0, -0.5, 0);                      // apex at origin, opens toward -Y

  const settings = {
    globes: true, where: 'tips', globeMm: 160,
    colorMode: 'follow', color: [1, 1, 1],
    beams: false, beamLengthM: 4, beamSpreadDeg: 8, beamIntensity: 0.45,
  };
  let model = null, items = [];

  function clear() {
    for (const it of items) { it.globe.material.dispose(); it.beam.material.dispose(); }
    group.clear();
    items = [];
  }

  function build() {
    clear();
    if (!model) return;
    const near = model.variant.tubeLengthM * 0.25 + model.data.hub.centreToTubeEndMm / 1000;
    const hubs = model.hubs.filter(h => settings.where === 'all' || h.type === 'tip');
    for (const hub of hubs) {
      const centre = new THREE.Vector3(...hub.world);
      const dir = centre.clone().normalize();          // outward from the sculpture centre

      const globe = new THREE.Mesh(globeGeo, new THREE.ShaderMaterial({
        vertexShader: globeVS, fragmentShader: globeFS,
        uniforms: { uColor: { value: new THREE.Color(0, 0, 0) }, uShell: { value: new THREE.Color(0.05, 0.055, 0.065) } },
        transparent: true, depthWrite: false, toneMapped: false,
      }));
      globe.position.copy(centre);
      globe.renderOrder = 5;

      const beam = new THREE.Mesh(beamGeo, new THREE.ShaderMaterial({
        vertexShader: beamVS, fragmentShader: beamFS,
        uniforms: { uColor: { value: new THREE.Color(0, 0, 0) }, uIntensity: { value: settings.beamIntensity } },
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, toneMapped: false,
      }));
      beam.quaternion.setFromUnitVectors(DOWN, dir);
      beam.renderOrder = 10;
      beam.userData.centre = centre;
      beam.userData.dir = dir;

      const pix = [];
      model.pixels.forEach((p, i) => { if (centre.distanceTo(new THREE.Vector3(...p.pos)) <= near) pix.push(i); });

      group.add(globe, beam);
      items.push({ id: hub.id, globe, beam, pix });
    }
    applyShape();
  }

  function applyShape() {
    const r = settings.globeMm / 2000;
    const br = settings.beamLengthM * Math.tan(THREE.MathUtils.degToRad(settings.beamSpreadDeg));
    for (const it of items) {
      it.globe.scale.setScalar(r);
      it.globe.visible = settings.globes;
      // beam leaves from the globe surface (or the bare hub if globes are hidden)
      const start = settings.globes ? r : 0.04;
      it.beam.position.copy(it.beam.userData.centre).addScaledVector(it.beam.userData.dir, start);
      it.beam.scale.set(br, settings.beamLengthM, br);
      it.beam.visible = settings.beams;
      it.beam.material.uniforms.uIntensity.value = settings.beamIntensity;
    }
  }

  function setModel(m) { model = m; build(); }

  function set(opts) {
    const rebuild = 'where' in opts && opts.where !== settings.where;
    Object.assign(settings, opts);
    rebuild ? build() : applyShape();
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
      it.globe.material.uniforms.uColor.value.setRGB(c[0], c[1], c[2]);
      it.beam.material.uniforms.uColor.value.setRGB(c[0], c[1], c[2]);
    }
  }

  return { setModel, set, update, get count() { return items.length; }, get settings() { return { ...settings }; } };
}
