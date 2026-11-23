// Vehicle registry: parked cars around the city, car-to-car crashes, explosions, and the
// player's enter / steal / exit (F) with the driver pulled out of the seat.
import { Vehicle } from './vehicle.js';
import { CAR_COLORS } from './car-models.js';
import { BLOCKS, ROADS_X, ROADS_Z } from '../world/layout.js';
import { rand, pick, irange, range } from '../core/rng.js';

export class Vehicles {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  spawn(model, color, kind, x, z, heading) {
    const v = new Vehicle(this.game.scene, model, color, kind);
    v.place(x, z, heading);
    v.explode = () => this.explode(v);
    v.onImpact = (impact) => {
      if (v.driver === 'player') { this.game.cam.shake = Math.min(0.6, impact * 0.03); this.game.audio?.crash(impact); }
    };
    this.list.push(v);
    return v;
  }

  remove(v) {
    this.game.scene.remove(v.root);
    this.list = this.list.filter((o) => o !== v);
  }

  /** Parked cars along the kerbs, nose-to-tail. */
  spawnParked(n) {
    for (let i = 0; i < n; i++) {
      const b = pick(BLOCKS.filter((bb) => bb.district !== 'park'));
      const side = irange(0, 3);
      const t = range(0.2, 0.8);
      let x, z, h;
      if (side === 0) { x = b.minX + (b.maxX - b.minX) * t; z = b.minZ - 1.4; h = Math.PI / 2; }
      else if (side === 1) { x = b.minX + (b.maxX - b.minX) * t; z = b.maxZ + 1.4; h = -Math.PI / 2; }
      else if (side === 2) { x = b.minX - 1.4; z = b.minZ + (b.maxZ - b.minZ) * t; h = Math.PI; }
      else { x = b.maxX + 1.4; z = b.minZ + (b.maxZ - b.minZ) * t; h = 0; }
      if (this.list.some((o) => Math.hypot(o.pos.x - x, o.pos.z - z) < 6)) continue;
      this.spawn(irange(0, 4), pick(CAR_COLORS), 'civ', x, z, h);
    }
  }

  nearestEnterable(x, z, maxD = 3.6) {
    let best = null, bd = maxD;
    for (const v of this.list) {
      if (v.dead) continue;
      const d = Math.hypot(v.pos.x - x, v.pos.z - z) - v.spec.wid / 2;
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  /** Player gets in; an AI driver is dragged out and flees. Returns true on success. */
  enter(v) {
    const g = this.game;
    if (v.driver === 'ai') {
      g.peds?.ejectDriver(v);
      g.wanted?.crime('carjack', v.pos);
      g.hud?.notify(`Carjacked a ${v.spec.name}`);
    } else if (v.kind === 'police') {
      g.wanted?.crime('copcar', v.pos);
    }
    if (v.ai) { v.ai = null; g.traffic?.release(v); g.police?.release(v); }
    v.driver = 'player';
    g.player.vehicle = v;
    g.cam.yaw = v.heading;
    g.audio?.door();
    g.missions?.onEnterVehicle(v);
    return true;
  }

  exit() {
    const g = this.game, p = g.player, v = p.vehicle;
    if (!v) return;
    if (Math.abs(v.speed) > 9) return; // too fast to bail out safely
    v.driver = null;
    p.vehicle = null;
    const rx = Math.cos(v.heading), rz = -Math.sin(v.heading);
    p.place(v.pos.x - rx * (v.spec.wid / 2 + 0.9), v.pos.z - rz * (v.spec.wid / 2 + 0.9), v.heading);
    g.colliders.resolveCircle(p.pos, 0.4);
    g.cam.yaw = v.heading;
    g.audio?.door();
  }

  explode(v) {
    if (v.dead) return;
    v.dead = true;
    v.health = 0;
    const g = this.game;
    g.fx.explosion(v.pos.x, 0.5, v.pos.z, 1.2);
    g.audio?.explosion(v.pos);
    g.combat?.blast(v.pos.x, v.pos.z, 9, 70, v.lastAttacker ?? null);
    if (v.driver === 'player') { g.player.damage(80, g); this.exit(); }
    if (v.driver === 'ai') { g.peds?.ejectDriver(v, true); }
    v.driver = null;
    v.vx *= 0.2; v.vz *= 0.2;
    v.deadT = 25;
  }

  update(dt) {
    const g = this.game;
    const list = this.list;
    // car vs car
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let k = i + 1; k < list.length; k++) {
        const b = list[k];
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const rr = (a.spec.wid + b.spec.wid) * 0.5 + 0.6;
        const d2 = dx * dx + dz * dz;
        if (d2 > rr * rr * 2.2) continue;
        // approximate each car by 2 circles along its axis
        for (const oa of [-1, 1]) for (const ob of [-1, 1]) {
          const ax = a.pos.x + a.forwardX * oa * a.spec.len * 0.27, az = a.pos.z + a.forwardZ * oa * a.spec.len * 0.27;
          const bx = b.pos.x + b.forwardX * ob * b.spec.len * 0.27, bz = b.pos.z + b.forwardZ * ob * b.spec.len * 0.27;
          const r = (a.spec.wid + b.spec.wid) * 0.5;
          const ex = bx - ax, ez = bz - az, d = Math.hypot(ex, ez);
          if (d >= r || d < 1e-4) continue;
          const nx = ex / d, nz = ez / d, pen = r - d;
          const ma = a.spec.mass * (a.kind === 'police' ? 1.3 : 1), mb = b.spec.mass * (b.kind === 'police' ? 1.3 : 1);
          const wa = mb / (ma + mb), wb = ma / (ma + mb);
          a.pos.x -= nx * pen * wa; a.pos.z -= nz * pen * wa;
          b.pos.x += nx * pen * wb; b.pos.z += nz * pen * wb;
          const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
          if (rel < 0) {
            const j = -rel * 1.25;
            a.vx -= nx * j * wa; a.vz -= nz * j * wa;
            b.vx += nx * j * wb; b.vz += nz * j * wb;
            if (-rel > 4) {
              const dmg = -rel * 1.1;
              a.damage(dmg * wa * 1.4); b.damage(dmg * wb * 1.4);
              if (a.driver === 'player') b.lastAttacker = 'player';
              if (b.driver === 'player') a.lastAttacker = 'player';
              g.fx.sparks((ax + bx) / 2, 0.7, (az + bz) / 2, Math.min(24, -rel * 2));
              if (a.driver === 'player' || b.driver === 'player') {
                g.cam.shake = Math.min(0.5, -rel * 0.025);
                g.audio?.crash(-rel);
                const other = a.driver === 'player' ? b : a;
                g.missions?.onRam(other, -rel);
                if (other.kind === 'police') g.wanted?.crime('ramcop', other.pos);
              }
            }
          }
        }
      }
    }
    for (const v of [...list]) {
      if (v.dead) {
        v.deadT -= dt;
        if (rand() < dt * 6) g.fx.smoke(v.pos.x, 1.5, v.pos.z, 0.9, 1.2);
        if (v.deadT > 15 && rand() < dt * 12) g.fx.fire(v.pos.x, 0.9, v.pos.z, 1.1);
        v.drive(dt, { throttle: 0, steer: 0, handbrake: true }, g.colliders, null, null);
        if (v.deadT <= 0 && v.driver !== 'player' && !v.keep) this.remove(v);
      }
      v.syncModel(dt, g.world.dusk);
    }
  }
}
