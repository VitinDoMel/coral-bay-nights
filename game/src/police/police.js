// CVPD response: cruisers dispatched by wanted level with tactical roles (RAMMING,
// FLANKING, BLOCKADE), officers who bail out and open fire from 2 stars, the SKYHAWK
// helicopter from 3 stars, line-of-sight checks for evasion, arrests (BUSTED) and the
// live dispatch board the HUD shows.
import * as THREE from 'three';
import { Helicopter } from './helicopter.js';
import { POLICE_MODEL } from '../vehicles/car-models.js';
import { buildHuman, animateHuman, setHeldWeapon } from '../actors/humanoid.js';
import { NODES, routeBetween } from '../world/layout.js';
import { pick, range, rand } from '../core/rng.js';
import { dampAngle } from '../core/mathx.js';

const CALLSIGNS = ['MARLIN 1-2', 'GULL 2-6', 'REEF 3-1', 'TARPON 4-4', 'PALM 5-3', 'HARBOR 6-1', 'SANDBAR 7-2', 'KESTREL 8-5'];
const UNITS_BY_STARS = [0, 1, 2, 3, 4, 6];
const COP_LOOK = { skin: '#c68a62', hair: '#1d1410', shirt: '#1f2b4d', pants: '#141a2a', shoes: '#111', cap: '#141a2a', badge: true };
const SWAT_LOOK = { ...COP_LOOK, shirt: '#2a2f3a', vest: '#3b4252', cap: '#20242c' };

export class Police {
  constructor(game) {
    this.game = game;
    this.units = [];
    this.cops = [];
    this.heli = null;
    this.spawnCool = 0;
    this.bustT = 0;
    this.nextSign = 0;
  }

  get focus() { const p = this.game.player; return p.vehicle ? p.vehicle.pos : p.pos; }

  /** Is (x,z) within sight of any CVPD officer or car? */
  witness(x, z) {
    const cols = this.game.colliders;
    for (const u of this.units) if (Math.hypot(u.v.pos.x - x, u.v.pos.z - z) < 60 && cols.clearLine(u.v.pos.x, u.v.pos.z, x, z)) return true;
    for (const c of this.cops) if (c.alive && Math.hypot(c.x - x, c.z - z) < 50 && cols.clearLine(c.x, c.z, x, z)) return true;
    return false;
  }

  spawnUnit(x, z, heading) {
    const g = this.game;
    const v = g.vehicles.spawn(POLICE_MODEL, '#111', 'police', x, z, heading);
    v.driver = 'ai';
    v.ai = { type: 'police', route: [], routeT: 0 };
    v.sirenOn = true;
    const unit = { v, callsign: CALLSIGNS[this.nextSign++ % CALLSIGNS.length], role: 'RAMMING', deployed: false, crew: 2 };
    this.units.push(unit);
    return unit;
  }

  /** Spawn a unit on a junction out of sight, 90-170 m from the player. */
  dispatch() {
    const f = this.focus;
    const cands = NODES.filter((n) => { const d = Math.hypot(n.x - f.x, n.z - f.z); return d > 90 && d < 170; });
    if (!cands.length) return;
    const n = pick(cands);
    this.spawnUnit(n.x + range(-2, 2), n.z + range(-2, 2), Math.atan2(f.x - n.x, f.z - n.z));
  }

  spawnCop(x, z, unit = null) {
    const swat = this.game.wanted.stars >= 4;
    const h = buildHuman(swat ? SWAT_LOOK : COP_LOOK);
    setHeldWeapon(h, swat ? 5 : 2);
    this.game.scene.add(h.root);
    const c = { h, x, z, heading: 0, health: swat ? 80 : 50, alive: true, cool: range(0.6, 1.4), phase: rand() * 6, unit, downT: 0, strafe: rand() < 0.5 ? 1 : -1, shooting: 0, weapon: swat ? 5 : 2, callsign: unit?.callsign ?? 'FOOT PATROL' };
    this.cops.push(c);
    return c;
  }

  release(v) {
    this.units = this.units.filter((u) => u.v !== v);
  }

  hitCop(c, dmg, from, dir) {
    if (!c.alive) return;
    c.health -= dmg;
    this.game.fx.blood(c.x, 1.2, c.z);
    if (from === 'player') this.game.wanted.crime('shootcop', { x: c.x, z: c.z });
    if (c.health <= 0) {
      c.alive = false;
      c.downT = 20;
      if (from === 'player') { this.game.wanted.crime('killcop', { x: c.x, z: c.z }); this.game.progress?.addRespect(4); }
    }
  }

  assignRoles() {
    const f = this.focus;
    const sorted = [...this.units].sort((a, b) => a.v.pos.distanceTo(f) - b.v.pos.distanceTo(f));
    const roles = ['RAMMING', 'FLANKING', 'BLOCKADE', 'RAMMING', 'FLANKING', 'BLOCKADE'];
    sorted.forEach((u, i) => { if (!u.deployed) u.role = roles[i % roles.length]; });
  }

  /** The dispatch board: up to 6 entries, nearest first. */
  board() {
    const f = this.focus, out = [];
    for (const u of this.units) out.push({ name: u.callsign, dist: Math.round(u.v.pos.distanceTo(f)), role: u.deployed ? 'ON FOOT' : u.role });
    if (this.heli && !this.heli.leaving) out.push({ name: this.heli.callsign, dist: Math.round(Math.hypot(this.heli.pos.x - f.x, this.heli.pos.z - f.z)), role: 'SPOTLIGHT' });
    for (const c of this.cops) if (c.alive && !c.unit) out.push({ name: c.callsign, dist: Math.round(Math.hypot(c.x - f.x, c.z - f.z)), role: 'ON FOOT' });
    return out.sort((a, b) => a.dist - b.dist).slice(0, 6);
  }

  driveUnit(u, dt) {
    const g = this.game, v = u.v, f = this.focus;
    const pv = g.player.vehicle;
    const pvx = pv ? pv.vx : 0, pvz = pv ? pv.vz : 0;
    const stars = g.wanted.stars;
    let tx = f.x + pvx * 0.6, tz = f.z + pvz * 0.6, speed = 34;
    const dist = Math.hypot(v.pos.x - f.x, v.pos.z - f.z);
    if (stars === 0) { // head away and despawn
      tx = v.pos.x + v.forwardX * 50; tz = v.pos.z + v.forwardZ * 50; speed = 12;
      v.sirenOn = false;
    } else if (u.role === 'FLANKING') {
      const sp = Math.hypot(pvx, pvz);
      const fx = sp > 1 ? pvx / sp : Math.sin(g.player.heading), fz = sp > 1 ? pvz / sp : Math.cos(g.player.heading);
      tx += -fz * 7 + fx * 6; tz += fx * 7 + fz * 6;
    } else if (u.role === 'BLOCKADE') {
      const sp = Math.hypot(pvx, pvz);
      if (sp > 6) { tx = f.x + pvx * 3.5; tz = f.z + pvz * 3.5; }
      if (dist < 25 && sp < 6) speed = 8;
    }
    if (dist < 12 && (!pv || Math.abs(pv.speed) < 4)) speed = Math.max(0, (dist - 6) * 2);
    // route along roads when the target is far or a building is in the way
    let wx = tx, wz = tz;
    const direct = Math.hypot(tx - v.pos.x, tz - v.pos.z) < 45 && g.colliders.clearLine(v.pos.x, v.pos.z, tx, tz, 1);
    if (!direct) {
      v.ai.routeT -= dt;
      if (v.ai.routeT <= 0 || !v.ai.route.length) { v.ai.route = routeBetween(v.pos.x, v.pos.z, tx, tz).slice(1); v.ai.routeT = 1.5; }
      while (v.ai.route.length > 1 && Math.hypot(v.ai.route[0].x - v.pos.x, v.ai.route[0].z - v.pos.z) < 9) v.ai.route.shift();
      if (v.ai.route.length) { wx = v.ai.route[0].x; wz = v.ai.route[0].z; }
    }
    const c = v.steerToward(wx, wz, speed);
    if (speed < 1 && v.speed > 0.5) c.throttle = -1;
    // reverse out when wedged against a wall
    v.ai.stuck = Math.abs(v.speed) < 1 && speed > 5 ? (v.ai.stuck ?? 0) + dt : 0;
    if (v.ai.stuck > 1.2) { v.ai.reverseT = 1.2; v.ai.stuck = 0; }
    if (v.ai.reverseT > 0) { v.ai.reverseT -= dt; c.throttle = -1; c.steer = -c.steer; }
    v.drive(dt, c, g.colliders, g.fx, g.skids);
  }

  updateCop(c, dt, stars) {
    const g = this.game, f = this.focus;
    if (!c.alive) {
      c.downT -= dt;
      animateHuman(c.h, 0, 0, 'down');
      c.h.root.position.set(c.x, 0, c.z);
      return;
    }
    const dx = f.x - c.x, dz = f.z - c.z, d = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    c.heading = dampAngle(c.heading, want, 8, dt);
    let mx = 0, mz = 0, sp = 0;
    const armed = stars >= 2;
    const keep = armed ? 11 : 1.6;
    const los = g.colliders.clearLine(c.x, c.z, f.x, f.z, 1.4);
    if (stars === 0) { // walk back to the car / away
      const u = c.unit;
      if (u && !u.v.dead) { const ex = u.v.pos.x - c.x, ez = u.v.pos.z - c.z; const ed = Math.hypot(ex, ez); if (ed > 2) { mx = ex / ed; mz = ez / ed; sp = 3; c.heading = Math.atan2(ex, ez); } else c.remove = true; }
      else c.remove = d > 60;
    } else if (d > keep + 3 || !los) {
      mx = dx / d; mz = dz / d; sp = d > 25 ? 5.5 : 4.2;
    } else if (armed) { // strafe while shooting
      mx = -dz / d * c.strafe; mz = dx / d * c.strafe; sp = 1.6;
      if (rand() < dt * 0.4) c.strafe *= -1;
    }
    const px = c.x, pz = c.z;
    c.x += mx * sp * dt; c.z += mz * sp * dt;
    const pos = { x: c.x, z: c.z };
    g.colliders.resolveCircle(pos, 0.4);
    g.colliders.keepOnLand(pos, px, pz);
    c.x = pos.x; c.z = pos.z;
    c.phase += sp * dt * 2.2;
    c.shooting = Math.max(0, c.shooting - dt);
    if (armed && stars > 0 && los && d < 45 && !g.player.dead) {
      c.cool -= dt;
      if (c.cool <= 0) {
        c.cool = c.weapon === 5 ? range(0.35, 0.6) : range(0.7, 1.2);
        c.shooting = 0.4;
        const muzzle = new THREE.Vector3(c.x + Math.sin(c.heading) * 0.75, 1.45, c.z + Math.cos(c.heading) * 0.75);
        const pv = g.player.vehicle;
        const ty = pv ? 1.0 : g.player.pos.y + 1.2;
        const spread = 0.03 + d * 0.0025 + (pv ? Math.abs(pv.speed) * 0.002 : g.player.speed * 0.006);
        const dir = new THREE.Vector3(f.x - muzzle.x + range(-1, 1) * spread * d, ty - muzzle.y + range(-1, 1) * spread * d, f.z - muzzle.z + range(-1, 1) * spread * d).normalize();
        const hit = g.combat.shoot('police', muzzle, dir, c.weapon === 5 ? 6 : 7, 60, muzzle);
        if (pv && hit?.ref === pv) g.player.damage(1.5, g);
        g.fx.muzzle(muzzle.x, muzzle.y, muzzle.z, Math.sin(c.heading), Math.cos(c.heading));
        g.audio?.gun(c.weapon, muzzle);
      }
    } else if (!armed && stars > 0 && d < 2.4) {
      c.heading = want;
    }
    c.h.root.position.set(c.x, 0, c.z);
    c.h.root.rotation.y = c.heading;
    animateHuman(c.h, c.phase, sp / 7.5, armed && stars > 0 && los && d < 45 ? 'aim' : 'move', 0);
  }

  update(dt) {
    const g = this.game, w = g.wanted, stars = w.stars, f = this.focus;
    // keep the right number of units on the street
    this.spawnCool -= dt;
    const want = UNITS_BY_STARS[stars];
    if (this.units.length < want && this.spawnCool <= 0) { this.dispatch(); this.spawnCool = 2.5; }
    this.assignRoles();
    for (const u of [...this.units]) {
      const v = u.v;
      if (v.dead || v.driver !== 'ai') { this.release(v); continue; }
      const d = Math.hypot(v.pos.x - f.x, v.pos.z - f.z);
      if (d > 240 || (stars === 0 && d > 110)) { this.release(v); g.vehicles.remove(v); continue; }
      const pv = g.player.vehicle;
      const playerSlow = !pv || Math.abs(pv.speed) < 5;
      if (!u.deployed && stars >= 2 && d < 20 && playerSlow) { // officers bail out
        u.deployed = true;
        const rx = Math.cos(v.heading), rz = -Math.sin(v.heading);
        for (const s of [-1, 1]) this.spawnCop(v.pos.x + rx * s * 1.8, v.pos.z + rz * s * 1.8, u);
      }
      if (u.deployed) {
        v.drive(dt, { throttle: 0, steer: 0, handbrake: true }, g.colliders, g.fx, g.skids);
        const crew = this.cops.filter((c) => c.unit === u && c.alive);
        if ((stars === 0 || (pv && d > 40)) && crew.every((c) => c.remove || Math.hypot(c.x - v.pos.x, c.z - v.pos.z) < 2.5)) {
          for (const c of crew) c.remove = true;
          u.deployed = false;
        }
      } else this.driveUnit(u, dt);
      v.sirenOn = stars > 0;
    }
    for (const c of this.cops) this.updateCop(c, dt, stars);
    this.cops = this.cops.filter((c) => {
      const gone = c.remove || (!c.alive && c.downT <= 0) || Math.hypot(c.x - f.x, c.z - f.z) > 200;
      if (gone) g.scene.remove(c.h.root);
      return !gone;
    });

    // helicopter
    let heliSees = false;
    if (stars >= 3 && !this.heli) this.heli = new Helicopter(g, f.x - 120, f.z - 80);
    if (this.heli) {
      this.heli.leaving = stars < 3;
      heliSees = this.heli.update(dt, f, stars);
      if (this.heli.leaving && Math.hypot(this.heli.pos.x - f.x, this.heli.pos.z - f.z) > 200) { this.heli.dispose(); this.heli = null; }
    }

    // line of sight -> wanted drain
    let seen = heliSees;
    if (!seen) for (const u of this.units) { const d = u.v.pos.distanceTo(f); if (d < 70 && g.colliders.clearLine(u.v.pos.x, u.v.pos.z, f.x, f.z)) { seen = true; break; } }
    if (!seen) for (const c of this.cops) if (c.alive && Math.hypot(c.x - f.x, c.z - f.z) < 55 && g.colliders.clearLine(c.x, c.z, f.x, f.z)) { seen = true; break; }
    w.update(dt, seen);

    // arrest: standing still next to an officer, or boxed in a stopped car
    if (stars > 0 && !g.player.dead) {
      const pv = g.player.vehicle;
      let close = false;
      if (!pv) close = this.cops.some((c) => c.alive && Math.hypot(c.x - f.x, c.z - f.z) < 2.2) && g.player.speed < 2.5;
      else close = Math.abs(pv.speed) < 1 && this.units.filter((u) => u.v.pos.distanceTo(f) < 6.5).length >= 2;
      this.bustT = close ? this.bustT + dt : Math.max(0, this.bustT - dt * 2);
      if (this.bustT > (pv ? 2.5 : 1.5)) { this.bustT = 0; g.onBusted?.(); }
    } else this.bustT = 0;
  }

  /** Remove every unit (after death/arrest or loading a save). */
  reset() {
    const g = this.game;
    for (const u of this.units) g.vehicles.remove(u.v);
    for (const c of this.cops) g.scene.remove(c.h.root);
    this.units = []; this.cops = [];
    if (this.heli) { this.heli.dispose(); this.heli = null; }
  }
}
