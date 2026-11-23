// Street furniture and vegetation, instanced: palms with nine long drooping fronds, slim
// street lamps (heads glow at dusk), traffic signals, beach umbrellas, a lifeguard tower,
// benches and the port's gantry cranes.
import * as THREE from 'three';
import { makeRng } from '../core/rng.js';
import { BLOCKS, ROADS_X, ROADS_Z, PROMENADE, ISLAND, PIER, SEA_X, BRIDGE } from './layout.js';
import { mergeColored } from './geom.js';

function palmGeometry() {
  const parts = [];
  // curved trunk from stacked, slightly offset segments
  const segs = 7, H = 8.5;
  for (let i = 0; i < segs; i++) {
    const r0 = 0.24 - i * 0.012, r1 = 0.24 - (i + 1) * 0.012;
    const g = new THREE.CylinderGeometry(r1, r0, H / segs + 0.05, 7);
    const lean = (i / segs) ** 2 * 0.9;
    const m = new THREE.Matrix4().makeTranslation(lean, (i + 0.5) * (H / segs), 0);
    parts.push({ geo: g, color: i % 2 ? '#8a6a4a' : '#7a5c3f', matrix: m });
  }
  const top = new THREE.Vector3(0.9, H, 0);
  // nine fronds, ~5 m long, drooping
  for (let f = 0; f < 9; f++) {
    const a = (f / 9) * Math.PI * 2 + (f % 2) * 0.2;
    const pos = [];
    const steps = 7, L = 5.0;
    const ring = [];
    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      const r = u * L;
      const y = 0.5 * Math.sin(u * 1.2) - 2.6 * u * u;
      const w = Math.sin(Math.min(1, u * 1.6) * Math.PI) * 0.75 + 0.05;
      ring.push({ r, y, w });
    }
    const dirX = Math.cos(a), dirZ = Math.sin(a), px = -dirZ, pz = dirX;
    const P = (r, y, side, w) => [top.x + dirX * r + px * side * w, top.y + y - Math.abs(side) * w * 0.35, top.z + dirZ * r + pz * side * w];
    for (let s = 0; s < steps; s++) {
      const A = ring[s], B = ring[s + 1];
      for (const side of [-1, 1]) {
        const a0 = P(A.r, A.y, 0, 0), a1 = P(A.r, A.y, side, A.w), b0 = P(B.r, B.y, 0, 0), b1 = P(B.r, B.y, side, B.w);
        pos.push(...a0, ...a1, ...b1, ...a0, ...b1, ...b0);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    parts.push({ geo: g, color: f % 3 === 0 ? '#3f8f3a' : f % 3 === 1 ? '#4fa646' : '#2f7a35' });
  }
  // coconuts
  const nut = new THREE.SphereGeometry(0.2, 6, 5);
  for (let k = 0; k < 3; k++) parts.push({ geo: nut, color: '#6b4a2a', matrix: new THREE.Matrix4().makeTranslation(top.x + Math.cos(k * 2.1) * 0.25, H - 0.25, Math.sin(k * 2.1) * 0.25) });
  return mergeColored(parts);
}

function lampPoleGeometry() {
  const pole = new THREE.CylinderGeometry(0.08, 0.12, 7, 6);
  const arm = new THREE.BoxGeometry(1.8, 0.1, 0.1);
  return mergeColored([
    { geo: pole, color: '#3a3d44', matrix: new THREE.Matrix4().makeTranslation(0, 3.5, 0) },
    { geo: arm, color: '#3a3d44', matrix: new THREE.Matrix4().makeTranslation(0.85, 6.95, 0) },
  ]);
}

function signalGeometry() {
  const pole = new THREE.CylinderGeometry(0.1, 0.12, 5, 6);
  const arm = new THREE.BoxGeometry(4, 0.14, 0.14);
  const head = new THREE.BoxGeometry(0.4, 1.1, 0.4);
  const lamp = new THREE.SphereGeometry(0.12, 6, 4);
  return mergeColored([
    { geo: pole, color: '#2d3036', matrix: new THREE.Matrix4().makeTranslation(0, 2.5, 0) },
    { geo: arm, color: '#2d3036', matrix: new THREE.Matrix4().makeTranslation(2, 4.9, 0) },
    { geo: head, color: '#202226', matrix: new THREE.Matrix4().makeTranslation(3.6, 4.3, 0) },
    { geo: lamp, color: '#ff3b30', matrix: new THREE.Matrix4().makeTranslation(3.6, 4.65, 0.2) },
    { geo: lamp, color: '#ffcc00', matrix: new THREE.Matrix4().makeTranslation(3.6, 4.3, 0.2) },
    { geo: lamp, color: '#34c759', matrix: new THREE.Matrix4().makeTranslation(3.6, 3.95, 0.2) },
  ]);
}

function umbrellaGeometry(color) {
  return mergeColored([
    { geo: new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5), color: '#eeeeee', matrix: new THREE.Matrix4().makeTranslation(0, 1.2, 0) },
    { geo: new THREE.ConeGeometry(1.6, 0.6, 8), color, matrix: new THREE.Matrix4().makeTranslation(0, 2.5, 0) },
    { geo: new THREE.BoxGeometry(1, 0.05, 2), color: '#ffffff', matrix: new THREE.Matrix4().makeTranslation(1.3, 0.06, 0.4) },
  ]);
}

function instanced(group, geo, mat, list, shadow = true) {
  const m = new THREE.InstancedMesh(geo, mat, list.length);
  const o = new THREE.Object3D();
  list.forEach((t, i) => {
    o.position.set(t.x, t.y ?? 0, t.z);
    o.rotation.set(0, t.r ?? 0, 0);
    o.scale.setScalar(t.s ?? 1);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
  });
  m.castShadow = shadow;
  m.receiveShadow = true;
  group.add(m);
  return m;
}

export function buildProps(scene, colliders, seed = 1) {
  const rng = makeRng(seed * 104729);
  const group = new THREE.Group();
  const palms = [], lamps = [], signals = [], umbrellas = [[], [], [], []], benches = [];

  // Palms: both sides of Seabreeze Blvd, promenade, Sunset Ave, the park, Heron Key
  for (let z = -250; z < 250; z += 13) {
    if (Math.abs(z - BRIDGE.z) < 14) continue;
    palms.push({ x: PROMENADE[0] + 2, z: z + rng.range(-1, 1), r: rng.range(0, 6.28), s: rng.range(0.9, 1.15) });
    if (rng.next() < 0.6) palms.push({ x: PROMENADE[1] + rng.range(2, 14), z: z + rng.range(-5, 5), r: rng.range(0, 6.28), s: rng.range(0.85, 1.2) });
  }
  for (const b of BLOCKS) {
    if (b.district === 'park') {
      for (let i = 0; i < 16; i++) palms.push({ x: rng.range(b.minX + 5, b.maxX - 5), z: rng.range(b.minZ + 5, b.maxZ - 5), r: rng.range(0, 6.28), s: rng.range(0.8, 1.2) });
    }
    if (b.bx === 6) for (let z = b.minZ + 4; z < b.maxZ; z += 11) palms.push({ x: b.maxX - 1.2, z, r: rng.range(0, 6.28), s: 1 });
    // Sunset Ave (j=3) and Palmera Ave (i=3) are palm-lined
    if (b.bz === 2 || b.bz === 3) for (let x = b.minX + 5; x < b.maxX - 3; x += 12) palms.push({ x, z: b.bz === 2 ? b.maxZ - 1.2 : b.minZ + 1.2, r: rng.range(0, 6.28), s: 0.95 });
    if (b.bx === 2 || b.bx === 3) for (let z = b.minZ + 5; z < b.maxZ - 3; z += 12) palms.push({ x: b.bx === 2 ? b.maxX - 1.2 : b.minX + 1.2, z, r: rng.range(0, 6.28), s: 0.95 });
    // lamps along each block edge
    for (let t = 6; t < b.maxX - b.minX - 4; t += 22) {
      lamps.push({ x: b.minX + t, z: b.minZ + 0.6, r: Math.PI / 2 });
      lamps.push({ x: b.minX + t + 11, z: b.maxZ - 0.6, r: -Math.PI / 2 });
    }
    for (let t = 6; t < b.maxZ - b.minZ - 4; t += 22) {
      lamps.push({ x: b.minX + 0.6, z: b.minZ + t, r: Math.PI });
      lamps.push({ x: b.maxX - 0.6, z: b.minZ + t + 11, r: 0 });
    }
  }
  for (let i = 0; i < 26; i++) palms.push({ x: rng.range(ISLAND.minX + 6, ISLAND.maxX - 6), z: rng.range(ISLAND.minZ + 6, ISLAND.maxZ - 6), r: rng.range(0, 6.28), s: rng.range(0.9, 1.25) });
  for (let z = -240; z < 240; z += 24) lamps.push({ x: PROMENADE[0] + 0.8, z: z + 6, r: Math.PI });

  // Traffic signals on two corners of each junction
  for (const rx of ROADS_X) for (const rz of ROADS_Z) {
    if (rx.i === 7 && rz.j !== 1 && rz.j !== 3 && rz.j !== 5) continue;
    signals.push({ x: rx.x - rx.w / 2 - 1.2, z: rz.z - rz.w / 2 - 1.2, r: 0 });
    signals.push({ x: rx.x + rx.w / 2 + 1.2, z: rz.z + rz.w / 2 + 1.2, r: Math.PI });
  }

  // Beach umbrellas and towels in loose rows
  for (let z = -240; z < 240; z += 9) {
    if (Math.abs(z - BRIDGE.z) < 14 || (z > PIER.minZ - 6 && z < PIER.maxZ + 6)) continue;
    if (rng.next() < 0.65) umbrellas[rng.int(0, 3)].push({ x: rng.range(PROMENADE[1] + 18, SEA_X - 14), z: z + rng.range(-3, 3), r: rng.range(0, 6.28) });
  }
  for (let z = -230; z < 230; z += 17) benches.push({ x: PROMENADE[1] - 1, z, r: Math.PI / 2 });

  const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
  instanced(group, palmGeometry(), vc, palms);
  instanced(group, lampPoleGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), lamps);
  const headMat = new THREE.MeshBasicMaterial({ color: '#ffe6b0', toneMapped: false });
  const heads = lamps.map((l) => ({ x: l.x + Math.cos(-l.r) * 1.7, y: 6.85, z: l.z + Math.sin(-l.r) * 1.7, r: l.r }));
  instanced(group, new THREE.BoxGeometry(0.7, 0.18, 0.35), headMat, heads, false);
  // warm pools of light under each lamp, faded in at dusk
  const poolMat = new THREE.MeshBasicMaterial({ color: '#ffa860', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3 });
  const poolGeo = new THREE.CircleGeometry(3.2, 24).rotateX(-Math.PI / 2);
  const pools = instanced(group, poolGeo, poolMat, heads.map((h) => ({ x: h.x, y: 0.2, z: h.z })), false);
  pools.receiveShadow = false;
  pools.renderOrder = 2;
  instanced(group, signalGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), signals);
  const ucolors = ['#ff6f91', '#2ec4b6', '#ffbe0b', '#ffffff'];
  umbrellas.forEach((list, i) => list.length && instanced(group, umbrellaGeometry(ucolors[i]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), list));
  instanced(group, mergeColored([{ geo: new THREE.BoxGeometry(0.6, 0.45, 2.2), color: '#c48a5a', matrix: new THREE.Matrix4().makeTranslation(0, 0.45, 0) }]), new THREE.MeshStandardMaterial({ vertexColors: true }), benches);

  for (const p of palms) colliders.add(p.x - 0.3, p.z - 0.3, p.x + 0.3, p.z + 0.3, 8, 'palm');
  for (const l of lamps) colliders.add(l.x - 0.15, l.z - 0.15, l.x + 0.15, l.z + 0.15, 7, 'pole');

  // Lifeguard tower
  const tower = new THREE.Group();
  const stilt = new THREE.MeshStandardMaterial({ color: '#f2efe6' });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 0.2), stilt);
    leg.position.set(sx * 1.1, 1.3, sz * 1.1); tower.add(leg);
  }
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2, 2.8), new THREE.MeshStandardMaterial({ color: '#ff8fb1' }));
  cabin.position.y = 3.6; cabin.castShadow = true; tower.add(cabin);
  const troof = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 3.4), new THREE.MeshStandardMaterial({ color: '#2ec4b6' }));
  troof.position.y = 4.75; tower.add(troof);
  tower.position.set(SEA_X - 22, 0, 40);
  group.add(tower);

  // Port gantry cranes on the pier
  const craneMat = new THREE.MeshStandardMaterial({ color: '#e8572e', roughness: 0.6 });
  for (const cz of [180, 214]) {
    const c = new THREE.Group();
    for (const [lx, lz] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 26, 0.9), craneMat);
      leg.position.set(lx, 13, lz); leg.castShadow = true; c.add(leg);
    }
    const boom = new THREE.Mesh(new THREE.BoxGeometry(48, 1.6, 2.2), craneMat);
    boom.position.set(8, 26, 0); boom.castShadow = true; c.add(boom);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 3), new THREE.MeshStandardMaterial({ color: '#f4f1ea' }));
    cab.position.set(-2, 24, 0); c.add(cab);
    c.position.set(PIER.minX + 16, 0, cz);
    group.add(c);
    for (const [lx, lz] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) colliders.add(PIER.minX + 16 + lx - 0.5, cz + lz - 0.5, PIER.minX + 16 + lx + 0.5, cz + lz + 0.5, 26, 'crane');
  }

  scene.add(group);
  return {
    group,
    setDusk(d) {
      const k = 0.35 + d * 1.1;
      headMat.color.setRGB(1 * k, 0.9 * k, 0.69 * k);
      poolMat.opacity = Math.max(0, d - 0.55) * 0.6;
    },
  };
}
