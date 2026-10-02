import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { createAudio } from './audio.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { BRAND, BUILDINGS, CONTACT } from './content.js';
import logoSvg from './logo.svg?raw';

const YELLOW = 0xfdc20b;
const BLACK = 0x141414;
const ALL = [...BUILDINGS, CONTACT];
const WORLD_R = 125;
const CAR_YAW = 0; // rotate the model so its nose points along +z

// ---------- Renderer / scene ----------
const canvas = document.getElementById('world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfff3c4);
scene.fog = new THREE.Fog(0xfff3c4, 90, 260);

const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 600);

scene.add(new THREE.HemisphereLight(0xffffff, 0xe8dcb0, 1.1));
const sun = new THREE.DirectionalLight(0xfff1cc, 2.2);
sun.position.set(60, 90, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const audio = createAudio();

// ---------- Helpers ----------
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...extra });
const matYellow = mat(YELLOW, { roughness: 0.5 });
const matBlack = mat(BLACK, { roughness: 0.7 });

function textTexture(lines, w, h, bg = '#fdc20b', fg = '#111') {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => {
    g.font = `${l.weight || 700} ${l.size}px Montserrat, Arial, sans-serif`;
    if ('letterSpacing' in g) g.letterSpacing = `${l.spacing ?? 0}px`;
    g.fillText(l.text, w / 2 + (l.spacing ?? 0) / 2, l.y);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---------- Ground ----------
const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 64), mat(0xf3eedd));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// asphalt plaza
const plaza = new THREE.Mesh(new THREE.CircleGeometry(58, 80), mat(0x2d2d31, { roughness: 0.95 }));
plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.02; plaza.receiveShadow = true;
scene.add(plaza);

// dashed yellow ring on the plaza
{
  const n = 48;
  const dashGeo = new THREE.PlaneGeometry(1.2, 4.2);
  dashGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const d = new THREE.Mesh(dashGeo, matYellow);
    d.rotation.y = Math.PI / 2 + a;
    d.position.set(Math.sin(a) * 38, 0.05, Math.cos(a) * 38);
    scene.add(d);
  }
}

// roads out to each building
ALL.forEach((b) => {
  const [x, z] = b.pos;
  const l = Math.hypot(x, z);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(9, l), mat(0x2d2d31, { roughness: 0.95 }));
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  const g = new THREE.Group();
  g.add(road);
  g.position.set(x / 2, 0.03, z / 2);
  g.rotation.y = Math.atan2(x, z);
  scene.add(g);
});

// central logo on the plaza
{
  const tex = textTexture(
    [
      { text: 'BOLT YARDS', size: 120, y: 190, spacing: 30, weight: 600 },
      { text: 'TECH FOR A BRIGHTER TOMORROW', size: 34, y: 300, spacing: 14, weight: 500 },
    ],
    1024, 512, '#2d2d31', '#fdc20b'
  );
  const p = new THREE.Mesh(new THREE.PlaneGeometry(26, 13), new THREE.MeshBasicMaterial({ map: tex }));
  p.rotation.x = -Math.PI / 2; p.rotation.z = 0; p.position.set(0, 0.07, -14);
  scene.add(p);
}

// ---------- Buildings ----------
const matLogo = mat(YELLOW, { roughness: 0.5, side: THREE.DoubleSide });
const logoGeo = (() => {
  const data = new SVGLoader().parse(logoSvg);
  const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: 24, bevelEnabled: false });
  geo.center();
  geo.scale(0.032, -0.032, 0.032);
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.min.y + 0, 0);
  return geo;
})();

const colliders = [];
const zones = [];

function makeBuilding(b) {
  const [x, z] = b.pos;
  const [w, h, d] = b.size;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = Math.atan2(-x, -z); // front (+z local) faces plaza centre

  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matBlack);
  body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true;
  g.add(body);

  // yellow roof slab + stripe
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 1, d + 1.2), matYellow);
  roof.position.y = h + 0.5; roof.castShadow = true;
  g.add(roof);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.7, d + 0.2), matYellow);
  stripe.position.y = h * 0.25;
  g.add(stripe);

  // brand mark on the roof
  const boltMesh = new THREE.Mesh(logoGeo, matLogo);
  boltMesh.position.set(0, h + 1, 0);
  boltMesh.castShadow = true;
  g.add(boltMesh);
  b._bolt = boltMesh;

  // sign
  const sw = Math.min(w * 0.86, 18);
  const tex = textTexture(
    [{ text: b.sign, size: b.sign.length > 12 ? 84 : 100, y: 64, spacing: 6 }],
    1024, 128
  );
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw * 0.125), new THREE.MeshBasicMaterial({ map: tex }));
  sign.position.set(0, h * 0.62, d / 2 + 0.05);
  g.add(sign);

  // windows
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0 });
  const cols = Math.floor(w / 5);
  for (let i = 0; i < cols; i++) {
    const wx = -w / 2 + (i + 0.5) * (w / cols);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), winMat);
    win.position.set(wx, h * 0.42 - 0.2, d / 2 + 0.05);
    g.add(win);
    const win2 = win.clone(); win2.position.y = h * 0.84 - 0.6;
    if (win2.position.y + 1.3 < h) g.add(win2);
  }

  // door
  const door = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.6), matYellow);
  door.position.set(0, 2.3, d / 2 + 0.06);
  g.add(door);

  // glowing enter pad in front
  const pad = new THREE.Mesh(new THREE.RingGeometry(2.2, 3, 40), new THREE.MeshBasicMaterial({ color: YELLOW, side: THREE.DoubleSide }));
  pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.06, d / 2 + 5);
  g.add(pad);
  b._pad = pad;

  scene.add(g);
  g.updateMatrixWorld(true);

  colliders.push({ cx: x, cz: z, rot: g.rotation.y, hw: w / 2 + 0.6, hd: d / 2 + 0.6 });
  const wp = new THREE.Vector3(0, 0, d / 2 + 5).applyMatrix4(g.matrixWorld);
  zones.push({ b, x: wp.x, z: wp.z, visited: false });
}
ALL.forEach(makeBuilding);
document.getElementById('vtotal').textContent = ALL.length;

// ---------- Trees ----------
{
  const trunk = new THREE.CylinderGeometry(0.4, 0.5, 2.4, 6);
  const crown = new THREE.ConeGeometry(2.2, 6, 7);
  const dark = mat(0x2a2a2a), gold = mat(0xe8b10a), grey = mat(0x4a4a4a), trunkM = mat(0x3a2f1a);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let placed = 0, tries = 0;
  while (placed < 130 && tries < 3000) {
    tries++;
    const a = rnd() * Math.PI * 2, r = 62 + rnd() * 80;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (ALL.some((b) => Math.hypot(b.pos[0] - x, b.pos[1] - z) < 24)) continue;
    // keep radial roads clear
    if (ALL.some((b) => { const l = Math.hypot(...b.pos); const t = (x * b.pos[0] + z * b.pos[1]) / (l * l); return t > 0 && t < 1 && Math.hypot(x - b.pos[0] * t, z - b.pos[1] * t) < 9; })) continue;
    const s = 0.7 + rnd() * 0.9;
    const t = new THREE.Group();
    const tr = new THREE.Mesh(trunk, trunkM); tr.position.y = 1.2; t.add(tr);
    const cr = new THREE.Mesh(crown, rnd() < 0.3 ? gold : rnd() < 0.5 ? dark : grey);
    cr.position.y = 5; cr.castShadow = true; t.add(cr);
    t.position.set(x, 0, z); t.scale.setScalar(s); t.rotation.y = rnd() * 6;
    scene.add(t);
    colliders.push({ cx: x, cz: z, rot: 0, hw: 0.9 * s, hd: 0.9 * s });
    placed++;
  }
}

// ---------- Car ----------
const car = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 4.6), matYellow);
  body.position.y = 0.95; body.castShadow = true; car.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.85, 2.2), mat(0xfff0b0, { roughness: 0.3 }));
  cab.position.set(0, 1.78, -0.3); cab.castShadow = true; car.add(cab);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.55, 2.25), mat(0x1b1b1b, { roughness: 0.2 }));
  glass.position.set(0, 1.85, -0.3); car.add(glass);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.35, 0.3), matBlack);
  bumper.position.set(0, 0.7, 2.35); car.add(bumper);
  const bumper2 = bumper.clone(); bumper2.position.z = -2.35; car.add(bumper2);
  // headlights
  const hl = new THREE.MeshBasicMaterial({ color: 0xffffff });
  [-0.8, 0.8].forEach((x) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.1), hl); l.position.set(x, 1.0, 2.32); car.add(l); });
  const tl = new THREE.MeshBasicMaterial({ color: 0xff3b2f });
  [-0.8, 0.8].forEach((x) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.1), tl); l.position.set(x, 1.0, -2.32); car.add(l); });
  // wheels
  car.userData.wheels = [];
  const wg = new THREE.CylinderGeometry(0.55, 0.55, 0.45, 14);
  [[-1.25, 1.5], [1.25, 1.5], [-1.25, -1.5], [1.25, -1.5]].forEach(([x, z]) => {
    const w = new THREE.Mesh(wg, matBlack);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.55, z); w.castShadow = true;
    car.add(w); car.userData.wheels.push(w);
  });
}
scene.add(car);

// licence plate texture: black text on white with a thin border
function plateTexture(text) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = '#111'; g.lineWidth = 6; g.strokeRect(5, 5, 502, 118);
  g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 76px Montserrat, Arial, sans-serif';
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  const w = g.measureText(text).width; // shrink to fit inside the border with a small margin
  if (w > 430) g.font = `700 ${Math.floor(76 * 430 / w)}px Montserrat, Arial, sans-serif`;
  g.fillText(text, 258, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// swap the placeholder box car for the Porsche model once it has loaded
{
  const placeholder = [...car.children];
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load('/models/car.glb', (gltf) => {
    const model = gltf.scene;
    model.traverse((o) => {
      if (!o.isMesh) return;
      const names = (Array.isArray(o.material) ? o.material : [o.material]).map((m) => m.name);
      if (names.includes('930_stickers') || names.includes('930_wunderbaum') || names.includes('material_0')) { o.visible = false; return; } // lettering, decals, air freshener, and the baked ground plane
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      o.castShadow = !ms.some((m) => m.transparent || m.opacity < 1 || ['coat', 'glass', 'material_0', '930_lights', '930_lights_refraction'].includes(m.name));
      ms.forEach((m) => {
        m.transmission = 0; // keep it cheap: no extra transmission pass
        if (m.name === 'plate') { m.map = plateTexture(BRAND.phone); m.normalMap = null; m.color.set(0xffffff); }
        if (m.name === 'paint') { m.map = null; m.color.set(YELLOW); m.metalness = 0; m.roughness = 0.4; m.emissive = new THREE.Color(YELLOW); m.emissiveIntensity = 0.45; if ('clearcoat' in m) m.clearcoat = 0; }
        m.needsUpdate = true;
      });
    });
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const k = 6.6 / Math.max(size.x, size.z);
    model.scale.setScalar(k);
    model.position.set(-c.x * k, -box.min.y * k, -c.z * k);
    const holder = new THREE.Group();
    holder.rotation.y = CAR_YAW;
    holder.add(model);
    placeholder.forEach((p) => car.remove(p));
    car.userData.wheels = [];
    car.add(holder);
  });
}

const state = { x: 0, z: 22, h: Math.PI, v: 0, y: 0, vy: 0, steer: 0 };
car.position.set(state.x, 0, state.z);

// ---------- Input ----------
const keys = {};
const touchKeys = {};
const down = (k) => keys[k] || touchKeys[k];
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (k === 'e') interact();
  if (k === 'escape') closePanel();
});
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.querySelectorAll('#touch button').forEach((btn) => {
  const k = btn.dataset.k;
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); touchKeys[k] = true; if (k === 'interact') interact(); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, () => (touchKeys[k] = false)));
});

// ---------- Panel ----------
const $ = (id) => document.getElementById(id);
let panelOpen = false;
let nearZone = null;
function openPanel(b) {
  panelOpen = true;
  $('pKind').textContent = b.kind || (b.contact ? 'Get in touch' : 'Bolt Yards');
  $('pTitle').textContent = b.title;
  $('pBody').textContent = b.body;
  $('pTags').innerHTML = (b.tags || []).map((t) => `<span class="tag-chip">${t}</span>`).join('');
  $('pExtra').innerHTML = b.contact
    ? `<div class="contact-row"><i>📞</i><a href="tel:${BRAND.phone}">${BRAND.phone}</a></div>
       <div class="contact-row"><i>✉</i><a href="mailto:${BRAND.email}">${BRAND.email}</a></div>
       <div class="contact-row"><i>📍</i><span>${BRAND.address}</span></div>
       <a class="btn dark" style="margin-top:22px" href="/contact.html">Send us a message</a>`
    : '';
  const link = $('pLink');
  if (b.url) { link.href = b.url; link.hidden = false; } else link.hidden = true;
  $('panel').hidden = false;
  for (const k in keys) keys[k] = false;
}
function closePanel() { panelOpen = false; $('panel').hidden = true; }
$('close').onclick = closePanel;
$('panel').addEventListener('click', (e) => { if (e.target === $('panel')) closePanel(); });

function interact() {
  if (!started) return;
  if (panelOpen) return closePanel();
  if (nearZone) {
    openPanel(nearZone.b);
    if (!nearZone.visited) { nearZone.visited = true; $('vcount').textContent = zones.filter((z) => z.visited).length; }
  }
}

// ---------- Collision ----------
let lastBump = 0;
function collide() {
  for (const c of colliders) {
    const dx = state.x - c.cx, dz = state.z - c.cz;
    if (Math.abs(dx) > 30 || Math.abs(dz) > 30) continue;
    const cos = Math.cos(c.rot), sin = Math.sin(c.rot);
    // into local space (rotation about Y by rot)
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    const R = 2.2;
    const cx = Math.max(-c.hw, Math.min(c.hw, lx));
    const cz = Math.max(-c.hd, Math.min(c.hd, lz));
    let ox = lx - cx, oz = lz - cz;
    let dist = Math.hypot(ox, oz);
    if (dist < R) {
      if (dist < 1e-4) { // inside box: push out the shortest axis
        const px = c.hw - Math.abs(lx), pz = c.hd - Math.abs(lz);
        if (px < pz) { ox = Math.sign(lx) || 1; oz = 0; dist = -px; } else { ox = 0; oz = Math.sign(lz) || 1; dist = -pz; }
      } else { ox /= dist; oz /= dist; }
      const push = R - dist;
      const nlx = lx + ox * push, nlz = lz + oz * push;
      // back to world
      state.x = c.cx + nlx * cos + nlz * sin;
      state.z = c.cz - nlx * sin + nlz * cos;
      if (Math.abs(state.v) > 6 && performance.now() - lastBump > 400) { audio.bump(Math.abs(state.v) / 20); lastBump = performance.now(); }
      state.v *= 0.6;
    }
  }
  const r = Math.hypot(state.x, state.z);
  if (r > WORLD_R) { state.x *= WORLD_R / r; state.z *= WORLD_R / r; state.v *= 0.5; }
}

// ---------- Minimap ----------
const mm = $('minimap'), mg = mm.getContext('2d');
function drawMinimap() {
  const S = mm.width, sc = S / 2 / (WORLD_R + 15);
  mg.clearRect(0, 0, S, S);
  mg.save(); mg.translate(S / 2, S / 2);
  mg.fillStyle = '#2d2d31'; mg.beginPath(); mg.arc(0, 0, 58 * sc, 0, 7); mg.fill();
  zones.forEach((z) => {
    const [x, zz] = z.b.pos;
    mg.fillStyle = z.visited ? '#fdc20b' : '#111';
    mg.fillRect(x * sc - 5, zz * sc - 5, 10, 10);
    if (z === nearZone) { mg.strokeStyle = '#fdc20b'; mg.lineWidth = 2; mg.strokeRect(x * sc - 7, zz * sc - 7, 14, 14); }
  });
  mg.translate(state.x * sc, state.z * sc); mg.rotate(-state.h + Math.PI);
  mg.fillStyle = '#fdc20b'; mg.strokeStyle = '#111'; mg.lineWidth = 2;
  mg.beginPath(); mg.moveTo(0, -8); mg.lineTo(6, 6); mg.lineTo(-6, 6); mg.closePath(); mg.fill(); mg.stroke();
  mg.restore();
}

// ---------- Game loop ----------
let started = false;
const clock = new THREE.Clock();
const camPos = new THREE.Vector3(0, 8, 40);
const look = new THREE.Vector3();
let t = 0;

// camera angles: far chase view and a close behind-the-car view (toggle with C)
const CAM_VIEWS = [
  { name: 'Close view', dist: 5.5, height: 2.2 },
  { name: 'Chase view', dist: 12, height: 6 },
];
let camView = 0;

let inp = { fwd: false, back: false, boost: false };
let parkedZone = null;

function update(dt) {
  inp = { fwd: false, back: false, boost: false };
  if (started && !panelOpen) {
    const fwd = down('w') || down('arrowup') || down('up');
    const back = down('s') || down('arrowdown') || down('down');
    const left = down('a') || down('arrowleft') || down('left');
    const right = down('d') || down('arrowright') || down('right');
    const boost = down('shift') || down('boost');
    inp = { fwd: !!fwd, back: !!back, boost: !!boost };
    const max = boost ? 46 : 28;
    const acc = boost ? 50 : 30;

    if (fwd) state.v += acc * dt;
    else if (back) state.v -= acc * 0.8 * dt;
    else state.v -= Math.sign(state.v) * Math.min(Math.abs(state.v), 14 * dt);
    state.v = Math.max(-12, Math.min(max, state.v));

    const target = (left ? 1 : 0) - (right ? 1 : 0);
    state.steer += (target - state.steer) * Math.min(1, 8 * dt);
    const grip = Math.min(1, Math.abs(state.v) / 8);
    state.h += state.steer * 1.9 * grip * Math.sign(state.v || 1) * dt;

    if ((down(' ') || down('jump')) && state.y <= 0.001) state.vy = 11;
    state.vy -= 30 * dt;
    state.y = Math.max(0, state.y + state.vy * dt);
    if (state.y === 0 && state.vy < 0) state.vy = 0;

    state.x += Math.sin(state.h) * state.v * dt;
    state.z += Math.cos(state.h) * state.v * dt;
    collide();
  }

  car.position.set(state.x, state.y, state.z);
  car.rotation.y = state.h;
  car.rotation.z = -state.steer * Math.min(1, Math.abs(state.v) / 30) * 0.08;
  car.rotation.x = state.y > 0 ? -state.vy * 0.015 : 0;
  car.userData.wheels.forEach((w) => (w.rotation.x += state.v * dt * 1.8));

  // chase camera (orbits slowly around car on intro)
  if (!started) {
    t += dt * 0.15;
    camPos.set(state.x + Math.sin(t) * 26, 11, state.z + Math.cos(t) * 26);
    look.set(state.x, 2, state.z);
  } else {
    const ox = -Math.sin(state.h), oz = -Math.cos(state.h);
    const view = CAM_VIEWS[camView];
    const cd = view.dist;
    const tx = state.x + ox * cd, tz = state.z + oz * cd, ty = view.height + state.y * 0.5 + Math.abs(state.v) * 0.04;
    camPos.x += (tx - camPos.x) * Math.min(1, 5 * dt);
    camPos.y += (ty - camPos.y) * Math.min(1, 5 * dt);
    camPos.z += (tz - camPos.z) * Math.min(1, 5 * dt);
    look.set(state.x - ox * 5, 1.5, state.z - oz * 5);
  }
  camera.position.copy(camPos);
  camera.lookAt(look);
  camera.fov += ((started ? 60 + Math.max(0, state.v - 28) * 0.9 : 60) - camera.fov) * Math.min(1, 4 * dt);
  camera.updateProjectionMatrix();

  // snap the shadow window to a grid so shadows don't shimmer as the car moves
  const sx = Math.round(state.x / 2) * 2, sz = Math.round(state.z / 2) * 2;
  sun.position.set(sx + 60, 90, sz + 40);
  sun.target.position.set(sx, 0, sz);

  // proximity
  nearZone = null;
  let best = 7.5;
  for (const z of zones) {
    const d = Math.hypot(z.x - state.x, z.z - state.z);
    if (d < best) { best = d; nearZone = z; }
  }
  // little click when the car settles on a building's ring
  // fires as soon as the car's nose reaches the ring (car is ~6.6 long, ring radius ~3)
  if (parkedZone && Math.hypot(parkedZone.x - state.x, parkedZone.z - state.z) > 9) parkedZone = null;
  if (started && !parkedZone) {
    for (const z of zones) {
      if (Math.hypot(z.x - state.x, z.z - state.z) < 5.6 && Math.abs(state.v) < 16 && state.y < 0.3) { parkedZone = z; audio.parked(); break; }
    }
  }
  if (started) audio.update({ speed: state.v, throttle: inp.fwd, braking: inp.back, boost: inp.boost && inp.fwd, airborne: state.y > 0.05, quiet: panelOpen });
  $('prompt').hidden = !(started && nearZone && !panelOpen);
  if (nearZone) $('promptName').textContent = nearZone.b.sign;
  $('speedVal').textContent = Math.round(Math.abs(state.v) * 3.2);

  const pulse = 1 + Math.sin(performance.now() / 300) * 0.08;
  zones.forEach((z) => {
    z.b._pad.scale.setScalar(z === nearZone ? pulse * 1.15 : 1);
    z.b._bolt.rotation.y += dt * 0.8;
  });
  if (started) drawMinimap();
}

renderer.setAnimationLoop(() => {
  if (classicMode) return;
  update(Math.min(clock.getDelta(), 0.05));
  renderer.render(scene, camera);
});

// ---------- Intro / modes ----------
// the landing page is the default; the 3D world only renders while the user is driving
let classicMode = true;
canvas.style.display = 'none';
requestAnimationFrame(() => requestAnimationFrame(() => $('intro').classList.add('ready')));
// make sure the web font is in before the sign textures are painted
if (document.fonts?.load) {
  Promise.all([document.fonts.load('700 100px Montserrat'), document.fonts.load('500 40px Montserrat')]).finally(() => {
    ALL.forEach((b) => {}); // textures regenerate lazily below
    rebuildSignTextures();
  });
}
function rebuildSignTextures() {
  scene.traverse((o) => { if (o.material?.map?.isCanvasTexture) o.material.map.needsUpdate = true; });
}

$('start').onclick = () => enterGame();

function enterGame() {
  classicMode = false;
  started = true;
  $('landing').hidden = true;
  canvas.style.display = '';
  $('hud').hidden = false;
  document.documentElement.classList.add('playing');
  document.body.classList.add('playing');
  scrollTo(0, 0);
  resize();
  clock.getDelta(); // don't let the time spent on the landing page become one giant physics step
  audio.start();
}
function enterLanding(toContent) {
  classicMode = true;
  started = false;
  audio.setActive(false);
  closePanel();
  for (const k in keys) keys[k] = false;
  for (const k in touchKeys) touchKeys[k] = false;
  $('hud').hidden = true;
  $('prompt').hidden = true;
  canvas.style.display = 'none';
  $('landing').hidden = false;
  document.documentElement.classList.remove('playing');
  document.body.classList.remove('playing');
  if (toContent) $('what').scrollIntoView(); else scrollTo(0, 0);
}
window.addEventListener('by:enter-game', () => enterGame());
const muteBtn = $('mute');
const ICON_ON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="m16 9 6 6"/><path d="m22 9-6 6"/></svg>';
const paintMute = () => { muteBtn.innerHTML = (audio.muted ? ICON_OFF : ICON_ON) + `<span>${audio.muted ? 'Sound off' : 'Sound on'}</span>`; };
muteBtn.onclick = () => { audio.setMuted(!audio.muted); paintMute(); };
paintMute();
addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'm' && started) muteBtn.click(); });
const camBtn = $('cam');
const paintCam = () => { camBtn.querySelector('span').textContent = CAM_VIEWS[camView].name; };
const nextCam = () => { camView = (camView + 1) % CAM_VIEWS.length; paintCam(); };
camBtn.onclick = nextCam;
addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'c' && started && !panelOpen) nextCam(); });
paintCam();
$('toClassic').onclick = () => enterLanding(true);

if (import.meta.env.DEV) window.__bolt = { state, zones, keys, touchKeys, car };
