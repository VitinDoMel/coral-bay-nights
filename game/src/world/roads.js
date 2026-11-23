// Ground and road surfaces: asphalt, painted lane markings (white dashes on streets,
// double yellow on avenues and the boulevard), crosswalks at every junction, the
// promenade, the beach, the pier and the bridge road over the water.
import * as THREE from 'three';
import { ROADS_X, ROADS_Z, PROMENADE, SEA_X, BRIDGE, PIER, ISLAND } from './layout.js';
import { MeshBatch, hexToRgb } from './geom.js';
import { asphaltTexture, concreteTexture, sandTexture } from './textures.js';

const WHITE = hexToRgb('#f4f1ea');
const YELLOW = hexToRgb('#ffcc33');
const LINE_Y = 0.025;

export function buildRoads(scene, colliders) {
  const group = new THREE.Group();
  const minX = ROADS_X[0].x - 20, maxX = ROADS_X[7].x + 11;
  const minZ = ROADS_Z[0].z - 20, maxZ = ROADS_Z[7].z + 20;

  // Asphalt under the whole city; blocks sit on top as raised sidewalks.
  const asphalt = asphaltTexture();
  asphalt.repeat.set((maxX - minX) / 12, (maxZ - minZ) / 12);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX, maxZ - minZ), new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.92 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  ground.receiveShadow = true;
  group.add(ground);

  // Outer verge west/north/south so the city doesn't end in a void
  // reaches out to the hills on the horizon so they sit on the ground
  const verge = new THREE.Mesh(new THREE.PlaneGeometry(4000, 5000), new THREE.MeshStandardMaterial({ color: '#b9ab7e', roughness: 1 }));
  verge.rotation.x = -Math.PI / 2;
  verge.position.set(-1700, -0.05, 0);
  verge.receiveShadow = true;
  group.add(verge);

  const paint = new MeshBatch();
  // Lane markings along X roads (running north-south)
  for (const r of ROADS_X) {
    const z0 = minZ + 20, z1 = maxZ - 20;
    for (let k = 0; k < ROADS_Z.length - 1; k++) {
      const a = ROADS_Z[k].z + ROADS_Z[k].w / 2 + 4, b = ROADS_Z[k + 1].z - ROADS_Z[k + 1].w / 2 - 4;
      markSegment(paint, r.x, a, r.x, b, r.avenue, r.w);
    }
    // stretches beyond the outer junctions
    markSegment(paint, r.x, z0 - 10, r.x, ROADS_Z[0].z - ROADS_Z[0].w / 2 - 4, r.avenue, r.w);
    markSegment(paint, r.x, ROADS_Z[7].z + ROADS_Z[7].w / 2 + 4, r.x, z1 + 10, r.avenue, r.w);
  }
  for (const r of ROADS_Z) {
    for (let k = 0; k < ROADS_X.length - 1; k++) {
      const a = ROADS_X[k].x + ROADS_X[k].w / 2 + 4, b = ROADS_X[k + 1].x - ROADS_X[k + 1].w / 2 - 4;
      markSegment(paint, a, r.z, b, r.z, r.avenue, r.w);
    }
    markSegment(paint, minX + 4, r.z, ROADS_X[0].x - ROADS_X[0].w / 2 - 4, r.z, r.avenue, r.w);
  }
  // Crosswalks: zebra stripes on each approach of every junction
  for (const rx of ROADS_X) for (const rz of ROADS_Z) {
    const hx = rx.w / 2, hz = rz.w / 2;
    zebra(paint, rx.x, rz.z - hz - 2, rx.w - 1, 'x'); // north approach, stripes run across the X road
    zebra(paint, rx.x, rz.z + hz + 2, rx.w - 1, 'x');
    if (rx.i < 7) zebra(paint, rx.x + hx + 2, rz.z, rz.w - 1, 'z');
    zebra(paint, rx.x - hx - 2, rz.z, rz.w - 1, 'z');
    // stop lines
    paint.quad(rx.x + rx.w / 4, LINE_Y, rz.z - hz - 4.4, rx.w / 2 - 0.6, 0.45, 0, WHITE);
    paint.quad(rx.x - rx.w / 4, LINE_Y, rz.z + hz + 4.4, rx.w / 2 - 0.6, 0.45, 0, WHITE);
  }
  // Bridge road markings
  markSegment(paint, PROMENADE[0], BRIDGE.z, BRIDGE.x1 + 40, BRIDGE.z, true, BRIDGE.w);
  const paintMesh = new THREE.Mesh(paint.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }));
  paintMesh.receiveShadow = true;
  group.add(paintMesh);

  // Promenade (calçadão) with a wave-pattern tile and the beach
  const promTex = concreteTexture('#f1e6d4', 21);
  promTex.repeat.set(3, 120);
  const prom = new THREE.Mesh(new THREE.BoxGeometry(PROMENADE[1] - PROMENADE[0], 0.16, maxZ - minZ + 40), new THREE.MeshStandardMaterial({ map: promTex, roughness: 0.9 }));
  prom.position.set((PROMENADE[0] + PROMENADE[1]) / 2, 0.08, (minZ + maxZ) / 2 - 20);
  prom.receiveShadow = true;
  group.add(prom);

  const sand = sandTexture();
  sand.repeat.set(10, 80);
  const beachW = SEA_X + 30 - PROMENADE[1];
  const beachGeo = new THREE.PlaneGeometry(beachW, 700, 8, 1);
  // slope the last stretch of sand down under the water line
  const p = beachGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const lx = p.getX(i) + beachW / 2; // 0 at promenade
    const wx = PROMENADE[1] + lx;
    p.setZ(i, wx > SEA_X - 25 ? -(wx - (SEA_X - 25)) * 0.05 : 0.03);
  }
  beachGeo.computeVertexNormals();
  const beach = new THREE.Mesh(beachGeo, new THREE.MeshStandardMaterial({ map: sand, roughness: 1 }));
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(PROMENADE[1] + beachW / 2, 0, -20);
  beach.receiveShadow = true;
  group.add(beach);

  // Heron Key sand ring
  const islandSand = new THREE.Mesh(new THREE.BoxGeometry(ISLAND.maxX - ISLAND.minX + 24, 0.4, ISLAND.maxZ - ISLAND.minZ + 24), new THREE.MeshStandardMaterial({ map: sand, roughness: 1 }));
  islandSand.position.set((ISLAND.minX + ISLAND.maxX) / 2, -0.2, (ISLAND.minZ + ISLAND.maxZ) / 2);
  islandSand.receiveShadow = true;
  group.add(islandSand);

  // Pier: concrete slab on the water by the port
  const pierTex = concreteTexture('#b9b3a6', 33);
  pierTex.repeat.set(6, 6);
  const pier = new THREE.Mesh(new THREE.BoxGeometry(PIER.maxX - PIER.minX, 1.4, PIER.maxZ - PIER.minZ), new THREE.MeshStandardMaterial({ map: pierTex, roughness: 0.9 }));
  pier.position.set((PIER.minX + PIER.maxX) / 2, -0.7, (PIER.minZ + PIER.maxZ) / 2);
  pier.receiveShadow = true;
  group.add(pier);

  buildBridge(group, colliders);
  scene.add(group);
  return group;
}

function markSegment(b, x0, z0, x1, z1, avenue, width) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < 2) return;
  const dirX = (x1 - x0) / len, dirZ = (z1 - z0) / len;
  const rot = Math.atan2(dirX, dirZ);
  const px = -dirZ, pz = dirX; // perpendicular
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  if (avenue) {
    b.quad(mx + px * 0.22, LINE_Y, mz + pz * 0.22, 0.16, len, rot, YELLOW);
    b.quad(mx - px * 0.22, LINE_Y, mz - pz * 0.22, 0.16, len, rot, YELLOW);
    // lane dividers
    const off = width / 4;
    for (const s of [-1, 1]) dashes(b, x0 + px * off * s, z0 + pz * off * s, dirX, dirZ, len, rot);
  } else {
    dashes(b, x0, z0, dirX, dirZ, len, rot);
  }
  // edge lines
  const e = width / 2 - 0.5;
  for (const s of [-1, 1]) b.quad(mx + px * e * s, LINE_Y, mz + pz * e * s, 0.14, len, rot, WHITE);
}

function dashes(b, x0, z0, dx, dz, len, rot) {
  for (let t = 1.5; t < len - 1.5; t += 6) b.quad(x0 + dx * t, LINE_Y, z0 + dz * t, 0.18, 3, rot, WHITE);
}

function zebra(b, cx, cz, span, axis) {
  for (let s = -span / 2 + 0.6; s < span / 2; s += 1.3) {
    if (axis === 'x') b.quad(cx + s, LINE_Y, cz, 0.65, 3, 0, WHITE);
    else b.quad(cx, LINE_Y, cz + s, 3, 0.65, 0, WHITE);
  }
}

function buildBridge(group, colliders) {
  const len = BRIDGE.x1 - SEA_X + 24;
  const cx = (SEA_X - 12 + BRIDGE.x1 + 12) / 2;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 1.2, BRIDGE.w + 3), new THREE.MeshStandardMaterial({ color: '#d8d2c6', roughness: 0.8 }));
  deck.position.set(cx, -0.6, BRIDGE.z);
  deck.receiveShadow = true; deck.castShadow = true;
  group.add(deck);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(len, BRIDGE.w), new THREE.MeshStandardMaterial({ color: '#53545c', roughness: 0.9 }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(cx, 0.012, BRIDGE.z);
  road.receiveShadow = true;
  group.add(road);
  const pillarMat = new THREE.MeshStandardMaterial({ color: '#efe9dc', roughness: 0.7 });
  const cableMat = new THREE.MeshStandardMaterial({ color: '#ff6f61', roughness: 0.5 });
  const railMat = new THREE.MeshStandardMaterial({ color: '#f5f2ea', roughness: 0.5 });
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 1.1, 0.4), railMat);
    rail.position.set(cx, 0.55, BRIDGE.z + s * (BRIDGE.w / 2 + 0.9));
    rail.castShadow = true;
    group.add(rail);
    colliders.add(SEA_X - 12, BRIDGE.z + s * (BRIDGE.w / 2 + 0.9) - 0.3, BRIDGE.x1 + 12, BRIDGE.z + s * (BRIDGE.w / 2 + 0.9) + 0.3, 1.1, 'rail');
  }
  for (let x = SEA_X + 20; x < BRIDGE.x1; x += 40) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(3, 8, BRIDGE.w + 2), pillarMat);
    p.position.set(x, -5, BRIDGE.z);
    group.add(p);
  }
  // two towers with coral cables (suspension look)
  for (const tx of [SEA_X + 80, BRIDGE.x1 - 80]) {
    for (const s of [-1, 1]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(2.4, 34, 2.4), pillarMat);
      t.position.set(tx, 17, BRIDGE.z + s * (BRIDGE.w / 2 + 2.6));
      t.castShadow = true;
      group.add(t);
      colliders.add(tx - 1.2, BRIDGE.z + s * (BRIDGE.w / 2 + 2.6) - 1.2, tx + 1.2, BRIDGE.z + s * (BRIDGE.w / 2 + 2.6) + 1.2, 34, 'pillar');
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2, BRIDGE.w + 7.6), pillarMat);
    beam.position.set(tx, 33, BRIDGE.z);
    group.add(beam);
  }
  for (const s of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const x = SEA_X - 10 + (BRIDGE.x1 - SEA_X + 20) * (i / 40);
      const a = SEA_X + 80, b = BRIDGE.x1 - 80;
      let y;
      if (x < a) y = 2 + (x - (SEA_X - 10)) / (a - SEA_X + 10) * 31;
      else if (x > b) y = 2 + (BRIDGE.x1 + 10 - x) / (BRIDGE.x1 + 10 - b) * 31;
      else { const u = (x - a) / (b - a); y = 33 - Math.sin(u * Math.PI) * 27; }
      pts.push(new THREE.Vector3(x, y, BRIDGE.z + s * (BRIDGE.w / 2 + 2.6)));
    }
    const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.35, 5), cableMat);
    group.add(cable);
    for (let i = 2; i < 39; i += 2) {
      const pnt = pts[i];
      const h = pnt.y - 0.5;
      const hang = new THREE.Mesh(new THREE.BoxGeometry(0.12, h, 0.12), cableMat);
      hang.position.set(pnt.x, 0.5 + h / 2, pnt.z);
      group.add(hang);
    }
  }
}
