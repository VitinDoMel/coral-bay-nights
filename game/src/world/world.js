// Assembles Coral Vista: static colliders, roads, buildings, props, sky and sea, and drives
// the time of day (golden hour drifting into neon dusk and back).
import { StaticColliders } from './collision.js';
import { buildRoads } from './roads.js';
import { buildCity } from './buildings.js';
import { buildProps } from './props.js';
import { Sky } from './sky.js';
import { Sea } from './water.js';
import { Marina } from './marina.js';

export class World {
  constructor(scene, seed = 1) {
    this.scene = scene;
    this.colliders = new StaticColliders();
    this.roads = buildRoads(scene, this.colliders);
    this.city = buildCity(scene, this.colliders, seed);
    this.props = buildProps(scene, this.colliders, seed);
    this.sky = new Sky(scene);
    this.sea = new Sea(scene);
    this.marina = new Marina(scene);
    this.clock = 0.25; // 0..1 around the day loop
    this.lockedDusk = null;
    this.setDusk(0.25);
  }

  setDusk(d) {
    this.dusk = d;
    this.sky.setDusk(d);
    this.city.setDusk(d);
    this.props.setDusk(d);
  }

  update(dt, camera, focus) {
    if (this.lockedDusk === null) {
      this.clock = (this.clock + dt / 600) % 1; // ten-minute loop
      const d = 0.15 + 0.75 * (0.5 - 0.5 * Math.cos(this.clock * Math.PI * 2));
      if (Math.abs(d - this.dusk) > 0.002) this.setDusk(d);
    } else if (this.dusk !== this.lockedDusk) this.setDusk(this.lockedDusk);
    this.sky.follow(camera, focus);
    this.sea.update(dt, this.sky, this.scene);
    this.marina.update(this.sea.uniforms.time.value);
  }
}
