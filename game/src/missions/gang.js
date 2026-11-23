// Barracuda crew gunmen for mission fights: they hold a post behind cover, step out to
// fire at the player when they have a line of sight, and drop when shot.
import * as THREE from 'three';
import { buildHuman, animateHuman, setHeldWeapon } from '../actors/humanoid.js';
import { range } from '../core/rng.js';
import { dampAngle } from '../core/mathx.js';

const LOOKS = [
  { skin: '#b97a56', hair: '#111', shirt: '#0f1b2d', pants: '#2b2d42', cap: '#e63946', shades: true },
  { skin: '#8d5a3b', hair: '#111', shirt: '#e63946', pants: '#1d1d1d', hairStyle: 'bald' },
  { skin: '#f1c7a5', hair: '#3b2516', shirt: '#14213d', pants: '#3d405b', vest: '#4a4e69' },
];

export class GangMember {
  constructor(game, x, z, look = 0, weapon = 3) {
    this.game = game;
    this.h = buildHuman(LOOKS[look % LOOKS.length]);
    setHeldWeapon(this.h, weapon);
    game.scene.add(this.h.root);
    this.x = x; this.z = z; this.post = { x, z };
    this.heading = 0; this.health = 60; this.alive = true;
    this.cool = range(1, 2.5); this.phase = 0; this.weapon = weapon;
    this.alert = false;
  }

  update(dt) {
    const g = this.game, p = g.player;
    const f = p.vehicle ? p.vehicle.pos : p.pos;
    if (!this.alive) { animateHuman(this.h, 0, 0, 'down'); this.h.root.position.set(this.x, 0, this.z); return; }
    const dx = f.x - this.x, dz = f.z - this.z, d = Math.hypot(dx, dz);
    if (d < 45) this.alert = true;
    let sp = 0;
    if (this.alert) {
      this.heading = dampAngle(this.heading, Math.atan2(dx, dz), 8, dt);
      const los = g.colliders.clearLine(this.x, this.z, f.x, f.z, 1.4);
      if (!los && d > 6) { // step around cover toward the player
        const px = this.x, pz = this.z;
        this.x += dx / d * 3 * dt; this.z += dz / d * 3 * dt;
        const pos = { x: this.x, z: this.z };
        g.colliders.resolveCircle(pos, 0.4);
        this.x = pos.x; this.z = pos.z;
        sp = Math.hypot(this.x - px, this.z - pz) / dt;
      }
      this.cool -= dt;
      if (los && d < 50 && this.cool <= 0 && !p.dead) {
        this.cool = range(0.5, 1.1);
        const m = new THREE.Vector3(this.x + Math.sin(this.heading) * 0.75, 1.45, this.z + Math.cos(this.heading) * 0.75);
        const spread = 0.05 + d * 0.003;
        const dir = new THREE.Vector3(f.x - m.x + range(-1, 1) * spread * d, (p.vehicle ? 1 : p.pos.y + 1.2) - m.y + range(-1, 1) * spread * d * 0.5, f.z - m.z + range(-1, 1) * spread * d).normalize();
        g.combat.shoot('gang', m, dir, 6, 60, m);
        g.fx.muzzle(m.x, m.y, m.z, Math.sin(this.heading), Math.cos(this.heading));
        g.audio?.gun(this.weapon, m);
      }
    }
    this.phase += sp * dt * 2;
    this.h.root.position.set(this.x, 0, this.z);
    this.h.root.rotation.y = this.heading;
    animateHuman(this.h, this.phase, sp / 7.5, this.alert ? 'aim' : 'move');
  }

  dispose() { this.game.scene.remove(this.h.root); }
}
