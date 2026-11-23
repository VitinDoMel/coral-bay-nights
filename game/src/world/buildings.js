// Procedural buildings for every block, by district: glass towers downtown, pastel hotels
// with neon on the Seabreeze Strip, mid-rises, apartments, houses, the port and the park.
// Geometry is batched per facade material; footprints go into the static colliders.
import * as THREE from 'three';
import { makeRng } from '../core/rng.js';
import { BLOCKS, POI, ISLAND } from './layout.js';
import { MeshBatch, hexToRgb } from './geom.js';
import { facadeTextures, FACADE_TILE, concreteTexture, grassTexture, signTexture } from './textures.js';

const PALETTE = {
  glass: ['#d5dde6', '#ece5d8', '#b8c6d4'],
  stucco: ['#f6b7c4', '#a8e3d4', '#ffd2a6', '#cdbaf3', '#fff0a6', '#f7f2e8', '#ffb59a'],
  house: ['#ffe3c6', '#cfe8f7', '#f9cad6', '#d9f1cf', '#fff5d6'],
};
const NEON = ['#ff3fa4', '#2ef2ff', '#ffb02e', '#b05cff', '#3dff9e'];
const HOTEL_NAMES = ['HOTEL MAREA', 'PALM CREST', 'COSTA AZUL', 'SOL Y MAR', 'THE BREAKERS', 'CORAL INN', 'VISTA SUITES'];
const SIDEWALK = 3.5;

export function buildCity(scene, colliders, seed = 1) {
  const rng = makeRng(seed * 7919);
  const facadeMats = new Map();
  const batches = new Map();
  const roof = new MeshBatch();
  const neon = new MeshBatch();
  const props = new MeshBatch(); // awnings, AC units, containers (vertex coloured)
  const walks = new MeshBatch();
  const lawns = new MeshBatch();
  const signs = [];
  const neonLights = [];

  function facade(style, color) {
    const key = style + color;
    if (!facadeMats.has(key)) {
      const tex = facadeTextures(style, color, facadeMats.size * 31 + 3);
      const mat = new THREE.MeshStandardMaterial({
        map: tex.map, emissiveMap: tex.emissive, emissive: 0xffffff, emissiveIntensity: 0.15,
        roughness: style === 'glass' ? 0.35 : 0.85, metalness: style === 'glass' ? 0.35 : 0.02,
      });
      facadeMats.set(key, mat);
      batches.set(key, new MeshBatch());
    }
    return batches.get(key);
  }

  function addBuilding(cx, cz, w, d, h, style, color, opts = {}) {
    facade(style, color).box(cx, h / 2, cz, w, h, d, { tile: [FACADE_TILE.w, FACADE_TILE.h] });
    // parapet roof slab
    const rc = hexToRgb(opts.roof ?? '#8c8796');
    roof.box(cx, h + 0.3, cz, w + 0.4, 0.6, d + 0.4, { color: rc, topColor: hexToRgb(opts.roofTop ?? '#6d6875') });
    if (opts.ac !== false && w > 8) {
      for (let i = 0; i < 2; i++) {
        props.box(cx + rng.range(-w / 4, w / 4), h + 1.2, cz + rng.range(-d / 4, d / 4), 2.2, 1.4, 2.2, { color: hexToRgb('#b9bcc6') });
      }
    }
    if (opts.neon) {
      const c = hexToRgb(opts.neon);
      const t = 0.35, y = h - 0.45; // flush with the cornice, so it never floats above the roofline
      neon.box(cx, y, cz - d / 2 - 0.22, w + 0.5, t, t, { color: c });
      neon.box(cx, y, cz + d / 2 + 0.22, w + 0.5, t, t, { color: c });
      if (!opts.neonBands) { // hotels keep only the street-facing bands; long roof edges read as stray lines from below
        neon.box(cx - w / 2 - 0.22, y, cz, t, t, d + 0.5, { color: c });
        neon.box(cx + w / 2 + 0.22, y, cz, t, t, d + 0.5, { color: c });
      }
      if (opts.neonBands) for (let yy = 12; yy < h - 4; yy += 14) {
        neon.box(cx, yy, cz - d / 2 - 0.12, w + 0.2, 0.25, 0.2, { color: c });
        neon.box(cx, yy, cz + d / 2 + 0.12, w + 0.2, 0.25, 0.2, { color: c });
      }
      neonLights.push({ x: cx, y: h, z: cz, color: opts.neon });
    }
    colliders.add(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, h + 1);
  }

  function awning(cx, cz, w, d, side) {
    const c = hexToRgb(rng.pick(['#ff6f91', '#2ec4b6', '#ffbe0b', '#8338ec', '#fb5607']));
    const off = side === 'n' ? [0, -d / 2 - 1] : side === 's' ? [0, d / 2 + 1] : side === 'w' ? [-w / 2 - 1, 0] : [w / 2 + 1, 0];
    const horiz = side === 'n' || side === 's';
    props.box(cx + off[0], 3.6, cz + off[1], horiz ? w * 0.8 : 2, 0.3, horiz ? 2 : d * 0.8, { color: c });
  }

  for (const b of BLOCKS) {
    const w = b.maxX - b.minX, d = b.maxZ - b.minZ;
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    // sidewalk slab under the whole block
    walks.box(cx, 0.075, cz, w, 0.15, d, { tile: [4, 4] });
    const lx0 = b.minX + SIDEWALK, lz0 = b.minZ + SIDEWALK, lw = w - SIDEWALK * 2, ld = d - SIDEWALK * 2;
    const kind = b.district;

    if (kind === 'park') {
      lawns.box(cx, 0.17, cz, lw, 0.05, ld, { tile: [6, 6] });
      continue;
    }
    if (kind === 'port') {
      for (let i = 0; i < 14; i++) {
        const stack = rng.int(1, 3);
        const px = lx0 + 4 + rng.next() * (lw - 8), pz = lz0 + 3 + rng.next() * (ld - 6);
        const rot = rng.next() < 0.5 ? 0 : Math.PI / 2;
        const col = hexToRgb(rng.pick(['#d1495b', '#00798c', '#edae49', '#30638e', '#66a182', '#e76f51']));
        for (let s = 0; s < stack; s++) props.box(px, 1.3 + s * 2.6, pz, 6, 2.6, 2.5, { color: col, rotY: rot });
        const hw = rot ? 1.25 : 3, hd = rot ? 3 : 1.25;
        colliders.add(px - hw, pz - hd, px + hw, pz + hd, stack * 2.6, 'container');
      }
      // warehouse
      addBuilding(lx0 + 9, lz0 + ld / 2, 14, ld - 6, 9, 'house', '#dcd6c8', { roof: '#7d8a96', ac: false });
      continue;
    }
    if (kind === 'house' || kind === 'villa') {
      lawns.box(cx, 0.17, cz, lw, 0.05, ld, { tile: [6, 6] });
      const n = 3, sw = lw / n, sd = ld / n;
      for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) {
        if (i === 1 && k === 1) continue; // back gardens in the middle
        const hx = lx0 + sw * (i + 0.5), hz = lz0 + sd * (k + 0.5);
        addBuilding(hx, hz, sw * 0.62, sd * 0.62, rng.range(4.5, 8), 'house', rng.pick(PALETTE.house),
          { roof: '#c9673f', roofTop: rng.pick(['#c45a3a', '#a64b39', '#d8794e']), ac: false });
      }
      continue;
    }

    // Split the remaining districts into lots
    const lots = [];
    if (kind === 'tower') {
      if (rng.next() < 0.5) lots.push([lx0, lz0, lw, ld]);
      else { lots.push([lx0, lz0, lw, ld / 2 - 1]); lots.push([lx0, lz0 + ld / 2 + 1, lw, ld / 2 - 1]); }
    } else {
      const g = 2;
      for (let i = 0; i < g; i++) for (let k = 0; k < g; k++) lots.push([lx0 + i * lw / g + 0.6, lz0 + k * ld / g + 0.6, lw / g - 1.2, ld / g - 1.2]);
    }
    for (const [x0, z0, ww, dd] of lots) {
      const ccx = x0 + ww / 2, ccz = z0 + dd / 2;
      if (kind === 'tower') {
        const podium = rng.range(7, 10);
        addBuilding(ccx, ccz, ww, dd, podium, 'stucco', rng.pick(PALETTE.stucco), { ac: false });
        const th = rng.range(38, 96), tw = ww * rng.range(0.6, 0.8), td = dd * rng.range(0.6, 0.8);
        const glassCol = rng.pick(PALETTE.glass);
        facade('glass', glassCol).box(ccx, podium + th / 2, ccz, tw, th, td, { tile: [FACADE_TILE.w, FACADE_TILE.h] });
        const top = podium + th;
        roof.box(ccx, top + 0.3, ccz, tw + 0.4, 0.6, td + 0.4, { color: hexToRgb('#7c8494') });
        if (rng.next() < 0.6) { // setback crown
          facade('glass', glassCol).box(ccx, top + 5, ccz, tw * 0.6, 10, td * 0.6, { tile: [FACADE_TILE.w, FACADE_TILE.h] });
          roof.box(ccx, top + 10.3, ccz, tw * 0.6 + 0.4, 0.6, td * 0.6 + 0.4, { color: hexToRgb('#7c8494') });
          props.box(ccx, top + 14, ccz, 0.4, 7, 0.4, { color: hexToRgb('#d8d8d8') });
        }
        if (rng.next() < 0.55) {
          const c = rng.pick(NEON);
          const ct = hexToRgb(c), yy = top - 0.5;
          neon.box(ccx, yy, ccz - td / 2 - 0.25, tw + 0.5, 0.4, 0.4, { color: ct });
          neon.box(ccx, yy, ccz + td / 2 + 0.25, tw + 0.5, 0.4, 0.4, { color: ct });
          neon.box(ccx - tw / 2 - 0.25, yy, ccz, 0.4, 0.4, td + 0.5, { color: ct });
          neon.box(ccx + tw / 2 + 0.25, yy, ccz, 0.4, 0.4, td + 0.5, { color: ct });
          // vertical corner strips make towers read as neon at dusk
          for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            neon.box(ccx + sx * (tw / 2 + 0.1), podium + th / 2, ccz + sz * (td / 2 + 0.1), 0.3, th, 0.3, { color: ct });
          }
        }
        colliders.add(x0, z0, x0 + ww, z0 + dd, top + 1);
      } else if (kind === 'hotel') {
        const h = rng.range(16, 42);
        const c = rng.pick(NEON);
        addBuilding(ccx, ccz, ww, dd, h, 'stucco', rng.pick(PALETTE.stucco), { neon: c, neonBands: true });
        if (ccx > 150) { // a blade sign sticking out over the boulevard, readable up and down the street
          signs.push({ text: HOTEL_NAMES[signs.length % HOTEL_NAMES.length], color: c, x: ccx + ww / 2 + 3.4, y: Math.min(h - 3, 14), z: ccz, rotY: 0, w: 6.4 });
        }
        if (rng.next() < 0.7) awning(ccx, ccz, ww, dd, 'e');
      } else {
        const tall = kind === 'midrise' || kind === 'uptown';
        const h = tall ? rng.range(11, 30) : rng.range(8, 16);
        const style = tall && rng.next() < 0.35 ? 'glass' : 'stucco';
        const opts = rng.next() < 0.3 ? { neon: rng.pick(NEON) } : {};
        addBuilding(ccx, ccz, ww, dd, h, style, rng.pick(style === 'glass' ? PALETTE.glass : PALETTE.stucco), opts);
        if (rng.next() < 0.6) awning(ccx, ccz, ww, dd, rng.pick(['n', 's', 'e', 'w']));
      }
    }
  }

  // Heron Key: villas on lawns
  lawns.box((ISLAND.minX + ISLAND.maxX) / 2, 0.06, (ISLAND.minZ + ISLAND.maxZ) / 2, ISLAND.maxX - ISLAND.minX, 0.12, ISLAND.maxZ - ISLAND.minZ, { tile: [6, 6] });
  for (let i = 0; i < 9; i++) {
    const vx = ISLAND.minX + 30 + (i % 3) * 60, vz = ISLAND.minZ + 30 + Math.floor(i / 3) * 85;
    if (Math.abs(vz - -160) < 18) continue;
    addBuilding(vx, vz, 16, 12, rng.range(6, 10), 'house', rng.pick(PALETTE.house), { roof: '#ece6da', roofTop: '#f2ede2', ac: false, neon: i % 3 === 0 ? '#2ef2ff' : undefined });
  }

  // POI storefront signs
  const poiSigns = [
    [POI.arms, 'CORAL ARMS', '#ff8a3d'], [POI.garage, 'MANTA MOTORS', '#35d0ba'], [POI.hospital, 'VISTA GENERAL', '#ff5a6a'],
    [POI.precinct, 'CVPD', '#4f8dff'], [POI.cab, 'VISTA CAB', '#ffd23f'], [POI.loft, "NINA'S LOFT", '#b08cff'],
  ];
  for (const [p, text, color] of poiSigns) {
    signs.push({ text, color, x: p.x, y: 5.2, z: p.z, rotY: 0, w: 8, poi: true });
  }

  // ---- Assemble meshes ----
  const group = new THREE.Group();
  for (const [key, batch] of batches) {
    const m = new THREE.Mesh(batch.build(), facadeMats.get(key));
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  }
  const roofMesh = new THREE.Mesh(roof.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  roofMesh.castShadow = true; roofMesh.receiveShadow = true;
  group.add(roofMesh);
  const propMesh = new THREE.Mesh(props.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
  propMesh.castShadow = true; propMesh.receiveShadow = true;
  group.add(propMesh);
  const neonMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  group.add(new THREE.Mesh(neon.build(), neonMat));
  const walkMesh = new THREE.Mesh(walks.build(), new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.95 }));
  walkMesh.receiveShadow = true;
  group.add(walkMesh);
  const lawnMesh = new THREE.Mesh(lawns.build(), new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 }));
  lawnMesh.receiveShadow = true;
  group.add(lawnMesh);

  const signMats = [];
  for (const s of signs) {
    const tex = signTexture(s.text, s.color);
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide });
    signMats.push(mat);
    const h = s.w / 4;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s.w, h), mat);
    mesh.position.set(s.x, s.y, s.z);
    mesh.rotation.y = s.rotY;
    if (s.poi) { // storefront sign: put it on the building face behind the curb point
      mesh.position.y = 4.6;
    }
    group.add(mesh);
  }
  scene.add(group);

  return {
    group,
    neonLights,
    /** dusk 0 = golden afternoon, 1 = neon dusk */
    setDusk(dusk) {
      for (const m of facadeMats.values()) m.emissiveIntensity = 0.05 + dusk * dusk * 2.0;
      const k = 0.55 + dusk * 0.9;
      neonMat.color.setRGB(k, k, k);
      for (const m of signMats) m.color.setRGB(0.7 + dusk * 0.5, 0.7 + dusk * 0.5, 0.7 + dusk * 0.5);
    },
  };
}
