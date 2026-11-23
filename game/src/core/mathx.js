// Small math helpers shared by every system.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const dist2 = (ax, az, bx, bz) => (ax - bx) ** 2 + (az - bz) ** 2;
export const dist = (ax, az, bx, bz) => Math.sqrt(dist2(ax, az, bx, bz));

/** Wrap an angle to (-PI, PI]. */
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function dampAngle(a, b, rate, dt) {
  return a + wrapAngle(b - a) * (1 - Math.exp(-rate * dt));
}

/** Heading (rotation.y) that faces from (0,0) toward (dx,dz); model forward is +Z. */
export const headingTo = (dx, dz) => Math.atan2(dx, dz);

/** Slab test of a ray against an axis-aligned box. Returns the hit distance or -1. */
export function rayBox(ox, oy, oz, dx, dy, dz, b, maxT) {
  let tmin = 0, tmax = maxT;
  const o = [ox, oy, oz], d = [dx, dy, dz];
  const lo = [b.minX, b.minY ?? 0, b.minZ], hi = [b.maxX, b.maxY ?? 999, b.maxZ];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < lo[i] || o[i] > hi[i]) return -1;
    } else {
      let t1 = (lo[i] - o[i]) / d[i], t2 = (hi[i] - o[i]) / d[i];
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

/** Distance along a ray to a sphere, or -1. */
export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r, maxT) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return -1;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  if (d2 > r * r) return -1;
  const t = tca - Math.sqrt(r * r - d2);
  return t <= maxT ? Math.max(0, t) : -1;
}

export function formatMoney(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}
