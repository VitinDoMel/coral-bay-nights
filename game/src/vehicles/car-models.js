// Five original low-poly car models (Vortex GT coupe, Palmetto sedan, Tarpon SUV, Bodega
// pickup, Cruzeta hatch) plus the Vista Cab and the black-and-white CVPD cruiser with its
// red/blue light bar. Roofs share the body colour; glass is tinted blue.
import * as THREE from 'three';

export const MODELS = [
  { id: 'vortex', name: 'Vortex GT', len: 4.4, wid: 1.95, bodyH: 0.52, ride: 0.32, cabin: [0.48, 1.9, 0.0, 0.5], maxSpeed: 52, accel: 17, grip: 8.5, mass: 1.0 },
  { id: 'palmetto', name: 'Palmetto', len: 4.6, wid: 1.9, bodyH: 0.62, ride: 0.38, cabin: [0.58, 2.2, -0.1, 0.62], maxSpeed: 42, accel: 12, grip: 7.5, mass: 1.1 },
  { id: 'tarpon', name: 'Tarpon SUV', len: 4.8, wid: 2.05, bodyH: 0.85, ride: 0.48, cabin: [0.72, 2.7, -0.3, 0.75], maxSpeed: 38, accel: 11, grip: 6.8, mass: 1.5 },
  { id: 'bodega', name: 'Bodega Pickup', len: 5.0, wid: 2.0, bodyH: 0.78, ride: 0.5, cabin: [0.7, 1.6, 0.75, 0.75], maxSpeed: 36, accel: 10, grip: 6.5, mass: 1.6, bed: true },
  { id: 'cruzeta', name: 'Cruzeta', len: 3.8, wid: 1.75, bodyH: 0.6, ride: 0.34, cabin: [0.62, 2.0, -0.25, 0.62], maxSpeed: 38, accel: 13, grip: 7.8, mass: 0.85 },
];
export const CAB_MODEL = 1;
export const POLICE_MODEL = 1;
export const CAR_COLORS = ['#ff4f6d', '#1fb5c4', '#ffd166', '#f7f7f2', '#2b59c3', '#7b2cbf', '#ff8c42', '#3ddc97', '#c0c4cc', '#1c1c24', '#e94f37', '#9ad1d4'];

const geo = new Map();
function boxGeo(w, h, d) {
  const k = `${w}|${h}|${d}`;
  if (!geo.has(k)) geo.set(k, new THREE.BoxGeometry(w, h, d));
  return geo.get(k);
}
const mats = new Map();
function m(color, extra = {}) {
  const k = color + JSON.stringify(extra);
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.25, ...extra }));
  return mats.get(k);
}
const GLASS = new THREE.MeshStandardMaterial({ color: '#5d8fb5', roughness: 0.12, metalness: 0.6 });
const TRIM = new THREE.MeshStandardMaterial({ color: '#25262b', roughness: 0.7 });
const TIRE = new THREE.MeshStandardMaterial({ color: '#17171a', roughness: 0.9 });
const HUB = new THREE.MeshStandardMaterial({ color: '#c8ccd4', roughness: 0.3, metalness: 0.8 });
const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12).rotateZ(Math.PI / 2);
const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.32, 8).rotateZ(Math.PI / 2);

function doorTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#f5f5f2'; g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#10131c'; g.font = 'bold 40px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('CVPD', 128, 34);
  g.fillStyle = '#d4a017'; g.beginPath(); g.arc(30, 32, 14, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let doorMat = null;
let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.25, 'rgba(255,255,255,0.6)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

function add(group, g, material, x, y, z, shadow = true) {
  const mesh = new THREE.Mesh(g, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  group.add(mesh);
  return mesh;
}

/**
 * Build a car. kind: 'civ' | 'cab' | 'police'. Returns { root, body, wheels, steerWheels,
 * headMat, tailMat, siren:{red,blue,light}, spec }.
 */
export function buildCar(modelIndex, color, kind = 'civ') {
  const spec = MODELS[modelIndex];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const { len, wid, bodyH, ride } = spec;
  const [cabH, cabLen, cabOff, cabInset] = spec.cabin;
  const paint = kind === 'police' ? m('#121318', { metalness: 0.4 }) : m(kind === 'cab' ? '#ffcc1a' : color, { metalness: 0.35, roughness: 0.35 });
  const y0 = ride + bodyH / 2;
  add(body, boxGeo(wid, bodyH, len), paint, 0, y0, 0);
  // hood/trunk taper and bumpers
  add(body, boxGeo(wid - 0.1, 0.12, len * 0.3), paint, 0, ride + bodyH + 0.04, len * 0.33);
  add(body, boxGeo(wid + 0.04, 0.22, 0.2), TRIM, 0, ride + 0.12, len / 2 + 0.05);
  add(body, boxGeo(wid + 0.04, 0.22, 0.2), TRIM, 0, ride + 0.12, -len / 2 - 0.05);
  // cabin: glass band + roof in body colour
  const cw = wid - cabInset * 0.4;
  const cy = ride + bodyH + cabH / 2;
  add(body, boxGeo(cw, cabH * 0.8, cabLen), GLASS, 0, cy - cabH * 0.1, cabOff);
  add(body, boxGeo(cw - 0.04, 0.1, cabLen - 0.25), kind === 'police' ? m('#f5f5f2') : paint, 0, cy + cabH * 0.35, cabOff);
  // pillars
  for (const s of [-1, 1]) add(body, boxGeo(0.08, cabH * 0.8, 0.12), kind === 'police' ? m('#f5f5f2') : paint, s * (cw / 2 - 0.02), cy - cabH * 0.1, cabOff + cabLen / 2 - 0.1);
  if (spec.bed) {
    add(body, boxGeo(wid - 0.1, 0.3, 1.9), TRIM, 0, ride + bodyH + 0.05, -len / 2 + 1.1);
  }
  if (kind === 'police') {
    doorMat ??= new THREE.MeshStandardMaterial({ map: doorTexture(), roughness: 0.5 });
    for (const s of [-1, 1]) {
      const door = add(body, new THREE.PlaneGeometry(1.8, bodyH * 0.9), doorMat, s * (wid / 2 + 0.01), y0, 0.1, false);
      door.rotation.y = s * Math.PI / 2;
    }
    add(body, boxGeo(wid + 0.02, bodyH * 0.45, len * 0.22), m('#f5f5f2'), 0, y0 + bodyH * 0.1, len * 0.39);
    add(body, boxGeo(wid + 0.02, bodyH * 0.45, len * 0.18), m('#f5f5f2'), 0, y0 + bodyH * 0.1, -len * 0.41);
    add(body, boxGeo(wid * 0.85, 0.3, 0.12), TRIM, 0, ride + 0.3, len / 2 + 0.2); // push bar
  }
  if (kind === 'cab') {
    const sign = add(body, boxGeo(0.9, 0.3, 0.35), new THREE.MeshBasicMaterial({ color: '#fff3b0', toneMapped: false }), 0, ride + bodyH + cabH + 0.2, cabOff);
    sign.castShadow = false;
    add(body, boxGeo(wid + 0.02, 0.12, len * 0.6), m('#111'), 0, y0 + 0.05, 0); // checker stripe
  }

  // lights
  const headMat = new THREE.MeshBasicMaterial({ color: '#fff6d8', toneMapped: false });
  const tailMat = new THREE.MeshBasicMaterial({ color: '#c0102a', toneMapped: false });
  for (const s of [-1, 1]) {
    add(body, boxGeo(0.42, 0.14, 0.06), headMat, s * (wid / 2 - 0.32), ride + bodyH * 0.72, len / 2 + 0.01, false);
    add(body, boxGeo(0.42, 0.14, 0.06), tailMat, s * (wid / 2 - 0.32), ride + bodyH * 0.72, -len / 2 - 0.01, false);
  }

  // wheels
  const wheels = [], steerWheels = [];
  const wx = wid / 2 - 0.12, wz = len / 2 - 0.85;
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * wx, 0.38, sz * wz);
    const spin = new THREE.Group();
    pivot.add(spin);
    add(spin, wheelGeo, TIRE, 0, 0, 0);
    add(spin, hubGeo, HUB, 0, 0, 0, false);
    root.add(pivot);
    wheels.push(spin);
    if (sz > 0) steerWheels.push(pivot);
  }

  let siren = null;
  if (kind === 'police') {
    const barY = ride + bodyH + cabH + 0.14;
    add(body, boxGeo(1.5, 0.12, 0.42), TRIM, 0, barY - 0.08, cabOff);
    const red = new THREE.MeshBasicMaterial({ color: '#ff1a2e', toneMapped: false });
    const blue = new THREE.MeshBasicMaterial({ color: '#1a5bff', toneMapped: false });
    const r = add(body, boxGeo(0.74, 0.26, 0.46), red, -0.4, barY + 0.1, cabOff, false);
    const b = add(body, boxGeo(0.74, 0.26, 0.46), blue, 0.4, barY + 0.1, cabOff, false);
    const light = new THREE.PointLight('#ff2040', 0, 14, 2);
    light.position.set(0, barY + 0.6, cabOff);
    body.add(light);
    // additive halos so the light bar reads from far away
    const redGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ff2a3c', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    const blueGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#2a5cff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    redGlow.position.set(-0.45, barY + 0.12, cabOff); blueGlow.position.set(0.45, barY + 0.12, cabOff);
    redGlow.scale.setScalar(4.2); blueGlow.scale.setScalar(4.2);
    body.add(redGlow, blueGlow);
    siren = { red, blue, light, redMesh: r, blueMesh: b, redGlow, blueGlow };
  }
  return { root, body, wheels, steerWheels, headMat, tailMat, siren, spec };
}

/** Police helicopter: body, tail boom, skids, two rotors and a searchlight housing. */
export function buildHelicopter() {
  const root = new THREE.Group();
  const navy = m('#1d2f5c', { metalness: 0.3, roughness: 0.4 });
  const white = m('#f4f4ef', { roughness: 0.4 });
  const stripe = m('#3fa9ff', { roughness: 0.4 });
  // fuselage: navy top, white belly, sky-blue CVPD stripe, tapered nose
  add(root, boxGeo(2.3, 1.2, 4.4), navy, 0, 0.35, 0);
  add(root, boxGeo(2.32, 0.8, 4.42), white, 0, -0.6, 0);
  add(root, boxGeo(2.36, 0.22, 4.46), stripe, 0, -0.15, 0);
  add(root, boxGeo(2.0, 1.3, 1.5), GLASS, 0, -0.05, 2.75);
  add(root, boxGeo(1.6, 0.6, 0.6), white, 0, -0.65, 3.4);
  add(root, boxGeo(1.4, 0.5, 1.6), navy, 0, 1.1, -0.3); // engine cowling
  add(root, boxGeo(0.55, 0.55, 5.2), navy, 0, 0.45, -4.6);
  add(root, boxGeo(0.57, 0.18, 5.22), stripe, 0, 0.3, -4.6);
  add(root, boxGeo(0.14, 1.7, 1.0), white, 0, 1.0, -7.0);
  add(root, boxGeo(1.8, 0.1, 0.6), navy, 0, 0.5, -6.4);
  for (const s of [-1, 1]) {
    add(root, boxGeo(0.14, 0.14, 4.4), TRIM, s * 1.15, -1.45, 0.2);
    add(root, boxGeo(0.1, 0.5, 0.1), TRIM, s * 1.1, -1.2, 1.2);
    add(root, boxGeo(0.1, 0.5, 0.1), TRIM, s * 1.1, -1.2, -0.9);
    if (!doorMat) doorMat = new THREE.MeshStandardMaterial({ map: doorTexture(), roughness: 0.5 });
    const door = add(root, new THREE.PlaneGeometry(2.4, 0.6), doorMat, s * 1.17, -0.55, 0.2, false);
    door.rotation.y = s * Math.PI / 2;
  }
  const rotor = new THREE.Group();
  rotor.position.set(0, 1.5, -0.2);
  const blade = m('#3a3d46', { roughness: 0.5 });
  add(rotor, boxGeo(11.5, 0.08, 0.5), blade, 0, 0, 0, false);
  add(rotor, boxGeo(0.5, 0.08, 11.5), blade, 0, 0, 0, false);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(5.8, 40), new THREE.MeshBasicMaterial({ color: '#c8ccd8', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 1.52; disc.position.z = -0.2;
  root.add(disc);
  add(root, boxGeo(0.3, 0.4, 0.3), TRIM, 0, 1.35, -0.2);
  root.add(rotor);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.22, 1.1, -7.0);
  add(tailRotor, boxGeo(0.06, 2.2, 0.25), blade, 0, 0, 0, false);
  root.add(tailRotor);
  const lamp = add(root, boxGeo(0.6, 0.5, 0.6), new THREE.MeshBasicMaterial({ color: '#fffbe0', toneMapped: false }), 0, -1.2, 2.2, false);
  // anti-collision beacons
  const beaconRed = new THREE.MeshBasicMaterial({ color: '#ff2030', toneMapped: false });
  const beaconWhite = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
  add(root, boxGeo(0.25, 0.25, 0.25), beaconRed, 0, 1.95, -7.0, false);
  add(root, boxGeo(0.22, 0.22, 0.22), beaconRed, 0, -1.0, -1.6, false);
  add(root, boxGeo(0.2, 0.2, 0.2), beaconWhite, 0, 0.6, -2.3, false);
  const beaconGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ff3040', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  beaconGlow.position.set(0, 1.95, -7.0); beaconGlow.scale.setScalar(3);
  root.add(beaconGlow);
  const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#fff6d0', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  lampGlow.position.set(0, -1.3, 2.3); lampGlow.scale.setScalar(4.5);
  root.add(lampGlow);
  return { root, rotor, tailRotor, lamp, beaconRed, beaconWhite, beaconGlow, lampGlow };
}
