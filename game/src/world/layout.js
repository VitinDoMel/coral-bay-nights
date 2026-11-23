// Coral Vista's map as data: the street grid, Seabreeze Boulevard on the coast, districts,
// points of interest, the bridge to Heron Key and the road graph the GPS routes on.
// Every other system (city builder, minimap, big map, traffic, missions) reads from here.

export const CELL = 64;
export const GRID = 7; // blocks per side; roads 0..7 per axis
export const ORIGIN = -224; // coordinate of road 0
export const SEA_X = 300; // shoreline
export const PROMENADE = [235, 247]; // the calçadão between boulevard and sand
export const BRIDGE = { z: -160, x0: 300, x1: 560, w: 16 };
export const ISLAND = { minX: 560, maxX: 760, minZ: -300, maxZ: -30 };
export const PIER = { minX: 296, maxX: 352, minZ: 166, maxZ: 232 };
/** Heron Key marina on the island's south shore: Don Marlon's yacht waits at its end. */
export const MARINA = { x0: 600, x1: 740, z: -30, len: 46, yacht: { x: 680, z: 6 } };
/** Boats moored or drifting in Coral Bay (x, z, heading, kind). */
export const BOATS = [
  [640, 2, 0.1, 'speed'], [618, 10, 0, 'sail'], [705, 14, 0.05, 'speed'], [725, 0, -0.1, 'sail'],
  [430, 60, 1.2, 'sail'], [520, 140, -0.6, 'speed'], [395, -40, 2.4, 'sail'], [470, -260, 0.4, 'speed'],
  [370, 240, 0.9, 'sail'], [880, -120, -1.1, 'sail'], [330, 120, 3.0, 'speed'],
];
export const BOUNDS = { minX: -262, maxX: 790, minZ: -330, maxZ: 262 };

const X_NAMES = ['Mangrove St', 'Flamingo St', 'Orchid St', 'Palmera Ave', 'Coquina St', 'Marlin St', 'Tarpon St', 'Seabreeze Blvd'];
const Z_NAMES = ['Lighthouse Rd', 'Bridgeview Rd', 'Pelican St', 'Sunset Ave', 'Gardenia St', 'Harbor St', 'Anchor St', 'Dockside Rd'];

/** Road width per index: avenues are wider, the boulevard widest. */
function widthFor(axis, i) {
  if (axis === 'x' && i === 7) return 22;
  if ((axis === 'x' && i === 3) || (axis === 'z' && i === 3)) return 20;
  return 14;
}

export const ROADS_X = Array.from({ length: GRID + 1 }, (_, i) => ({
  i, x: ORIGIN + i * CELL, w: widthFor('x', i), name: X_NAMES[i], avenue: i === 3 || i === 7,
}));
export const ROADS_Z = Array.from({ length: GRID + 1 }, (_, j) => ({
  j, z: ORIGIN + j * CELL, w: widthFor('z', j), name: Z_NAMES[j], avenue: j === 3,
}));

export const DISTRICTS = {
  downtown: { name: 'Downtown', color: '#3d4f7c', kind: 'tower' },
  strip: { name: 'Seabreeze Strip', color: '#7a4b7e', kind: 'hotel' },
  heights: { name: 'Palmera Heights', color: '#3f6b55', kind: 'house' },
  flats: { name: 'Hibiscus Flats', color: '#7a5a46', kind: 'apartment' },
  midtown: { name: 'Midtown', color: '#4c5f86', kind: 'midrise' },
  uptown: { name: 'Uptown', color: '#56607a', kind: 'midrise' },
  port: { name: 'Port Coquina', color: '#6b6458', kind: 'port' },
  park: { name: 'Lagoon Park', color: '#3b7a4a', kind: 'park' },
  key: { name: 'Heron Key', color: '#466e4f', kind: 'villa' },
};

function districtOf(bx, bz) {
  if (bx === 2 && bz === 4) return 'park';
  if (bz === 6 && bx >= 3) return 'port';
  if (bx === 6) return 'strip';
  if (bx <= 1 && bz <= 3) return 'heights';
  if (bx <= 2 && bz >= 4) return 'flats';
  if (bx >= 2 && bx <= 4 && bz >= 1 && bz <= 3) return 'downtown';
  if (bz === 0) return 'uptown';
  return 'midtown';
}

export const BLOCKS = [];
for (let bx = 0; bx < GRID; bx++) {
  for (let bz = 0; bz < GRID; bz++) {
    const rx0 = ROADS_X[bx], rx1 = ROADS_X[bx + 1], rz0 = ROADS_Z[bz], rz1 = ROADS_Z[bz + 1];
    BLOCKS.push({
      bx, bz,
      minX: rx0.x + rx0.w / 2, maxX: rx1.x - rx1.w / 2,
      minZ: rz0.z + rz0.w / 2, maxZ: rz1.z - rz1.w / 2,
      district: districtOf(bx, bz),
    });
  }
}

export const blockAt = (bx, bz) => BLOCKS[bx * GRID + bz];

/** Point on the sidewalk in front of a block's side ('n','s','e','w'), t in 0..1 along it. */
export function curbPoint(bx, bz, side, t = 0.5, inset = 2.2) {
  const b = blockAt(bx, bz);
  if (side === 'n') return { x: b.minX + (b.maxX - b.minX) * t, z: b.minZ + inset };
  if (side === 's') return { x: b.minX + (b.maxX - b.minX) * t, z: b.maxZ - inset };
  if (side === 'w') return { x: b.minX + inset, z: b.minZ + (b.maxZ - b.minZ) * t };
  return { x: b.maxX - inset, z: b.minZ + (b.maxZ - b.minZ) * t };
}

/** Point on a road lane next to a block side (where a car parks or a marker sits). */
export function roadPoint(bx, bz, side, t = 0.5, off = 4) {
  const b = blockAt(bx, bz);
  if (side === 'n') return { x: b.minX + (b.maxX - b.minX) * t, z: b.minZ - off };
  if (side === 's') return { x: b.minX + (b.maxX - b.minX) * t, z: b.maxZ + off };
  if (side === 'w') return { x: b.minX - off, z: b.minZ + (b.maxZ - b.minZ) * t };
  return { x: b.maxX + off, z: b.minZ + (b.maxZ - b.minZ) * t };
}

// Points of interest. `icon` is the letter shown on the maps.
export const POI = {
  hospital: { name: 'Vista General', icon: '+', color: '#ff5a6a', ...curbPoint(1, 2, 'e', 0.5), block: [1, 2] },
  precinct: { name: 'CVPD Precinct', icon: 'P', color: '#4f8dff', ...curbPoint(2, 5, 'n', 0.5), block: [2, 5] },
  arms: { name: 'Coral Arms', icon: 'A', color: '#ff8a3d', ...curbPoint(4, 4, 'n', 0.35), block: [4, 4] },
  garage: { name: 'Manta Motors', icon: 'M', color: '#35d0ba', ...curbPoint(5, 5, 'e', 0.5), block: [5, 5] },
  loft: { name: "Nina's Loft", icon: 'N', color: '#b08cff', ...curbPoint(3, 3, 'w', 0.5), block: [3, 3] },
  cab: { name: 'Vista Cab Depot', icon: 'T', color: '#ffd23f', ...curbPoint(4, 2, 'e', 0.5), block: [4, 2] },
  race: { name: 'Seabreeze Sprint', icon: 'R', color: '#59e36b', x: 241, z: 120 },
};

export function isOnIsland(x, z) {
  return x >= ISLAND.minX && x <= ISLAND.maxX && z >= ISLAND.minZ && z <= ISLAND.maxZ;
}
export function isOnBridge(x, z) {
  return x >= BRIDGE.x0 - 2 && x <= BRIDGE.x1 + 2 && Math.abs(z - BRIDGE.z) <= BRIDGE.w / 2;
}
export function isOnPier(x, z) {
  return x >= PIER.minX && x <= PIER.maxX && z >= PIER.minZ && z <= PIER.maxZ;
}

/** True where a person or car may stand (land, beach, bridge deck, pier, island). */
export function isWalkable(x, z) {
  if (x < BOUNDS.minX || x > BOUNDS.maxX || z < BOUNDS.minZ || z > BOUNDS.maxZ) return false;
  if (x < SEA_X) return true;
  const onMarina = x >= MARINA.x0 && x <= MARINA.x1 && z >= MARINA.z - 14 && z <= MARINA.z + 4;
  return isOnBridge(x, z) || isOnPier(x, z) || isOnIsland(x, z) || onMarina;
}

export function roadNameAt(x, z) {
  let best = null, bd = 1e9;
  for (const r of ROADS_X) { const d = Math.abs(x - r.x); if (d < bd && z > -240 && z < 240) { bd = d; best = r.name; } }
  for (const r of ROADS_Z) { const d = Math.abs(z - r.z); if (d < bd && x > -240 && x < 240) { bd = d; best = r.name; } }
  if (isOnBridge(x, z)) return 'Heron Bridge';
  if (x > PROMENADE[0] && x < SEA_X) return 'Seabreeze Beach';
  return best ?? 'Coral Vista';
}

export function districtAt(x, z) {
  if (isOnIsland(x, z) || x > BRIDGE.x1) return DISTRICTS.key.name;
  if (x > PROMENADE[0]) return 'Seabreeze Beach';
  const bx = Math.min(GRID - 1, Math.floor((x - ORIGIN) / CELL)), bz = Math.min(GRID - 1, Math.floor((z - ORIGIN) / CELL));
  if (bx < 0 || bz < 0 || bx >= GRID || bz >= GRID) return 'Coral Vista';
  return DISTRICTS[blockAt(bx, bz).district].name;
}

// ---- Road graph for GPS and traffic ----------------------------------------------
// Nodes are the 8x8 intersections plus the bridge end and the island centre.
export const NODES = [];
const nodeIndex = (i, j) => i * (GRID + 1) + j;
for (let i = 0; i <= GRID; i++) for (let j = 0; j <= GRID; j++) NODES.push({ x: ROADS_X[i].x, z: ROADS_Z[j].z, edges: [] });
function link(a, b) { NODES[a].edges.push(b); NODES[b].edges.push(a); }
for (let i = 0; i <= GRID; i++) for (let j = 0; j <= GRID; j++) {
  if (i < GRID) link(nodeIndex(i, j), nodeIndex(i + 1, j));
  if (j < GRID) link(nodeIndex(i, j), nodeIndex(i, j + 1));
}
const bridgeEnd = NODES.push({ x: BRIDGE.x1 + 30, z: BRIDGE.z, edges: [] }) - 1;
link(nodeIndex(7, 1), bridgeEnd);
const islandHub = NODES.push({ x: 680, z: -160, edges: [] }) - 1;
link(bridgeEnd, islandHub);
export const ISLAND_HUB = islandHub;

export function nearestNode(x, z) {
  let best = 0, bd = Infinity;
  NODES.forEach((n, k) => { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = k; } });
  return best;
}

/** A* over the road graph; returns world points from (ax,az) to (bx,bz). */
export function routeBetween(ax, az, bx, bz) {
  const s = nearestNode(ax, az), g = nearestNode(bx, bz);
  const open = new Set([s]), came = new Map(), gs = new Map([[s, 0]]);
  const h = (k) => Math.abs(NODES[k].x - NODES[g].x) + Math.abs(NODES[k].z - NODES[g].z);
  const fs = new Map([[s, h(s)]]);
  while (open.size) {
    let cur = null, cf = Infinity;
    for (const k of open) if ((fs.get(k) ?? Infinity) < cf) { cf = fs.get(k); cur = k; }
    if (cur === g) break;
    open.delete(cur);
    for (const nb of NODES[cur].edges) {
      const t = gs.get(cur) + Math.hypot(NODES[nb].x - NODES[cur].x, NODES[nb].z - NODES[cur].z);
      if (t < (gs.get(nb) ?? Infinity)) { came.set(nb, cur); gs.set(nb, t); fs.set(nb, t + h(nb)); open.add(nb); }
    }
  }
  const pts = [{ x: bx, z: bz }];
  let k = g;
  while (k !== undefined) { pts.push({ x: NODES[k].x, z: NODES[k].z }); k = came.get(k); }
  pts.push({ x: ax, z: az });
  return pts.reverse();
}
