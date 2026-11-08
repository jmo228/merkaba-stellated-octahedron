// Three.js scene: renders every tube as its individual LED pixels, plus an optional
// room/winch rig. Geometry comes from model.js (which reads data/merkaba.json).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createFixtures } from './fixtures.js';

const UP = new THREE.Vector3(0, 1, 0);
const OFF_LEVEL = 0.03; // unlit diffuser still shows faintly

export function createViewer(container, opts = {}) {
  const { rig = false, autoRotate = false, bloom = true, interactive = true } = opts;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: !rig });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x04060a, rig ? 1 : 0);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = autoRotate;
  controls.autoRotateSpeed = 0.8;
  controls.enabled = interactive;
  controls.enableZoom = interactive;

  scene.add(new THREE.HemisphereLight(0x8899cc, 0x101018, 0.6));

  let composer = null, bloomPass = null;
  if (bloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.95, 0.55, 0.12);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  }

  // fixture pivots at its own centre; rig moves/tilts it
  const fixture = new THREE.Group();
  scene.add(fixture);
  const rigGroup = new THREE.Group();
  const fixtures = createFixtures(fixture);
  if (rig) scene.add(rigGroup);

  let model = null, pixelMesh = null, hubMesh = null, colors = null;
  let winchLines = null, anchors = [], rings = [];
  let pose = { height: 0, tiltDeg: 0, tiltDirDeg: 0 };

  function clearFixture() {
    for (const m of [pixelMesh, hubMesh]) {
      if (!m) continue;
      fixture.remove(m); m.geometry.dispose(); m.material.dispose();
    }
    rigGroup.clear();
  }

  function setModel(m) {
    clearFixture();
    model = m;
    const px = m.pixels;
    const segLen = m.variant.tubeLengthM / m.variant.pixelsPerTube;
    const radius = m.data.tube.diameterMm / 2000;
    const geo = new THREE.CylinderGeometry(radius, radius, segLen * 0.94, 12, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    pixelMesh = new THREE.InstancedMesh(geo, mat, px.length);
    const q = new THREE.Quaternion(), mtx = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1);
    px.forEach((p, i) => {
      q.setFromUnitVectors(UP, new THREE.Vector3(...p.dir));
      mtx.compose(new THREE.Vector3(...p.pos), q, one);
      pixelMesh.setMatrixAt(i, mtx);
    });
    colors = new Float32Array(px.length * 3);
    pixelMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(px.length * 3), 3);
    fixture.add(pixelMesh);

    const hubGeo = new THREE.SphereGeometry(Math.max(0.035, m.data.hub.centreToTubeEndMm / 1000 * 0.75), 20, 14);
    const hubMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, metalness: 0.7, roughness: 0.35 });
    hubMesh = new THREE.InstancedMesh(hubGeo, hubMat, m.hubs.length);
    m.hubs.forEach((h, i) => hubMesh.setMatrixAt(i, mtx.makeTranslation(...h.world)));
    fixture.add(hubMesh);
    fixtures.setModel(m);

    if (rig) buildRig();
    frameCamera();
    applyPose();
  }

  function buildRig() {
    const r = model.data.rig;
    const grid = new THREE.GridHelper(12, 24, 0x2a3550, 0x161d2c);
    rigGroup.add(grid);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(12, 12),
      new THREE.MeshBasicMaterial({ color: 0x1a2236, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = r.ceilingHeightM;
    rigGroup.add(ceil);
    // bridle rings in fixture-local space; anchors above them (level pose) on the ceiling
    rings = r.winches.map(w => {
      const a = model.hubById[w.hubs[0]].world, b = model.hubById[w.hubs[1]].world;
      return new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + r.bridleRiseM, (a[2] + b[2]) / 2);
    });
    anchors = rings.map(p => new THREE.Vector3(p.x, r.ceilingHeightM, p.z));
    const winchGeo = new THREE.BoxGeometry(0.22, 0.14, 0.22);
    const winchMat = new THREE.MeshStandardMaterial({ color: 0x444c5c, metalness: 0.6, roughness: 0.4 });
    anchors.forEach(a => { const box = new THREE.Mesh(winchGeo, winchMat); box.position.copy(a).y -= 0.07; rigGroup.add(box); });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rings.length * 3 * 2 * 3), 3));
    winchLines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x9aa6c0, transparent: true, opacity: 0.8 }));
    rigGroup.add(winchLines);
  }

  // pose: height of fixture centre above floor, tilt angle and the compass direction it leans toward
  function setPose(p) { pose = { ...pose, ...p }; return applyPose(); }

  function applyPose() {
    if (!model) return [];
    fixture.position.set(0, rig ? pose.height : 0, 0);
    const dir = THREE.MathUtils.degToRad(pose.tiltDirDeg);
    const axis = new THREE.Vector3(Math.sin(dir), 0, -Math.cos(dir)); // perpendicular to lean direction
    fixture.quaternion.setFromAxisAngle(axis, THREE.MathUtils.degToRad(pose.tiltDeg));
    fixture.updateMatrixWorld(true);
    if (!rig) return [];
    const pos = winchLines.geometry.attributes.position;
    const out = [];
    let k = 0;
    model.data.rig.winches.forEach((w, i) => {
      const ring = rings[i].clone().applyMatrix4(fixture.matrixWorld);
      const put = v => pos.setXYZ(k++, v.x, v.y, v.z);
      put(anchors[i]); put(ring);
      for (const id of w.hubs) {
        put(ring); put(new THREE.Vector3(...model.hubById[id].world).applyMatrix4(fixture.matrixWorld));
      }
      out.push({ id: w.id, lengthM: anchors[i].distanceTo(ring) });
    });
    pos.needsUpdate = true;
    winchLines.geometry.computeBoundingSphere();
    const ys = model.hubs.map(h => new THREE.Vector3(...h.world).applyMatrix4(fixture.matrixWorld).y);
    out.topY = Math.max(...ys);
    out.bottomY = Math.min(...ys);
    return out;
  }

  function frameCamera() {
    const size = Math.max(model.dims.heightM, model.dims.widthM);
    if (rig) {
      const y = model.data.rig.centreHeightDefaultM;
      controls.target.set(0, y, 0);
      camera.position.set(size * 1.7, y + size * 0.35, size * 2.3);
    } else {
      controls.target.set(0, 0, 0);
      camera.position.set(size * 1.15, size * 0.3, size * 1.55);
    }
    controls.update();
  }

  // effects write linear 0..1 RGB into colors (DMX pixel order); brightness scales it
  let brightness = 1;
  function pushColors(t) {
    const dst = pixelMesh.instanceColor.array;
    for (let i = 0; i < colors.length; i++) dst[i] = Math.max(OFF_LEVEL, colors[i] * brightness);
    pixelMesh.instanceColor.needsUpdate = true;
    fixtures.update(colors, brightness, t);
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (composer) { composer.setSize(w, h); bloomPass.resolution.set(w, h); }
  }
  new ResizeObserver(resize).observe(container);
  resize();

  let onFrame = null, last = performance.now(), running = true;
  const t0 = last;
  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (model && onFrame) {
      const t = (now - t0) / 1000;
      fixtures.heads.active = false;          // an effect sets this when it drives the heads itself
      onFrame(t, dt, colors, fixtures.heads);
      pushColors(t);
    }
    controls.update();
    composer ? composer.render() : renderer.render(scene, camera);
  }
  requestAnimationFrame(loop);

  return {
    setModel, setPose,
    setBrightness: v => { brightness = v; },
    setBloom: on => { if (bloomPass) bloomPass.enabled = on; },
    onFrame: fn => { onFrame = fn; },
    setFixtures: o => fixtures.set(o),
    get fixtureCount() { return fixtures.count; },
    get holesPerGlobe() { return fixtures.holesPerGlobe; },
    get beamDeg() { return fixtures.beamDeg; },
    get heads() { return fixtures.heads; },
    headLoad: h => fixtures.headLoad(h),
    get colors() { return colors; },
    dispose: () => { running = false; renderer.dispose(); },
  };
}
