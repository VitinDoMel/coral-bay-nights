// Geometry batching: thousands of boxes and quads merged into a few draw calls.
import * as THREE from 'three';

// Each face: normal, then the 4 corners as (sx,sy,sz) signs, and which axes span u/v.
const FACES = [
  { n: [1, 0, 0], c: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]], u: 2, v: 1 },
  { n: [-1, 0, 0], c: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]], u: 2, v: 1 },
  { n: [0, 1, 0], c: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]], u: 0, v: 2 },
  { n: [0, -1, 0], c: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]], u: 0, v: 2 },
  { n: [0, 0, 1], c: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], u: 0, v: 1 },
  { n: [0, 0, -1], c: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]], u: 0, v: 1 },
];

export class MeshBatch {
  constructor() {
    this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = [];
  }

  /**
   * Axis-aligned (optionally Y-rotated) box. `tile` = [tileW, tileH] maps facade UVs in
   * metres so window textures repeat at a constant size; `color` tints via vertex colours.
   */
  box(cx, cy, cz, sx, sy, sz, { tile = null, color = [1, 1, 1], rotY = 0, skipBottom = true, topColor = null } = {}) {
    const hs = [sx / 2, sy / 2, sz / 2];
    const cs = Math.cos(rotY), sn = Math.sin(rotY);
    FACES.forEach((f, fi) => {
      if (skipBottom && fi === 3) return;
      const base = this.pos.length / 3;
      const nx = f.n[0] * cs + f.n[2] * sn, nz = -f.n[0] * sn + f.n[2] * cs;
      const col = fi === 2 && topColor ? topColor : color;
      for (const c of f.c) {
        const lx = c[0] * hs[0], ly = c[1] * hs[1], lz = c[2] * hs[2];
        this.pos.push(cx + lx * cs + lz * sn, cy + ly, cz - lx * sn + lz * cs);
        this.nor.push(nx, f.n[1], nz);
        this.col.push(col[0], col[1], col[2]);
        const size = [sx, sy, sz];
        const uu = (c[f.u] * 0.5 + 0.5) * size[f.u], vv = (c[f.v] * 0.5 + 0.5) * size[f.v];
        if (tile) this.uv.push(uu / tile[0], vv / tile[1]);
        else this.uv.push(c[f.u] * 0.5 + 0.5, c[f.v] * 0.5 + 0.5);
      }
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    });
    return this;
  }

  /** Flat horizontal quad (road paint, crosswalk stripes, shadows), rotated around Y. */
  quad(cx, y, cz, w, d, rotY = 0, color = [1, 1, 1]) {
    const base = this.pos.length / 3;
    const cs = Math.cos(rotY), sn = Math.sin(rotY);
    const pts = [[-w / 2, d / 2], [w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2]];
    for (const [lx, lz] of pts) {
      this.pos.push(cx + lx * cs + lz * sn, y, cz - lx * sn + lz * cs);
      this.nor.push(0, 1, 0);
      this.col.push(color[0], color[1], color[2]);
      this.uv.push(lx / w + 0.5, lz / d + 0.5);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    return this;
  }

  get empty() { return this.idx.length === 0; }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

export function hexToRgb(hex) {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

/** Merge several BufferGeometries that each have position/normal/color (no index needed). */
export function mergeColored(parts) {
  const pos = [], nor = [], col = [];
  for (const { geo, color, matrix } of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    const c = new THREE.Color(color);
    for (let i = 0; i < p.length; i += 3) {
      pos.push(p[i], p[i + 1], p[i + 2]);
      nor.push(n[i], n[i + 1], n[i + 2]);
      col.push(c.r, c.g, c.b);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}
