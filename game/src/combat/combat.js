// Combat resolution shared by everyone who fights: hitscan bullets against people, cars
// and walls, melee swings, launcher rockets and explosion blasts. Shooters are tagged
// ('player', 'police', 'gang') so friendly fire and wanted-level crimes resolve correctly.
import * as THREE from 'three';
import { rayBox, raySphere } from '../core/mathx.js';

export class Combat {
  constructor(game) {
    this.game = game;
    this.rockets = [];
    this.rocketGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.7, 6).rotateX(Math.PI / 2);
    this.rocketMat = new THREE.MeshBasicMaterial({ color: '#ffe0a0' });
  }

  /** Everyone that can be shot: { kind, ref, x, y, z, r, team }. */
  targets() {
    const g = this.game, out = [];
    if (!g.player.vehicle && !g.player.dead) out.push({ kind: 'player', ref: g.player, x: g.player.pos.x, y: g.player.pos.y + 1.1, z: g.player.pos.z, r: 0.55, team: 'player' });
    for (const p of g.peds.list) if (p.alive) out.push({ kind: 'ped', ref: p, x: p.x, y: 1.1, z: p.z, r: 0.5, team: 'civ' });
    for (const c of g.police?.cops ?? []) if (c.alive) out.push({ kind: 'cop', ref: c, x: c.x, y: 1.1, z: c.z, r: 0.5, team: 'police' });
    for (const e of g.missions?.enemies ?? []) if (e.alive) out.push({ kind: 'gang', ref: e, x: e.x, y: 1.1, z: e.z, r: 0.5, team: 'gang' });
    return out;
  }

  /** Ray against a car's oriented box; returns distance or -1. */
  rayCar(v, o, d, maxT) {
    const c = Math.cos(-v.heading), s = Math.sin(-v.heading);
    const lx = o.x - v.pos.x, lz = o.z - v.pos.z;
    const ox = lx * c + lz * s, oz = -lx * s + lz * c;
    const dx = d.x * c + d.z * s, dz = -d.x * s + d.z * c;
    const hw = v.spec.wid / 2, hl = v.spec.len / 2;
    return rayBox(ox, o.y, oz, dx, d.y, dz, { minX: -hw, maxX: hw, minY: 0, maxY: v.spec.ride + v.spec.bodyH + v.spec.cabin[0], minZ: -hl, maxZ: hl }, maxT);
  }

  /** Fire one hitscan bullet. `from` tags the shooter; muzzle is where the tracer starts. */
  shoot(from, origin, dir, dmg, reach, muzzle = origin, ignore = null) {
    const g = this.game;
    let best = g.colliders.raycast(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, reach);
    if (dir.y < -0.001) best = Math.min(best, -origin.y / dir.y); // ground
    let hit = null;
    for (const t of this.targets()) {
      if (t.team === from || t.ref === ignore) continue;
      const d = raySphere(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, t.x, t.y, t.z, t.r + (t.kind === 'player' ? 0 : 0.1), best);
      if (d >= 0 && d < best) { best = d; hit = t; }
      // head
      const dh = raySphere(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, t.x, t.y + 0.75, t.z, 0.2, best);
      if (dh >= 0 && dh < best) { best = dh; hit = { ...t, head: true }; }
    }
    for (const v of g.vehicles.list) {
      if (v.dead && v.deadT < 20) continue;
      if (ignore === v) continue;
      if (from === 'player' && v === g.player.vehicle) continue;
      const d = this.rayCar(v, origin, dir, best);
      if (d >= 0 && d < best) { best = d; hit = { kind: 'car', ref: v }; }
    }
    const end = origin.clone().addScaledVector(dir, best);
    g.fx.tracer(muzzle.x, muzzle.y, muzzle.z, end.x, end.y, end.z, from === 'police' ? '#9fd0ff' : '#ffe08a');
    if (!hit) {
      if (best < reach) g.fx.sparks(end.x, end.y, end.z, 4);
      return null;
    }
    this.applyHit(hit, from, hit.head ? dmg * 2 : dmg, end, dir);
    return hit;
  }

  applyHit(hit, from, dmg, at, dir) {
    const g = this.game;
    if (hit.kind === 'player') g.player.damage(dmg, g);
    else if (hit.kind === 'ped') g.peds.hit(hit.ref, dmg, from);
    else if (hit.kind === 'cop') g.police.hitCop(hit.ref, dmg, from, dir);
    else if (hit.kind === 'gang') g.missions.hitEnemy(hit.ref, dmg, from);
    else if (hit.kind === 'car') {
      const v = hit.ref;
      v.damage(dmg * 0.35);
      if (from === 'player') v.lastAttacker = 'player';
      g.fx.sparks(at.x, at.y, at.z, 6);
      if (from === 'player' && v.kind === 'police') g.wanted?.crime('shootcop', v.pos);
      if (v.driver === 'ai' && v.ai?.type === 'traffic') v.ai.panic = 8;
      g.missions?.onCarDamaged(v, from);
    }
  }

  melee(from, pos, heading, reach, dmg) {
    const fx = Math.sin(heading), fz = Math.cos(heading);
    let best = null, bd = reach + 0.6;
    for (const t of this.targets()) {
      if (t.team === from) continue;
      const dx = t.x - pos.x, dz = t.z - pos.z, d = Math.hypot(dx, dz);
      if (d > bd) continue;
      if ((dx * fx + dz * fz) / Math.max(d, 0.01) < 0.4) continue;
      bd = d; best = t;
    }
    if (best) {
      this.applyHit(best, from, dmg, new THREE.Vector3(best.x, 1.3, best.z), new THREE.Vector3(fx, 0, fz));
      this.game.audio?.punch();
    }
  }

  launchRocket(from, start, dir) {
    const m = new THREE.Mesh(this.rocketGeo, this.rocketMat);
    m.position.copy(start);
    m.lookAt(start.clone().add(dir));
    this.game.scene.add(m);
    this.rockets.push({ from, mesh: m, pos: start.clone(), dir: dir.clone(), t: 0 });
  }

  /** Explosion damage with falloff on everyone and every car in the radius. */
  blast(x, z, radius, dmg, from) {
    const g = this.game;
    for (const t of this.targets()) {
      const d = Math.hypot(t.x - x, t.z - z);
      if (d > radius) continue;
      const k = 1 - d / radius;
      const dir = new THREE.Vector3(t.x - x, 0.5, t.z - z).normalize();
      if (t.kind === 'ped') g.peds.hit(t.ref, dmg * k, from, { x: dir.x * 9 * k, y: 6 * k, z: dir.z * 9 * k });
      else this.applyHit(t, from, dmg * k, new THREE.Vector3(t.x, 1, t.z), dir);
    }
    if (g.player.vehicle && Math.hypot(g.player.vehicle.pos.x - x, g.player.vehicle.pos.z - z) < radius * 0.6 && from !== 'player') g.player.damage(dmg * 0.25, g);
    for (const v of g.vehicles.list) {
      const d = Math.hypot(v.pos.x - x, v.pos.z - z);
      if (d > radius || v.dead) continue;
      const k = 1 - d / radius;
      v.damage(dmg * 1.2 * k);
      v.vx += (v.pos.x - x) / Math.max(d, 0.5) * 8 * k;
      v.vz += (v.pos.z - z) / Math.max(d, 0.5) * 8 * k;
      if (from === 'player') v.lastAttacker = 'player';
    }
    const pd = Math.hypot(g.player.pos.x - x, g.player.pos.z - z);
    g.cam.shake = Math.max(g.cam.shake, Math.max(0, 0.9 - pd / 60));
    g.peds.scare(x, z, 60);
  }

  update(dt) {
    const g = this.game;
    for (const r of [...this.rockets]) {
      r.t += dt;
      const step = 55 * dt;
      const o = r.pos;
      let t = g.colliders.raycast(o.x, o.y, o.z, r.dir.x, r.dir.y, r.dir.z, step);
      if (r.dir.y < 0) t = Math.min(t, -o.y / r.dir.y);
      for (const v of g.vehicles.list) {
        if (r.from === 'player' && v === g.player.vehicle) continue;
        const d = this.rayCar(v, o, r.dir, t);
        if (d >= 0 && d < t) t = d;
      }
      for (const tg of this.targets()) {
        if (tg.team === r.from) continue;
        const d = raySphere(o.x, o.y, o.z, r.dir.x, r.dir.y, r.dir.z, tg.x, tg.y, tg.z, 0.7, t);
        if (d >= 0 && d < t) t = d;
      }
      o.addScaledVector(r.dir, Math.min(step, t));
      r.mesh.position.copy(o);
      g.fx.smoke(o.x, o.y, o.z, 0.1, 0.4);
      g.fx.part(g.fx.glow, o.x, o.y, o.z, { life: 0.1, s0: 0.8, s1: 0.2, c0: new THREE.Color('#ffd080') });
      if (t < step || r.t > 4) {
        g.scene.remove(r.mesh);
        this.rockets = this.rockets.filter((q) => q !== r);
        g.fx.explosion(o.x, Math.max(0, o.y - 0.5), o.z, 1.1);
        g.audio?.explosion(o);
        this.blast(o.x, o.z, 10, 120, r.from);
      }
    }
  }
}
