// Civilian traffic: cars drive right-hand lanes along the street grid, pick a turn at each
// junction, stop at red signals and behind other cars, and are recycled around the player.
import { ROADS_X, ROADS_Z, GRID } from '../world/layout.js';
import { CAR_COLORS } from '../vehicles/car-models.js';
import { rand, pick, irange } from '../core/rng.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const SIGNAL_CYCLE = 9;

/** Lane centre offset for travel direction d (right-hand traffic). */
function laneOffset(d, i, j) {
  const off = (d[0] !== 0 ? ROADS_Z[j].avenue : ROADS_X[i].avenue) ? 3.2 : 2.6;
  // moving +z: right hand is -x ; moving -z: +x ; moving +x: +z ; moving -x: -z
  if (d[1] === 1) return [-off, 0];
  if (d[1] === -1) return [off, 0];
  if (d[0] === 1) return [0, off];
  return [0, -off];
}

const nodePos = (i, j) => ({ x: ROADS_X[i].x, z: ROADS_Z[j].z });

export class Traffic {
  constructor(game) {
    this.game = game;
    this.cars = [];
    this.time = 0;
  }

  /** Signal state: true when cars travelling along this direction may go. */
  green(d) {
    const phase = Math.floor(this.time / SIGNAL_CYCLE) % 2;
    const t = this.time % SIGNAL_CYCLE;
    if (t > SIGNAL_CYCLE - 1.5) return false; // all-red clearance
    return d[1] !== 0 ? phase === 0 : phase === 1;
  }

  spawnCar(i, j, d, model = irange(0, 4), color = pick(CAR_COLORS), kind = rand() < 0.12 ? 'cab' : 'civ') {
    const v = this.game.vehicles.spawn(model, color, kind, 0, 0, 0);
    v.driver = 'ai';
    this.route(v, i, j, d, true);
    this.cars.push(v);
    return v;
  }

  /** Put a car on the lane leaving node (i,j) in direction d, heading for the next node. */
  route(v, i, j, d, teleport = false) {
    const ni = i + d[0], nj = j + d[1];
    const o = laneOffset(d, i, j);
    const a = nodePos(i, j), b = nodePos(ni, nj);
    const crossHalf = (d[0] !== 0 ? ROADS_X[ni].w : ROADS_Z[nj].w) / 2;
    v.ai = {
      type: 'traffic', from: [i, j], to: [ni, nj], d,
      wps: [{ x: b.x + o[0] - d[0] * (crossHalf + 4.5), z: b.z + o[1] - d[1] * (crossHalf + 4.5), stop: true }],
      cruise: (d[0] !== 0 ? ROADS_Z[j].avenue : ROADS_X[i].avenue) ? 15 : 11.5,
      stuck: 0,
    };
    if (teleport) {
      const startHalf = (d[0] !== 0 ? ROADS_X[i].w : ROADS_Z[j].w) / 2;
      v.place(a.x + o[0] + d[0] * (startHalf + 3), a.z + o[1] + d[1] * (startHalf + 3), Math.atan2(d[0], d[1]));
      v.vx = d[0] * 8; v.vz = d[1] * 8;
    }
  }

  /** At the end of a segment choose a new direction (no U-turns, stay on the grid). */
  chooseTurn(v) {
    const [i, j] = v.ai.to, d = v.ai.d;
    const opts = DIRS.filter((n) => !(n[0] === -d[0] && n[1] === -d[1]))
      .filter((n) => i + n[0] >= 0 && i + n[0] <= GRID && j + n[1] >= 0 && j + n[1] <= GRID);
    // favour going straight
    const straight = opts.find((n) => n[0] === d[0] && n[1] === d[1]);
    const nd = straight && rand() < 0.55 ? straight : pick(opts);
    const o = laneOffset(nd, i, j);
    const c = nodePos(i, j);
    const crossHalf = (nd[0] !== 0 ? ROADS_X[i].w : ROADS_Z[j].w) / 2;
    const exitPt = { x: c.x + o[0] + nd[0] * (crossHalf + 2), z: c.z + o[1] + nd[1] * (crossHalf + 2) };
    const cruise = v.ai.cruise;
    this.route(v, i, j, nd);
    v.ai.cruise = cruise;
    v.ai.wps.unshift(exitPt);
  }

  release(v) {
    this.cars = this.cars.filter((c) => c !== v);
  }

  populate(n, fx = 0, fz = 0) {
    for (let k = 0; k < n; k++) {
      let i = irange(0, GRID - 1), j = irange(0, GRID - 1);
      for (let t = 0; t < 12 && Math.hypot(nodePos(i, j).x - fx, nodePos(i, j).z - fz) > 170; t++) { i = irange(0, GRID - 1); j = irange(0, GRID - 1); }
      const d = pick(DIRS.filter((dd) => i + dd[0] >= 0 && i + dd[0] <= GRID && j + dd[1] >= 0 && j + dd[1] <= GRID));
      this.spawnCar(i, j, d);
    }
  }

  /** Move a car that wandered too far to a junction near the player. */
  recycle(v, px, pz) {
    for (let tries = 0; tries < 10; tries++) {
      const i = irange(0, GRID - 1), j = irange(0, GRID - 1);
      const n = nodePos(i, j);
      const d = Math.hypot(n.x - px, n.z - pz);
      if (d < 70 || d > 180) continue;
      const dir = pick(DIRS.filter((dd) => i + dd[0] >= 0 && i + dd[0] <= GRID && j + dd[1] >= 0 && j + dd[1] <= GRID));
      v.health = 100;
      this.route(v, i, j, dir, true);
      return;
    }
  }

  update(dt) {
    this.time += dt;
    const g = this.game;
    const focus = g.player.vehicle ? g.player.vehicle.pos : g.player.pos;
    for (const v of [...this.cars]) {
      if (v.dead || v.driver !== 'ai' || !v.ai) { this.release(v); continue; }
      const ai = v.ai;
      if (Math.hypot(v.pos.x - focus.x, v.pos.z - focus.z) > 230) { this.recycle(v, focus.x, focus.z); continue; }
      const wp = ai.wps[0];
      const dx = wp.x - v.pos.x, dz = wp.z - v.pos.z;
      const dist = Math.hypot(dx, dz);
      let target = ai.panic > 0 ? ai.cruise * 1.5 : ai.cruise;
      if (ai.panic > 0) ai.panic -= dt;
      if (wp.stop && !(ai.panic > 0)) {
        if (!this.green(ai.d) && dist < 22) target = Math.min(target, Math.max(0, (dist - 1) * 0.9));
        if (dist < 2) {
          if (this.green(ai.d) || ai.panic > 0) { ai.wps.shift(); this.chooseTurn(v); continue; }
        }
      } else if (dist < 3) {
        ai.wps.shift();
        if (!ai.wps.length) this.chooseTurn(v);
        continue;
      }
      // keep distance from whatever is ahead (cars, the player, people crossing)
      const fx = v.forwardX, fz = v.forwardZ;
      const ahead = (ox, oz, gap) => {
        const rx = ox - v.pos.x, rz = oz - v.pos.z;
        const along = rx * fx + rz * fz;
        if (along <= 0 || along > 16) return;
        const side = Math.abs(rx * fz - rz * fx);
        if (side > 2.1) return;
        target = Math.min(target, Math.max(0, (along - gap) * 1.1));
      };
      for (const o of g.vehicles.list) if (o !== v) ahead(o.pos.x, o.pos.z, 6.5);
      if (!g.player.vehicle) ahead(g.player.pos.x, g.player.pos.z, 4);
      const c = v.steerToward(wp.x, wp.z, target);
      if (target < 0.5 && v.speed > 0.2) c.throttle = -1;
      if (target < 0.5 && v.speed <= 0.2) c.throttle = 0;
      v.drive(dt, c, g.colliders, g.fx, g.skids);
      // unstick
      if (Math.abs(v.speed) < 0.5 && target > 3) { ai.stuck += dt; if (ai.stuck > 5) { ai.stuck = 0; this.recycle(v, focus.x, focus.z); } }
      else ai.stuck = 0;
    }
  }

  panic(x, z, r = 40) {
    for (const v of this.cars) if (Math.hypot(v.pos.x - x, v.pos.z - z) < r) v.ai.panic = 8;
  }
}
