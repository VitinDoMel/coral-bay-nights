// The weapon rack (1 Fists .. 7 Launcher): stats, ammo, reloads, switching with number keys
// or the mouse wheel, and the player's trigger: hitscan bullets with spread, shotgun
// pellets, melee swings and launcher rockets.
import * as THREE from 'three';
import { range } from '../core/rng.js';

export const WEAPONS = [
  { id: 0, key: 'Fists', name: 'Fists', melee: true, dmg: 14, reach: 1.7, rate: 0.42, price: 0 },
  { id: 1, key: 'Bat', name: 'Boardwalk Bat', melee: true, dmg: 34, reach: 2.3, rate: 0.6, price: 150 },
  { id: 2, key: 'Pistol', name: 'Sol .45', dmg: 26, rate: 0.26, clip: 12, spread: 0.012, reach: 90, price: 400, ammoPrice: 60, ammoPack: 24 },
  { id: 3, key: 'SMG', name: 'Ripcurl SMG', dmg: 14, rate: 0.075, clip: 30, spread: 0.035, reach: 70, auto: true, price: 1200, ammoPrice: 120, ammoPack: 60 },
  { id: 4, key: 'Shotgun', name: 'Breakwater 12', dmg: 13, pellets: 8, rate: 0.85, clip: 6, spread: 0.08, reach: 35, price: 1800, ammoPrice: 150, ammoPack: 12 },
  { id: 5, key: 'Rifle', name: 'Longshore AR', dmg: 30, rate: 0.11, clip: 30, spread: 0.016, reach: 120, auto: true, price: 3500, ammoPrice: 200, ammoPack: 60 },
  { id: 6, key: 'Launcher', name: 'Flare RL', rocket: true, dmg: 120, rate: 1.4, clip: 1, spread: 0, reach: 200, price: 8000, ammoPrice: 500, ammoPack: 3 },
];

export class Arsenal {
  constructor() {
    this.owned = [true, false, true, false, false, false, false];
    this.clip = [0, 0, 12, 0, 0, 0, 0];
    this.ammo = [0, 0, 36, 0, 0, 0, 0];
    this.current = 0;
    this.cool = 0;
    this.reloadT = 0;
  }

  get weapon() { return WEAPONS[this.current]; }

  select(id) {
    if (!this.owned[id] || id === this.current) return false;
    this.current = id;
    this.reloadT = 0;
    this.cool = 0.25;
    return true;
  }

  cycle(dir) {
    for (let k = 1; k <= 7; k++) {
      const id = (this.current + dir * k + 7) % 7;
      if (this.owned[id]) return this.select(id);
    }
    return false;
  }

  give(id, ammo = 0) {
    this.owned[id] = true;
    const w = WEAPONS[id];
    if (w.clip) {
      this.ammo[id] += ammo;
      if (this.clip[id] === 0) this.refill(id);
    }
  }

  refill(id) {
    const w = WEAPONS[id];
    const need = w.clip - this.clip[id];
    const take = Math.min(need, this.ammo[id]);
    this.clip[id] += take;
    this.ammo[id] -= take;
  }

  startReload() {
    const w = this.weapon;
    if (!w.clip || this.clip[w.id] >= w.clip || this.ammo[w.id] <= 0 || this.reloadT > 0) return false;
    this.reloadT = w.id === 4 ? 1.4 : w.id === 6 ? 1.8 : 1.1;
    return true;
  }

  update(dt) {
    if (this.cool > 0) this.cool -= dt;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.refill(this.current);
    }
  }

  /** Try to fire this frame; returns the weapon if a shot goes off. */
  trigger(held, clicked) {
    const w = this.weapon;
    if (this.cool > 0 || this.reloadT > 0) return null;
    if (!(w.auto ? held : clicked)) return null;
    if (w.clip) {
      if (this.clip[w.id] <= 0) { this.startReload(); return null; }
      this.clip[w.id]--;
      if (this.clip[w.id] === 0) this.startReload();
    }
    this.cool = w.rate;
    return w;
  }

  serialize() { return { owned: this.owned, clip: this.clip, ammo: this.ammo, current: this.current }; }
  load(s) { Object.assign(this, { owned: s.owned, clip: s.clip, ammo: s.ammo, current: s.current }); }
}

/** Player shooting: turns a trigger pull into hitscan rays or a rocket via the combat system. */
export function playerFire(game, w) {
  const p = game.player;
  const cam = game.camera;
  const dir = new THREE.Vector3();
  cam.getWorldDirection(dir);
  const muzzle = new THREE.Vector3(p.pos.x + Math.sin(p.heading) * 0.7 + Math.cos(p.heading) * -0.25, p.pos.y + 1.45, p.pos.z + Math.cos(p.heading) * 0.7 - Math.sin(p.heading) * -0.25);
  if (w.melee) {
    p.punchT = 0.25;
    game.combat.melee('player', p.pos, p.heading, w.reach, w.dmg);
    game.audio?.swing();
    return;
  }
  // aim from the camera so the crosshair is honest, but start rays near the player
  const origin = cam.position.clone().addScaledVector(dir, Math.max(0, cam.position.distanceTo(muzzle) - 0.5));
  if (w.rocket) {
    game.combat.launchRocket('player', muzzle, dir);
    game.audio?.gun(6, p.pos);
  } else {
    const n = w.pellets ?? 1;
    for (let i = 0; i < n; i++) {
      const d = dir.clone().add(new THREE.Vector3(range(-w.spread, w.spread), range(-w.spread, w.spread), range(-w.spread, w.spread))).normalize();
      game.combat.shoot('player', origin, d, w.dmg, w.reach, muzzle);
    }
    game.audio?.gun(w.id, p.pos);
  }
  game.fx.muzzle(muzzle.x, muzzle.y, muzzle.z, Math.sin(p.heading), Math.cos(p.heading));
  game.cam.shake = Math.max(game.cam.shake, w.id >= 4 ? 0.12 : 0.04);
  game.peds.scare(p.pos.x, p.pos.z, 35);
  game.wanted?.crime('gunfire', p.pos);
}
