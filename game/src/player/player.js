// Rafa Sol on foot: camera-relative WASD movement, sprint, jump, collision with the city,
// health and armour. Driving is handed to the vehicle the player sits in.
import * as THREE from 'three';
import { buildHuman, animateHuman, setHeldWeapon } from '../actors/humanoid.js';
import { dampAngle, clamp } from '../core/mathx.js';

export const RAFA_LOOK = {
  skin: '#c98d66', hair: '#1d1410', hairStyle: 'short', shirt: '#ff7a59', accent: '#f6f1e7',
  pants: '#c8b48a', shoes: '#f4f4f4', shades: true,
};

export class Player {
  constructor(scene) {
    this.model = buildHuman(RAFA_LOOK);
    scene.add(this.model.root);
    this.pos = new THREE.Vector3(0, 0, 0);
    this.heading = 0;
    this.velY = 0;
    this.speed = 0;
    this.onGround = true;
    this.phase = 0;
    this.health = 100;
    this.armor = 0;
    this.vehicle = null;
    this.aiming = false;
    this.punchT = 0;
    this.dead = false;
    this.radius = 0.4;
    this.hitFlash = 0;
  }

  get inCar() { return !!this.vehicle; }

  place(x, z, heading = 0) {
    this.pos.set(x, 0, z);
    this.heading = heading;
    this.velY = 0;
  }

  damage(amount, ctx) {
    if (this.dead) return;
    const absorbed = Math.min(this.armor, amount * 0.7);
    this.armor -= absorbed;
    this.health = clamp(this.health - (amount - absorbed), 0, 100);
    this.hitFlash = 0.35;
    if (this.health <= 0) ctx?.onPlayerDeath?.();
  }

  updateOnFoot(dt, input, cam, colliders, weaponId) {
    const fwd = input.axis('KeyS', 'KeyW');
    const side = input.axis('KeyA', 'KeyD');
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    this.aiming = input.rightDown || (input.mouseDown && weaponId >= 2);
    let mx = 0, mz = 0;
    if (fwd || side) {
      const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
      // camera looks along (-sin yaw, -cos yaw); right is (cos yaw, -sin yaw)... in our rig forward = (sin,cos)
      mx = s * fwd - c * side;
      mz = c * fwd + s * side;
      const len = Math.hypot(mx, mz);
      mx /= len; mz /= len;
    }
    const target = (fwd || side) ? (sprint && !this.aiming ? 7.5 : this.aiming ? 2.6 : 4.2) : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * 10);
    const prevX = this.pos.x, prevZ = this.pos.z;
    this.pos.x += mx * this.speed * dt;
    this.pos.z += mz * this.speed * dt;
    if (this.aiming) this.heading = dampAngle(this.heading, cam.yaw, 20, dt);
    else if (fwd || side) this.heading = dampAngle(this.heading, Math.atan2(mx, mz), 12, dt);

    if (this.onGround && input.pressed('Space')) { this.velY = 5.2; this.onGround = false; }
    this.velY -= 14 * dt;
    this.pos.y += this.velY * dt;
    if (this.pos.y <= 0) { this.pos.y = 0; this.velY = 0; this.onGround = true; }

    colliders.resolveCircle(this.pos, this.radius, this.pos.y);
    colliders.keepOnLand(this.pos, prevX, prevZ);
    this.phase += this.speed * dt * 2.2;
    if (this.punchT > 0) this.punchT -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
  }

  syncModel(weaponId, aimPitch, t) {
    const m = this.model;
    m.root.visible = !this.vehicle;
    m.root.position.copy(this.pos);
    m.root.rotation.y = this.heading;
    setHeldWeapon(m, this.vehicle ? -1 : weaponId);
    if (this.dead) animateHuman(m, 0, 0, 'down');
    else if (this.vehicle) animateHuman(m, 0, 0, 'sit');
    else if (this.punchT > 0) animateHuman(m, this.phase, this.speed / 7.5, 'punch', 0, t);
    else if (this.aiming && weaponId >= 2) animateHuman(m, this.phase, this.speed / 7.5, 'aim', aimPitch);
    else animateHuman(m, this.phase, this.speed / 7.5, 'move');
  }
}
