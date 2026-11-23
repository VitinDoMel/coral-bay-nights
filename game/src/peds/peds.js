// Pedestrians: locals strolling the sidewalks around each block and along the beach
// promenade, who panic and flee from gunfire and speeding cars, can be knocked down, and
// the drivers the player drags out of stolen cars.
import { buildHuman, animateHuman, SKIN, HAIR, SHIRTS, PANTS } from '../actors/humanoid.js';
import { BLOCKS, PROMENADE } from '../world/layout.js';
import { rand, pick, range, chance } from '../core/rng.js';
import { wrapAngle, dampAngle } from '../core/mathx.js';

function randomLook() {
  const long = chance(0.4);
  return {
    skin: pick(SKIN), hair: pick(HAIR), hairStyle: long ? pick(['long', 'bun']) : pick(['short', 'short', 'bald']),
    shirt: pick(SHIRTS), pants: pick(PANTS), shoes: pick(['#f4f4f4', '#222', '#a0522d']),
    cap: chance(0.2) ? pick(['#ff6f91', '#2ec4b6', '#1d3557', '#ffbe0b']) : null, shades: chance(0.35),
  };
}

export class Pedestrian {
  constructor(scene, look = randomLook()) {
    this.h = buildHuman(look);
    scene.add(this.h.root);
    this.x = 0; this.z = 0; this.y = 0;
    this.heading = 0;
    this.speed = 1.3;
    this.phase = rand() * 6;
    this.state = 'walk'; // walk | flee | down | idle
    this.health = 40;
    this.fleeT = 0;
    this.downT = 0;
    this.vx = 0; this.vz = 0; this.vy = 0;
    this.path = null;
    this.s = 0;
    this.dir = 1;
  }

  /** Perimeter walk around block b (inset onto the sidewalk). */
  setBlockPath(b, s = rand()) {
    const i = 1.6;
    this.path = { kind: 'rect', x0: b.minX + i, x1: b.maxX - i, z0: b.minZ + i, z1: b.maxZ - i };
    const p = this.path;
    this.perim = 2 * (p.x1 - p.x0) + 2 * (p.z1 - p.z0);
    this.s = s * this.perim;
    this.dir = chance(0.5) ? 1 : -1;
  }

  setLinePath(x, z0, z1) {
    this.path = { kind: 'line', x, z0, z1 };
    this.perim = (z1 - z0) * 2;
    this.s = rand() * this.perim;
    this.dir = 1;
  }

  pathPoint(s) {
    const p = this.path;
    s = ((s % this.perim) + this.perim) % this.perim;
    if (p.kind === 'line') {
      const L = p.z1 - p.z0;
      return s < L ? { x: p.x, z: p.z0 + s } : { x: p.x + 1.2, z: p.z1 - (s - L) };
    }
    const w = p.x1 - p.x0, d = p.z1 - p.z0;
    if (s < w) return { x: p.x0 + s, z: p.z0 };
    if (s < w + d) return { x: p.x1, z: p.z0 + (s - w) };
    if (s < 2 * w + d) return { x: p.x1 - (s - w - d), z: p.z1 };
    return { x: p.x0, z: p.z1 - (s - 2 * w - d) };
  }

  get alive() { return this.state !== 'down'; }
}

export class Peds {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  populate(n) {
    const blocks = BLOCKS.filter((b) => b.district !== 'port');
    for (let k = 0; k < n; k++) {
      const p = new Pedestrian(this.game.scene);
      if (k % 5 === 0) p.setLinePath(PROMENADE[0] + range(3, 9), -230, 230);
      else p.setBlockPath(pick(blocks));
      p.speed = range(1.1, 1.6);
      const pt = p.pathPoint(p.s);
      p.x = pt.x; p.z = pt.z;
      this.list.push(p);
    }
  }

  /** Someone at (x,z) does something scary: nearby peds run away from it. */
  scare(x, z, r = 30) {
    for (const p of this.list) {
      if (!p.alive) continue;
      if (Math.hypot(p.x - x, p.z - z) < r) { p.state = 'flee'; p.fleeT = range(6, 10); p.threat = { x, z }; }
    }
    this.game.traffic?.panic(x, z, r);
  }

  /** Hurt a ped (bullet, punch, car). Returns true if it went down. */
  hit(p, dmg, from, fling = null) {
    if (!p.alive) return false;
    p.health -= dmg;
    this.game.fx.blood(p.x, 1.2, p.z);
    if (p.health <= 0 || fling) {
      p.state = 'down';
      p.downT = 20;
      if (fling) { p.vx = fling.x; p.vz = fling.z; p.vy = fling.y; }
      if (from === 'player') { this.game.wanted?.crime('assault', { x: p.x, z: p.z }); this.game.progress?.addRespect(-2); }
      return true;
    }
    p.state = 'flee'; p.fleeT = 8; p.threat = from === 'player' ? { x: this.game.player.pos.x, z: this.game.player.pos.z } : { x: p.x + 1, z: p.z };
    return false;
  }

  ejectDriver(v, dead = false) {
    const p = new Pedestrian(this.game.scene);
    const rx = Math.cos(v.heading), rz = -Math.sin(v.heading);
    p.x = v.pos.x - rx * (v.spec.wid / 2 + 0.8);
    p.z = v.pos.z - rz * (v.spec.wid / 2 + 0.8);
    p.setBlockPath(pick(BLOCKS));
    if (dead) { p.state = 'down'; p.downT = 20; }
    else { p.state = 'flee'; p.fleeT = 12; p.threat = { x: v.pos.x, z: v.pos.z }; }
    p.temp = true;
    this.list.push(p);
  }

  update(dt) {
    const g = this.game;
    const focus = g.player.vehicle ? g.player.vehicle.pos : g.player.pos;
    const cols = g.colliders;
    for (const p of this.list) {
      // cars hitting peds
      if (p.alive) {
        for (const v of g.vehicles.list) {
          const sp = Math.hypot(v.vx, v.vz);
          if (sp < 4) continue;
          const dx = p.x - v.pos.x, dz = p.z - v.pos.z;
          const along = dx * v.forwardX + dz * v.forwardZ;
          const side = Math.abs(dx * v.forwardZ - dz * v.forwardX);
          if (Math.abs(along) < v.spec.len / 2 + 0.3 && side < v.spec.wid / 2 + 0.3) {
            this.hit(p, 100, v.driver === 'player' ? 'player' : 'car', { x: v.vx * 0.7, y: 4 + sp * 0.15, z: v.vz * 0.7 });
            g.audio?.thud();
            if (v.driver === 'player') g.progress?.onRunOver?.();
          } else if (along > 0 && along < 14 && side < 3 && p.state === 'walk' && sp > 8) {
            p.state = 'flee'; p.fleeT = 3; p.threat = { x: v.pos.x, z: v.pos.z };
          }
        }
      }
      if (p.state === 'down') {
        p.downT -= dt;
        p.vy -= 14 * dt;
        p.x += p.vx * dt; p.z += p.vz * dt; p.y = Math.max(0, p.y + p.vy * dt);
        if (p.y === 0) { p.vx *= Math.exp(-6 * dt); p.vz *= Math.exp(-6 * dt); p.vy = 0; }
        if (p.downT <= 0 && Math.hypot(p.x - focus.x, p.z - focus.z) > 40) this.respawn(p, focus);
      } else if (p.state === 'flee') {
        p.fleeT -= dt;
        const ax = p.x - p.threat.x, az = p.z - p.threat.z;
        const want = Math.atan2(ax, az) + Math.sin(g.time * 2 + p.phase) * 0.4;
        p.heading = dampAngle(p.heading, want, 6, dt);
        const sp = 5.2;
        const px = p.x, pz = p.z;
        p.x += Math.sin(p.heading) * sp * dt; p.z += Math.cos(p.heading) * sp * dt;
        const pos = { x: p.x, z: p.z };
        const hit = cols.resolveCircle(pos, 0.35);
        cols.keepOnLand(pos, px, pz);
        if (hit) p.heading = wrapAngle(p.heading + 0.8);
        p.x = pos.x; p.z = pos.z;
        p.phase += sp * dt * 2.2;
        if (p.fleeT <= 0) { // drift back onto a path
          p.state = 'walk';
          let best = 0, bd = Infinity;
          for (let k = 0; k < 40; k++) { const q = p.pathPoint(k / 40 * p.perim); const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2; if (d < bd) { bd = d; best = k / 40 * p.perim; } }
          if (bd > 400) { const blocks = BLOCKS.filter((b) => p.x > b.minX - 10 && p.x < b.maxX + 10 && p.z > b.minZ - 10 && p.z < b.maxZ + 10); if (blocks.length) p.setBlockPath(blocks[0], 0); }
          else p.s = best;
          p.rejoin = 1.5;
        }
      } else {
        const tgt = p.pathPoint(p.s + p.dir * 1.5);
        if (p.rejoin > 0) { // walk to the path point instead of snapping
          p.rejoin -= dt;
          const dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz);
          if (d > 0.3) { p.x += dx / d * p.speed * 1.5 * dt; p.z += dz / d * p.speed * 1.5 * dt; p.heading = dampAngle(p.heading, Math.atan2(dx, dz), 8, dt); }
        } else {
          p.s += p.dir * p.speed * dt;
          const pt = p.pathPoint(p.s);
          const dx = pt.x - p.x, dz = pt.z - p.z;
          if (dx * dx + dz * dz > 1e-5) p.heading = dampAngle(p.heading, Math.atan2(dx, dz), 8, dt);
          p.x = pt.x; p.z = pt.z;
        }
        p.phase += p.speed * dt * 2.2;
        if (Math.hypot(p.x - focus.x, p.z - focus.z) > 170) this.respawn(p, focus);
      }
      const h = p.h;
      h.root.position.set(p.x, p.y, p.z);
      h.root.rotation.y = p.heading;
      const far = Math.hypot(p.x - focus.x, p.z - focus.z) > 120;
      h.root.visible = !far;
      if (!far) animateHuman(h, p.phase, p.state === 'flee' ? 0.9 : p.speed / 7.5, p.state === 'down' ? 'down' : p.state === 'flee' && p.fleeT > 7 ? 'cower' : 'move');
    }
    this.list = this.list.filter((p) => !(p.temp && p.state === 'walk' && Math.hypot(p.x - focus.x, p.z - focus.z) > 100) || (this.game.scene.remove(p.h.root), false));
  }

  respawn(p, focus) {
    const near = BLOCKS.filter((b) => {
      const d = Math.hypot((b.minX + b.maxX) / 2 - focus.x, (b.minZ + b.maxZ) / 2 - focus.z);
      return d > 50 && d < 150 && b.district !== 'port';
    });
    if (!near.length) return;
    p.setBlockPath(pick(near));
    const pt = p.pathPoint(p.s);
    p.x = pt.x; p.z = pt.z; p.y = 0; p.vx = p.vz = p.vy = 0;
    p.state = 'walk'; p.health = 40;
  }
}
