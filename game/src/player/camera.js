// Third-person camera rig: mouse-orbit on foot (distance 7, height ~3) with an over-the-
// shoulder pull-in while aiming, a lagging chase camera behind cars that the mouse can
// swing around, and wall avoidance so buildings never block the view.
import * as THREE from 'three';
import { clamp, damp, dampAngle, wrapAngle } from '../core/mathx.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;      // direction the camera looks along (heading convention: forward = (sin, cos))
    this.pitch = 0.18;
    this.dist = 7;
    this.orbitOffset = 0; // extra yaw from the mouse while driving
    this.orbitHold = 0;
    this.focus = new THREE.Vector3();
    this.shake = 0;
    this.fov = 62;
  }

  /** Forward unit vector of the view (for aiming). */
  aimDir(out = new THREE.Vector3()) {
    return this.camera.getWorldDirection(out);
  }

  update(dt, input, player, colliders, sensitivity = 1) {
    const mdx = input.mouseDX * 0.0024 * sensitivity, mdy = input.mouseDY * 0.0022 * sensitivity;
    const v = player.vehicle;
    let target, dist, height;
    if (!v) {
      this.yaw = wrapAngle(this.yaw - mdx);
      this.pitch = clamp(this.pitch + mdy, -0.5, 1.1);
      const aiming = player.aiming;
      dist = aiming ? 3.6 : 7;
      this.dist = damp(this.dist, dist, 8, dt);
      target = new THREE.Vector3(player.pos.x, player.pos.y + (aiming ? 1.65 : 1.55), player.pos.z);
      if (aiming) { // shoulder offset to the right
        target.x += Math.cos(this.yaw) * -0.7;
        target.z += -Math.sin(this.yaw) * -0.7;
      }
      height = 0;
      this.fov = damp(this.fov, aiming ? 55 : 62, 6, dt);
    } else {
      if (Math.abs(mdx) + Math.abs(mdy) > 0.0005) { this.orbitOffset = wrapAngle(this.orbitOffset - mdx); this.orbitHold = 1.6; }
      this.orbitHold -= dt;
      if (this.orbitHold <= 0) this.orbitOffset = damp(this.orbitOffset, 0, 2.5, dt);
      const desired = v.heading + this.orbitOffset;
      this.yaw = dampAngle(this.yaw, desired, 5, dt);
      this.pitch = damp(this.pitch, 0.2, 3, dt);
      const spd = Math.abs(v.speed);
      this.dist = damp(this.dist, v.camDist + spd * 0.06, 3, dt);
      target = new THREE.Vector3(v.pos.x, v.pos.y + v.camHeight, v.pos.z);
      this.fov = damp(this.fov, 62 + Math.min(16, spd * 0.35), 3, dt);
    }
    this.focus.lerp(target, 1 - Math.exp(-20 * dt));
    if (this.focus.distanceTo(target) > 30) this.focus.copy(target);

    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dir = new THREE.Vector3(-Math.sin(this.yaw) * cp, sp, -Math.cos(this.yaw) * cp);
    // pull in if a building is between focus and camera
    const hit = colliders.raycast(this.focus.x, this.focus.y, this.focus.z, dir.x, dir.y, dir.z, this.dist);
    const d = Math.max(1.2, Math.min(this.dist, hit - 0.4));
    const pos = this.focus.clone().addScaledVector(dir, d);
    pos.y = Math.max(pos.y, 0.6);
    if (this.shake > 0) {
      pos.x += (Math.random() - 0.5) * this.shake;
      pos.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 2);
    }
    this.camera.position.copy(pos);
    this.camera.lookAt(this.focus.x, this.focus.y + (v ? 0.4 : 0.2), this.focus.z);
    if (Math.abs(this.camera.fov - this.fov) > 0.05) { this.camera.fov = this.fov; this.camera.updateProjectionMatrix(); }
  }

  /** Place the camera exactly (used by screenshot staging and cutscenes). */
  setPose(pos, look) {
    this.camera.position.copy(pos);
    this.camera.lookAt(look);
    this.focus.copy(look);
  }
}
