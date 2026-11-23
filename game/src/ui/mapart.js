// Paints Coral Vista as a flat map (used by the minimap and the big map): dark land,
// district-tinted blocks, roads with avenue lines, the beach, turquoise shallows fading to
// deep water, the pier, the bridge and Heron Key. Painted once into an offscreen canvas.
import { BLOCKS, DISTRICTS, ROADS_X, ROADS_Z, PROMENADE, SEA_X, BRIDGE, ISLAND, PIER, BOUNDS, MARINA, BOATS } from '../world/layout.js';

export const MAP = { minX: BOUNDS.minX - 40, maxX: BOUNDS.maxX + 40, minZ: BOUNDS.minZ - 40, maxZ: BOUNDS.maxZ + 40 };
export const MAP_SCALE = 2; // pixels per metre in the offscreen map

let cached = null;

export function mapCanvas() {
  if (cached) return cached;
  const W = Math.ceil((MAP.maxX - MAP.minX) * MAP_SCALE), H = Math.ceil((MAP.maxZ - MAP.minZ) * MAP_SCALE);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const X = (x) => (x - MAP.minX) * MAP_SCALE, Z = (z) => (z - MAP.minZ) * MAP_SCALE, S = (m) => m * MAP_SCALE;

  // sea gradient east of the shore
  g.fillStyle = '#1c2230'; g.fillRect(0, 0, W, H);
  const sea = g.createLinearGradient(X(SEA_X), 0, X(SEA_X + 260), 0);
  sea.addColorStop(0, '#45e0d2'); sea.addColorStop(0.25, '#1fb3c9'); sea.addColorStop(1, '#14709e');
  g.fillStyle = sea; g.fillRect(X(SEA_X), 0, W - X(SEA_X), H);
  // land
  g.fillStyle = '#262a35'; g.fillRect(0, 0, X(SEA_X), H);
  g.fillStyle = '#2f3542'; g.fillRect(X(ROADS_X[0].x - 20), Z(ROADS_Z[0].z - 20), S(ROADS_X[7].x + 11 - ROADS_X[0].x + 20), S(ROADS_Z[7].z - ROADS_Z[0].z + 40));
  // beach + promenade
  g.fillStyle = '#e6cf98'; g.fillRect(X(PROMENADE[1]), 0, X(SEA_X) - X(PROMENADE[1]), H);
  g.fillStyle = '#d9cbb3'; g.fillRect(X(PROMENADE[0]), 0, S(PROMENADE[1] - PROMENADE[0]), H);
  // island shallows + sand + lawn
  g.fillStyle = 'rgba(80,235,220,0.55)';
  g.fillRect(X(ISLAND.minX - 30), Z(ISLAND.minZ - 30), S(ISLAND.maxX - ISLAND.minX + 60), S(ISLAND.maxZ - ISLAND.minZ + 60));
  g.fillStyle = '#e6cf98'; g.fillRect(X(ISLAND.minX - 12), Z(ISLAND.minZ - 12), S(ISLAND.maxX - ISLAND.minX + 24), S(ISLAND.maxZ - ISLAND.minZ + 24));
  g.fillStyle = DISTRICTS.key.color; g.fillRect(X(ISLAND.minX), Z(ISLAND.minZ), S(ISLAND.maxX - ISLAND.minX), S(ISLAND.maxZ - ISLAND.minZ));
  // villas and a ring path on Heron Key
  g.fillStyle = '#f0e6d2';
  for (let i = 0; i < 9; i++) {
    const vx = ISLAND.minX + 30 + (i % 3) * 60, vz = ISLAND.minZ + 30 + Math.floor(i / 3) * 85;
    if (Math.abs(vz + 160) < 18) continue;
    g.fillRect(X(vx - 8), Z(vz - 6), S(16), S(12));
  }
  g.strokeStyle = '#c9b48a'; g.lineWidth = S(3);
  g.strokeRect(X(ISLAND.minX + 12), Z(ISLAND.minZ + 12), S(ISLAND.maxX - ISLAND.minX - 24), S(ISLAND.maxZ - ISLAND.minZ - 24));
  // marina: boardwalk + finger piers
  g.fillStyle = '#b8895c';
  g.fillRect(X(MARINA.x0), Z(MARINA.z), S(MARINA.x1 - MARINA.x0), S(4));
  for (let x = MARINA.x0 + 8; x < MARINA.x1; x += 22) g.fillRect(X(x - 1.25), Z(MARINA.z + 2), S(2.5), S(MARINA.len));
  // boats
  for (const [bx, bz, h, kind] of BOATS) {
    g.save(); g.translate(X(bx), Z(bz)); g.rotate(-h);
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(0, 0, S(1.3), S(kind === 'sail' ? 3.6 : 3.2), 0, 0, 7); g.fill();
    g.restore();
  }
  g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(X(MARINA.yacht.x), Z(MARINA.yacht.z + 4), S(2.6), S(9), 0, 0, 7); g.fill();
  // pier
  g.fillStyle = '#8a8478'; g.fillRect(X(PIER.minX), Z(PIER.minZ), S(PIER.maxX - PIER.minX), S(PIER.maxZ - PIER.minZ));
  // roads (asphalt between blocks already dark; draw lighter road bands)
  g.fillStyle = '#8b93a3';
  for (const r of ROADS_X) g.fillRect(X(r.x - r.w / 2), Z(ROADS_Z[0].z - 20), S(r.w), S(ROADS_Z[7].z - ROADS_Z[0].z + 40));
  for (const r of ROADS_Z) g.fillRect(X(ROADS_X[0].x - 20), Z(r.z - r.w / 2), S(ROADS_X[7].x + 11 - ROADS_X[0].x + 20), S(r.w));
  // bridge
  g.fillRect(X(PROMENADE[0]), Z(BRIDGE.z - BRIDGE.w / 2), X(BRIDGE.x1 + 50) - X(PROMENADE[0]), S(BRIDGE.w));
  g.fillRect(X(ISLAND.minX), Z(-160 - 5), S(ISLAND.maxX - ISLAND.minX - 10), S(10));
  // blocks
  for (const b of BLOCKS) {
    g.fillStyle = DISTRICTS[b.district].color;
    g.fillRect(X(b.minX) + 1, Z(b.minZ) + 1, S(b.maxX - b.minX) - 2, S(b.maxZ - b.minZ) - 2);
  }
  // avenue centre lines
  g.strokeStyle = '#ffcc33'; g.lineWidth = 1.5;
  for (const r of ROADS_X) if (r.avenue) { g.beginPath(); g.moveTo(X(r.x), Z(ROADS_Z[0].z - 20)); g.lineTo(X(r.x), Z(ROADS_Z[7].z + 20)); g.stroke(); }
  for (const r of ROADS_Z) if (r.avenue) { g.beginPath(); g.moveTo(X(ROADS_X[0].x - 20), Z(r.z)); g.lineTo(X(ROADS_X[7].x), Z(r.z)); g.stroke(); }
  g.beginPath(); g.moveTo(X(PROMENADE[0]), Z(BRIDGE.z)); g.lineTo(X(BRIDGE.x1 + 40), Z(BRIDGE.z)); g.stroke();
  cached = c;
  return c;
}

/** World -> big-map canvas pixels given a view transform. */
export function worldToView(view, x, z) {
  return { x: (x - view.cx) * view.scale + view.w / 2, y: (z - view.cz) * view.scale + view.h / 2 };
}
