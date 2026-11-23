// Static collision: every building, container, wall and prop footprint as an AABB in a
// spatial hash, plus circle push-out, sweeps and ray casts used by people, cars and bullets.
import { rayBox } from '../core/mathx.js';
import { isWalkable } from './layout.js';

const CELL = 16;

export class StaticColliders {
  constructor() {
    this.boxes = [];
    this.grid = new Map();
  }

  key(ix, iz) { return ix * 100003 + iz; }

  add(minX, minZ, maxX, maxZ, maxY = 50, tag = 'building') {
    const b = { minX, minZ, maxX, maxZ, minY: 0, maxY, tag, id: this.boxes.length };
    this.boxes.push(b);
    for (let ix = Math.floor(minX / CELL); ix <= Math.floor(maxX / CELL); ix++) {
      for (let iz = Math.floor(minZ / CELL); iz <= Math.floor(maxZ / CELL); iz++) {
        const k = this.key(ix, iz);
        if (!this.grid.has(k)) this.grid.set(k, []);
        this.grid.get(k).push(b);
      }
    }
    return b;
  }

  query(x, z, r) {
    const out = new Set();
    for (let ix = Math.floor((x - r) / CELL); ix <= Math.floor((x + r) / CELL); ix++) {
      for (let iz = Math.floor((z - r) / CELL); iz <= Math.floor((z + r) / CELL); iz++) {
        const cell = this.grid.get(this.key(ix, iz));
        if (cell) for (const b of cell) out.add(b);
      }
    }
    return out;
  }

  /**
   * Push a circle out of every box it overlaps. Mutates pos {x,z}; returns the collision
   * normal of the deepest contact (or null) so callers can bounce or take damage.
   */
  resolveCircle(pos, r, y = 0) {
    let hit = null, depthMax = 0;
    for (const b of this.query(pos.x, pos.z, r + 1)) {
      if (y > b.maxY) continue;
      const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      let dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      let d = Math.sqrt(d2), nx, nz;
      if (d < 1e-6) { // centre inside the box: push along the shallowest axis
        const opts = [[pos.x - b.minX, -1, 0], [b.maxX - pos.x, 1, 0], [pos.z - b.minZ, 0, -1], [b.maxZ - pos.z, 0, 1]];
        opts.sort((a, c) => a[0] - c[0]);
        nx = opts[0][1]; nz = opts[0][2]; d = -opts[0][0];
      } else { nx = dx / d; nz = dz / d; }
      const depth = r - d;
      pos.x += nx * depth; pos.z += nz * depth;
      if (depth > depthMax) { depthMax = depth; hit = { nx, nz, depth, box: b }; }
    }
    return hit;
  }

  /** Keep a mover on walkable ground (not in the sea) by reverting the offending axis. */
  keepOnLand(pos, prevX, prevZ) {
    if (isWalkable(pos.x, pos.z)) return false;
    if (isWalkable(prevX, pos.z)) pos.x = prevX;
    else if (isWalkable(pos.x, prevZ)) pos.z = prevZ;
    else { pos.x = prevX; pos.z = prevZ; }
    return true;
  }

  /** Nearest static hit along a ray, as distance (or maxT when clear). */
  raycast(ox, oy, oz, dx, dy, dz, maxT) {
    let best = maxT;
    const steps = Math.ceil(maxT / CELL) + 1;
    const seen = new Set();
    for (let s = 0; s <= steps; s++) {
      const t = Math.min(s * CELL, maxT);
      for (const b of this.query(ox + dx * t, oz + dz * t, CELL)) {
        if (seen.has(b)) continue;
        seen.add(b);
        const h = rayBox(ox, oy, oz, dx, dy, dz, b, best);
        if (h >= 0 && h < best) best = h;
      }
      if (best < t) break;
    }
    return best;
  }

  /** Line of sight between two points at a given height. */
  clearLine(ax, az, bx, bz, y = 1.5) {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
    if (len < 0.01) return true;
    return this.raycast(ax, y, az, dx / len, 0, dz / len, len) >= len - 0.01;
  }
}
