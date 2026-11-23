// Low-poly people shared by the player, pedestrians, cops and gang members: jointed boxes
// (legs, torso, arms, head, hair, optional cap/vest/shades) with walk, run, aim, punch,
// sit-in-car and knocked-down poses, plus the weapon models held in the right hand.
import * as THREE from 'three';

const geoCache = new Map();
const matCache = new Map();
function box(w, h, d) {
  const k = `${w}|${h}|${d}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}
export function mat(color, opts = {}) {
  const k = color + JSON.stringify(opts);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...opts }));
  return matCache.get(k);
}
function part(parent, geo, material, x, y, z) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

export const SKIN = ['#f1c7a5', '#d9a27c', '#b97a56', '#8d5a3b', '#5e3b26', '#f6d5bd'];
export const HAIR = ['#1d1410', '#3b2516', '#6b3e1f', '#c9a15a', '#2a2a2a', '#8a2f1f'];
export const SHIRTS = ['#ff6f91', '#2ec4b6', '#ffbe0b', '#8338ec', '#ffffff', '#3a86ff', '#fb5607', '#90be6d', '#f4a261', '#e9c46a'];
export const PANTS = ['#2b2d42', '#3d405b', '#c2b280', '#6c757d', '#f1faee', '#264653'];

/**
 * look: { skin, hair, shirt, pants, shoes, cap, vest, shades, accent, hairStyle: 'short'|'long'|'bald'|'bun' }
 */
export function buildHuman(look) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = mat(look.skin ?? SKIN[0]);
  const shirt = mat(look.shirt ?? SHIRTS[0]);
  const pants = mat(look.pants ?? PANTS[0]);
  const shoes = mat(look.shoes ?? '#222');

  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-0.13, 0.95, 0); legR.position.set(0.13, 0.95, 0);
  for (const leg of [legL, legR]) {
    part(leg, box(0.22, 0.86, 0.24), pants, 0, -0.45, 0);
    part(leg, box(0.24, 0.12, 0.34), shoes, 0, -0.9, 0.05);
    body.add(leg);
  }
  const torso = part(body, box(0.52, 0.64, 0.3), shirt, 0, 1.28, 0);
  if (look.accent) part(body, box(0.18, 0.5, 0.31), mat(look.accent), 0, 1.3, 0.005); // open-shirt tee stripe
  if (look.vest) part(body, box(0.56, 0.46, 0.34), mat(look.vest), 0, 1.33, 0);
  if (look.badge) part(body, box(0.08, 0.08, 0.02), mat('#ffd166', { metalness: 0.8, roughness: 0.3 }), -0.13, 1.45, 0.16);
  const head = new THREE.Group();
  head.position.set(0, 1.62, 0);
  body.add(head);
  part(head, box(0.12, 0.1, 0.12), skin, 0, 0.04, 0); // neck
  part(head, box(0.3, 0.32, 0.3), skin, 0, 0.24, 0);
  const hair = mat(look.hair ?? HAIR[0]);
  const style = look.hairStyle ?? 'short';
  if (style === 'short') part(head, box(0.32, 0.1, 0.32), hair, 0, 0.42, -0.01);
  if (style === 'long') { part(head, box(0.33, 0.12, 0.33), hair, 0, 0.42, -0.01); part(head, box(0.33, 0.34, 0.08), hair, 0, 0.22, -0.16); }
  if (style === 'bun') { part(head, box(0.32, 0.1, 0.32), hair, 0, 0.42, -0.01); part(head, box(0.14, 0.14, 0.14), hair, 0, 0.5, -0.12); }
  if (look.cap) { part(head, box(0.34, 0.1, 0.34), mat(look.cap), 0, 0.44, 0); part(head, box(0.3, 0.04, 0.16), mat(look.cap), 0, 0.4, 0.22); }
  if (look.shades) part(head, box(0.3, 0.07, 0.03), mat('#111', { metalness: 0.6, roughness: 0.2 }), 0, 0.27, 0.16);
  else { part(head, box(0.05, 0.05, 0.02), mat('#1a1a1a'), -0.07, 0.27, 0.151); part(head, box(0.05, 0.05, 0.02), mat('#1a1a1a'), 0.07, 0.27, 0.151); }

  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-0.34, 1.54, 0); armR.position.set(0.34, 1.54, 0);
  for (const arm of [armL, armR]) {
    part(arm, box(0.16, 0.36, 0.18), shirt, 0, -0.16, 0);
    part(arm, box(0.14, 0.3, 0.16), skin, 0, -0.48, 0);
    body.add(arm);
  }
  const hand = new THREE.Group();
  hand.position.set(0, -0.64, 0.02);
  armR.add(hand);

  return { root, body, legL, legR, armL, armR, head, torso, hand, weaponModel: null, weaponId: -1 };
}

const GUN = mat('#24262b', { metalness: 0.6, roughness: 0.35 });
const WOOD = mat('#7a4a28');
const BAT = mat('#c9a06a');
const TUBE = mat('#4a5a3a');

/** Weapon meshes for the hand; ids follow the weapon rack (0 fists .. 6 launcher). */
export function weaponModel(id) {
  const g = new THREE.Group();
  const add = (w, h, d, m, x, y, z) => { const mesh = new THREE.Mesh(box(w, h, d), m); mesh.position.set(x, y, z); mesh.castShadow = true; g.add(mesh); };
  if (id === 1) add(0.07, 0.07, 0.95, BAT, 0, 0, 0.4);
  if (id === 2) { add(0.07, 0.12, 0.3, GUN, 0, 0.02, 0.14); add(0.06, 0.14, 0.07, GUN, 0, -0.07, 0.04); }
  if (id === 3) { add(0.08, 0.14, 0.5, GUN, 0, 0.02, 0.2); add(0.06, 0.2, 0.07, GUN, 0, -0.1, 0.1); }
  if (id === 4) { add(0.08, 0.1, 0.8, GUN, 0, 0.02, 0.3); add(0.09, 0.12, 0.3, WOOD, 0, -0.02, -0.08); }
  if (id === 5) { add(0.08, 0.12, 0.95, GUN, 0, 0.02, 0.35); add(0.06, 0.18, 0.08, GUN, 0, -0.1, 0.15); add(0.08, 0.1, 0.3, GUN, 0, 0, -0.1); }
  if (id === 6) { add(0.16, 0.16, 1.1, TUBE, 0, 0.06, 0.25); add(0.2, 0.2, 0.2, GUN, 0, 0.06, 0.85); }
  g.rotation.x = Math.PI / 2; // arm points down its -Y: turn the weapon's +Z along it
  return g;
}

export function setHeldWeapon(h, id) {
  if (h.weaponId === id) return;
  if (h.weaponModel) h.hand.remove(h.weaponModel);
  h.weaponModel = id > 0 ? weaponModel(id) : null;
  if (h.weaponModel) h.hand.add(h.weaponModel);
  h.weaponId = id;
}

/**
 * Pose for this frame. phase advances with distance walked; speed 0..1 (1 = sprint).
 * pose: 'move' | 'aim' | 'punch' | 'sit' | 'down' | 'cower' | 'hands'
 */
export function animateHuman(h, phase, speed, pose = 'move', aimPitch = 0, t = 0) {
  const sw = Math.sin(phase) * (0.35 + speed * 0.55) * Math.min(1, speed * 3);
  h.body.rotation.set(0, 0, 0);
  h.body.position.set(0, Math.abs(Math.cos(phase)) * 0.05 * Math.min(1, speed * 2), 0);
  h.legL.rotation.x = sw; h.legR.rotation.x = -sw;
  h.armL.rotation.set(-sw * 0.8, 0, 0);
  h.armR.rotation.set(sw * 0.8, 0, 0);
  h.head.rotation.set(0, 0, 0);
  if (pose === 'aim') {
    h.armR.rotation.set(-Math.PI / 2 - aimPitch, 0, 0);
    h.armL.rotation.set(-Math.PI / 2.3 - aimPitch, 0, 0.45);
    h.head.rotation.x = -aimPitch * 0.5;
  } else if (pose === 'punch') {
    const p = Math.sin(t * 18);
    h.armR.rotation.set(-Math.PI / 2 * (0.6 + 0.4 * Math.max(0, p)), 0, 0);
    h.armL.rotation.set(-Math.PI / 2 * 0.5, 0, 0.3);
  } else if (pose === 'sit') {
    h.legL.rotation.x = h.legR.rotation.x = -Math.PI / 2;
    h.armL.rotation.set(-1.1, 0, 0); h.armR.rotation.set(-1.1, 0, 0);
  } else if (pose === 'down') {
    h.body.rotation.x = -Math.PI / 2;
    h.body.position.set(0, 0.18, -0.9);
    h.armL.rotation.set(-2.6, 0, 0.3); h.armR.rotation.set(-2.4, 0, -0.3);
    h.legL.rotation.x = 0.15; h.legR.rotation.x = -0.1;
  } else if (pose === 'cower') {
    h.armL.rotation.set(-2.8, 0, 0.4); h.armR.rotation.set(-2.8, 0, -0.4);
  } else if (pose === 'hands') {
    h.armL.rotation.set(-3, 0, 0.2); h.armR.rotation.set(-3, 0, -0.2);
  }
}
