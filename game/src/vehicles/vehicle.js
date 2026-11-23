// One car: arcade physics (throttle, brake/reverse, speed-scaled steering, lateral grip that
// the handbrake breaks into a drift), collision against the city with bounce and damage,
// body roll, spinning/steering wheels, brake lights, smoke and fire as it falls apart.
import * as THREE from 'three';
import { buildCar, MODELS } from './car-models.js';
import { clamp, wrapAngle } from '../core/mathx.js';
import { rand } from '../core/rng.js';

let nextId = 1;

export class Vehicle {
  constructor(scene, modelIndex, color, kind = 'civ') {
    this.id = nextId++;
    this.kind = kind; // civ | cab | police | target
    this.modelIndex = modelIndex;
    this.color = color;
    this.parts = buildCar(modelIndex, color, kind === 'target' ? 'civ' : kind);
    this.spec = MODELS[modelIndex];
    this.root = this.parts.root;
    scene.add(this.root);
    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.vx = 0; this.vz = 0;
    this.speed = 0; // signed forward speed
    this.lat = 0;
    this.steer = 0;
    this.spin = 0;
    this.roll = 0; this.pitch = 0;
    this.health = 100;
    this.burnT = 0;
    this.dead = false;
    this.driver = null; // 'player' | 'ai' | null
    this.ai = null;
    this.radius = Math.max(this.spec.wid, this.spec.len) / 2;
    this.camDist = 5.2 + this.spec.len * 0.3;
    this.camHeight = 1.3 + this.spec.bodyH;
    this.sirenOn = false;
    this.sirenT = (this.id % 4) * 0.13; // desync neighbouring light bars
    this.braking = false;
    this.sliding = 0;
    this.hitCooldown = 0;
  }

  get forwardX() { return Math.sin(this.heading); }
  get forwardZ() { return Math.cos(this.heading); }

  place(x, z, heading) {
    this.pos.set(x, 0, z);
    this.heading = heading;
    this.vx = this.vz = this.speed = 0;
    this.syncModel(0);
  }

  /** controls: { throttle -1..1, steer -1..1, handbrake bool } */
  drive(dt, c, colliders, fx, skids) {
    if (this.dead) { c = { throttle: 0, steer: 0, handbrake: true }; }
    const sp = this.spec;
    const fx0 = this.forwardX, fz0 = this.forwardZ;
    const rx = fz0, rz = -fx0; // right vector
    let fwd = this.vx * fx0 + this.vz * fz0;
    let lat = this.vx * rx + this.vz * rz;
    const healthK = 0.55 + 0.45 * (this.health / 100);
    this.braking = false;
    if (c.throttle > 0) {
      if (fwd < -0.5) { fwd += 30 * dt; this.braking = true; }
      else fwd += sp.accel * c.throttle * healthK * (1 - Math.max(0, fwd) / (sp.maxSpeed * healthK)) * dt * 1.6;
    } else if (c.throttle < 0) {
      if (fwd > 0.5) { fwd -= 28 * dt; this.braking = true; }
      else fwd = Math.max(-12, fwd + sp.accel * c.throttle * 0.7 * dt);
    } else {
      fwd *= Math.exp(-0.45 * dt);
      if (Math.abs(fwd) < 0.3) fwd = 0;
    }
    if (c.handbrake) { fwd *= Math.exp(-1.6 * dt); this.braking = true; }
    // steering: faster wheel response at low speed, less lock at top speed
    const target = c.steer * (1 - Math.min(0.55, Math.abs(fwd) / 70));
    this.steer += (target - this.steer) * Math.min(1, dt * 7);
    const turn = this.steer * clamp(fwd / 7, -1, 1) * (c.handbrake ? 2.5 : 1.9);
    this.heading = wrapAngle(this.heading - turn * dt);
    const grip = c.handbrake ? 1.4 : sp.grip;
    lat *= Math.exp(-grip * dt);
    // carry some forward speed into slide when the heading swings (drift feel)
    const nfx = this.forwardX, nfz = this.forwardZ, nrx = nfz, nrz = -nfx;
    this.vx = nfx * fwd + nrx * lat;
    this.vz = nfz * fwd + nrz * lat;
    this.speed = fwd;
    this.lat = lat;
    this.sliding = Math.abs(lat) > 3.2 || (c.handbrake && Math.abs(fwd) > 6) ? 1 : 0;

    const prevX = this.pos.x, prevZ = this.pos.z;
    this.pos.x += this.vx * dt;
    this.pos.z += this.vz * dt;
    this.collideStatic(colliders, prevX, prevZ, fx);

    this.spin += fwd * dt / 0.38;
    this.roll += ((-lat * 0.012 - this.steer * fwd * 0.0025) - this.roll) * Math.min(1, dt * 6);
    this.pitch += ((this.braking ? 0.03 : c.throttle > 0 ? -0.015 : 0) - this.pitch) * Math.min(1, dt * 5);
    if (this.hitCooldown > 0) this.hitCooldown -= dt;

    // tyre marks
    if (skids) {
      const keys = [0, 1, 2, 3];
      const sx = sp.wid / 2 - 0.12, sz = sp.len / 2 - 0.85;
      const offs = [[-sx, -sz], [sx, -sz], [-sx, sz], [sx, sz]];
      for (const k of keys) {
        const [ox, oz] = offs[k];
        const wx = this.pos.x + nrx * ox + nfx * oz, wz = this.pos.z + nrz * ox + nfz * oz;
        if (this.sliding && (k < 2 || c.handbrake)) {
          skids.mark(this.id * 4 + k, wx, wz, Math.min(1, Math.abs(lat) / 8 + 0.4));
          if (rand() < 0.3 && fx) fx.smoke(wx, 0.3, wz, 0.05, 0.5);
        } else skids.lift(this.id * 4 + k);
      }
    }
    this.updateDamageFx(dt, fx);
  }

  collideStatic(colliders, prevX, prevZ, fx) {
    const sp = this.spec;
    const r = sp.wid / 2 + 0.05;
    let worst = null;
    for (const off of [-sp.len / 2 + r, 0, sp.len / 2 - r]) {
      const p = { x: this.pos.x + this.forwardX * off, z: this.pos.z + this.forwardZ * off };
      const hit = colliders.resolveCircle(p, r, 0.5);
      if (hit) {
        this.pos.x += p.x - (this.pos.x + this.forwardX * off);
        this.pos.z += p.z - (this.pos.z + this.forwardZ * off);
        if (!worst || hit.depth > worst.depth) worst = hit;
      }
    }
    if (colliders.keepOnLand(this.pos, prevX, prevZ)) {
      this.vx *= -0.3; this.vz *= -0.3;
    }
    if (worst) {
      const vn = this.vx * worst.nx + this.vz * worst.nz;
      if (vn < 0) {
        this.vx -= vn * worst.nx * 1.35;
        this.vz -= vn * worst.nz * 1.35;
        this.vx *= 0.8; this.vz *= 0.8;
        const impact = -vn;
        if (impact > 5 && this.hitCooldown <= 0) {
          this.damage(impact * 0.9);
          this.hitCooldown = 0.3;
          if (fx) fx.sparks(this.pos.x - worst.nx * this.spec.wid * 0.5, 0.6, this.pos.z - worst.nz * this.spec.wid * 0.5, Math.min(30, impact * 1.5));
          this.onImpact?.(impact);
        }
      }
    }
  }

  damage(amount) {
    if (this.dead) return;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0 && this.burnT === 0) this.burnT = 4.5; // burns, then blows
  }

  updateDamageFx(dt, fx) {
    if (!fx || this.dead) return;
    const hx = this.pos.x + this.forwardX * this.spec.len * 0.38, hz = this.pos.z + this.forwardZ * this.spec.len * 0.38;
    const hy = this.spec.ride + this.spec.bodyH + 0.2;
    if (this.health < 55 && rand() < (0.75 - this.health / 100) * dt * 30) fx.smoke(hx, hy, hz, 1 - this.health / 55, 0.6);
    if (this.health < 22 && rand() < dt * 20) fx.fire(hx, hy, hz, 0.6);
    if (this.burnT > 0) {
      this.burnT -= dt;
      if (rand() < dt * 30) fx.fire(hx, hy, hz, 0.9);
      if (this.burnT <= 0) this.explode?.();
    }
  }

  /** Simple AI drive toward a point: steer toward it and hold a target speed. */
  steerToward(tx, tz, targetSpeed) {
    const want = Math.atan2(tx - this.pos.x, tz - this.pos.z);
    const diff = wrapAngle(want - this.heading);
    const steer = clamp(-diff * 2.2, -1, 1);
    const fwd = this.speed;
    const sp = targetSpeed * (1 - Math.min(0.6, Math.abs(diff) * 0.7));
    const throttle = fwd < sp - 1 ? 1 : fwd > sp + 2 ? -0.6 : 0.1;
    return { throttle, steer, handbrake: false };
  }

  syncModel(dt, dusk = 0) {
    const r = this.root;
    r.position.copy(this.pos);
    r.rotation.y = this.heading;
    this.parts.body.rotation.z = this.roll;
    this.parts.body.rotation.x = this.pitch;
    for (const w of this.parts.wheels) w.rotation.x = this.spin;
    for (const s of this.parts.steerWheels) s.rotation.y = -this.steer * 0.45;
    const tail = this.braking ? 1.6 : 0.55 + dusk * 0.4;
    this.parts.tailMat.color.setRGB(0.75 * tail, 0.06 * tail, 0.14 * tail);
    const head = 0.6 + dusk * 0.8;
    this.parts.headMat.color.setRGB(head, head * 0.96, head * 0.85);
    const sir = this.parts.siren;
    if (sir) {
      if (this.sirenOn) {
        this.sirenT += dt;
        const phase = Math.floor(this.sirenT / 0.25) % 2;
        const strobe = Math.floor(this.sirenT / 0.0625) % 2;
        sir.red.color.setRGB(phase === 0 ? 2.2 * (0.6 + strobe * 0.4) : 0.25, 0.03, 0.06);
        sir.blue.color.setRGB(0.04, 0.12, phase === 1 ? 2.4 * (0.6 + strobe * 0.4) : 0.25);
        sir.light.color.set(phase === 0 ? '#ff2040' : '#2050ff');
        sir.light.intensity = 6;
        sir.redGlow.material.opacity = phase === 0 ? 0.95 : 0.15;
        sir.blueGlow.material.opacity = phase === 1 ? 0.95 : 0.15;
        sir.redGlow.visible = sir.blueGlow.visible = true;
      } else {
        sir.red.color.setRGB(0.35, 0.05, 0.08);
        sir.blue.color.setRGB(0.05, 0.1, 0.4);
        sir.light.intensity = 0;
        sir.redGlow.visible = sir.blueGlow.visible = false;
      }
    }
    if (this.dead) this.parts.body.children.forEach((c) => { if (c.material?.color && c.material.isMeshStandardMaterial) c.material = CHAR; });
  }
}

const CHAR = new THREE.MeshStandardMaterial({ color: '#1b1a1a', roughness: 1 });
