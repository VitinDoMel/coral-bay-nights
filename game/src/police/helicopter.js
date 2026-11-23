// CVPD air unit SKYHAWK-1: circles above the player from 3 stars, sweeping a searchlight
// (a real SpotLight that lights a circle on the street, a faint volumetric cone and a
// bright ground ring) and, at 5 stars, a marksman takes shots from the door.
import * as THREE from 'three';
import { buildHelicopter } from '../vehicles/car-models.js';
import { damp } from '../core/mathx.js';

export class Helicopter {
  constructor(game, x, z) {
    this.game = game;
    const parts = buildHelicopter();
    this.parts = parts;
    this.root = parts.root;
    this.pos = new THREE.Vector3(x, 60, z);
    this.root.position.copy(this.pos);
    game.scene.add(this.root);
    this.angle = 0;
    this.heading = 0;
    this.callsign = 'SKYHAWK-1';
    this.leaving = false;
    this.cool = 3;

    this.spot = new THREE.SpotLight('#fff6dc', 500, 90, 0.25, 0.6, 1.2);
    this.spot.castShadow = false;
    game.scene.add(this.spot, this.spot.target);
    // faint volume cone, apex at the lamp
    const coneGeo = new THREE.ConeGeometry(1, 1, 24, 1, true);
    coneGeo.translate(0, -0.5, 0);
    this.cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    this.cone.renderOrder = 6;
    game.scene.add(this.cone);
    // brighter core beam inside the outer cone
    this.core = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: '#fff8dc', transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    this.core.renderOrder = 6;
    game.scene.add(this.core);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48), new THREE.MeshBasicMaterial({ color: '#fff4cc', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.renderOrder = 3;
    game.scene.add(this.ring);
    this.aim = new THREE.Vector3(x, 0, z);
  }

  dispose() {
    const s = this.game.scene;
    s.remove(this.root, this.spot, this.spot.target, this.cone, this.core, this.ring);
  }

  /** Keep station near the player; returns true when the light is on them. */
  update(dt, target, stars) {
    const t = this.game.time;
    this.angle += dt * 0.35;
    const r = this.leaving ? 260 : 22;
    const want = new THREE.Vector3(target.x + Math.cos(this.angle) * r, this.leaving ? 70 : 30 + Math.sin(t * 0.7) * 2, target.z + Math.sin(this.angle) * r);
    this.pos.x = damp(this.pos.x, want.x, 0.9, dt);
    this.pos.y = damp(this.pos.y, want.y, 0.9, dt);
    this.pos.z = damp(this.pos.z, want.z, 0.9, dt);
    const dx = target.x - this.pos.x, dz = target.z - this.pos.z;
    this.heading = Math.atan2(dx, dz);
    this.root.position.copy(this.pos);
    this.root.rotation.set(0.12, this.heading, Math.sin(t * 0.8) * 0.05);
    this.parts.rotor.rotation.y += dt * 28;
    this.parts.tailRotor.rotation.x += dt * 40;

    // searchlight sweeps lazily around the target
    this.aim.x = damp(this.aim.x, target.x + Math.sin(t * 1.3) * 1.5, 3, dt);
    this.aim.z = damp(this.aim.z, target.z + Math.cos(t * 1.1) * 1.5, 3, dt);
    const lamp = new THREE.Vector3(0, -1.3, 2.3).applyEuler(this.root.rotation).add(this.pos);
    const blink = Math.floor(t * 1.6) % 2 === 0;
    this.parts.beaconGlow.visible = blink;
    this.parts.beaconRed.color.setRGB(blink ? 2 : 0.3, 0.05, 0.08);
    this.parts.beaconWhite.color.setScalar(Math.floor(t * 2.3) % 3 === 0 ? 2 : 0.3);
    this.spot.position.copy(lamp);
    this.spot.target.position.copy(this.aim);
    const toGround = this.aim.clone().sub(lamp);
    const len = toGround.length();
    const radius = Math.tan(0.25) * len;
    this.cone.position.copy(lamp);
    this.cone.scale.set(radius, len, radius);
    this.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), toGround.normalize());
    this.core.position.copy(lamp);
    this.core.quaternion.copy(this.cone.quaternion);
    this.core.scale.set(radius * 0.55, len, radius * 0.55);
    this.ring.position.set(this.aim.x, 0.06, this.aim.z);
    this.ring.scale.setScalar(radius * 0.95);
    const on = !this.leaving;
    this.spot.intensity = on ? 650 : 0;
    this.cone.visible = this.core.visible = this.ring.visible = this.parts.lampGlow.visible = on;

    // door gunner at 5 stars
    if (on && stars >= 5) {
      this.cool -= dt;
      if (this.cool <= 0) {
        this.cool = 1.6;
        const g = this.game;
        const from = lamp.clone().add(new THREE.Vector3(0, 0.5, 0));
        const dir = new THREE.Vector3(target.x - from.x + (Math.random() - 0.5) * 3, 1 - from.y, target.z - from.z + (Math.random() - 0.5) * 3).normalize();
        g.combat.shoot('police', from, dir, 9, 120, from);
        g.audio?.gun(5, from);
      }
    }
    return on && Math.hypot(target.x - this.aim.x, target.z - this.aim.z) < radius + 3;
  }
}
