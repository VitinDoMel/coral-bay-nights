// Sky dome (blue overhead fading to a peach horizon, sun disc and glow), sun and hemisphere
// lights with a shadow camera that follows the action, warm fog, distant hills, and the
// golden-hour -> neon-dusk time of day every other system reads.
import * as THREE from 'three';
import { lerp } from '../core/mathx.js';
import { makeRng } from '../core/rng.js';

const KEYS = {
  // dusk = 0: golden afternoon, 1: pink/violet dusk
  top: [new THREE.Color('#3d86d6'), new THREE.Color('#3a2a6e')],
  mid: [new THREE.Color('#8cc3ec'), new THREE.Color('#c0558f')],
  horizon: [new THREE.Color('#ffd2a0'), new THREE.Color('#ff9a5c')],
  fog: [new THREE.Color('#f3c9a6'), new THREE.Color('#b0607e')],
  sun: [new THREE.Color('#fff0d0'), new THREE.Color('#ff9a62')],
  hemiSky: [new THREE.Color('#bfdcff'), new THREE.Color('#9a6fb0')],
  hemiGround: [new THREE.Color('#c9a27a'), new THREE.Color('#5a3a52')],
};

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.dusk = 0.2;
    this.uniforms = {
      topColor: { value: new THREE.Color() },
      midColor: { value: new THREE.Color() },
      horizonColor: { value: new THREE.Color() },
      sunColor: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3() },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 topColor; uniform vec3 midColor; uniform vec3 horizonColor; uniform vec3 sunColor; uniform vec3 sunDir;
        varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          float h = max(d.y, 0.0);
          vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.18, h));
          col = mix(col, topColor, smoothstep(0.18, 0.75, h));
          if (d.y < 0.0) col = horizonColor * 0.92;
          float s = max(dot(d, normalize(sunDir)), 0.0);
          col += sunColor * pow(s, 8.0) * 0.45 + sunColor * pow(s, 64.0) * 0.6;
          col = mix(col, vec3(1.0, 0.98, 0.9), smoothstep(0.9975, 0.9988, s));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), mat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    scene.add(this.dome);

    scene.fog = new THREE.Fog(0xf3c9a6, 140, 900);
    this.hemi = new THREE.HemisphereLight(0xbfdcff, 0xc9a27a, 1.1);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d0, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -90; sc.right = 90; sc.top = 90; sc.bottom = -90; sc.near = 1; sc.far = 500;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);
    this.buildHills();
    this.setDusk(this.dusk);
  }

  buildHills() {
    // Low-poly hills on the inland (west) horizon and behind the island.
    const rng = makeRng(404);
    const geo = new THREE.BufferGeometry();
    const pos = [], tops = [];
    for (let i = 0; i < 70; i++) {
      const a = Math.PI * 0.55 + (i / 70) * Math.PI * 0.9; // inland (west) arc only
      const r = 1150 + rng.range(-80, 80);
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      const w = rng.range(110, 220), h = rng.range(45, 130);
      const tx = -Math.sin(a), tz = Math.cos(a);
      pos.push(cx - tx * w, -2, cz - tz * w, cx, h, cz, cx + tx * w, -2, cz + tz * w);
      tops.push(0, 1, 0);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
    this.hillTops = tops;
    geo.computeVertexNormals();
    this.hillMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false });
    this.hills = new THREE.Mesh(geo, this.hillMat);
    this.scene.add(this.hills);
  }

  setDusk(d) {
    this.dusk = d;
    const mix = (k) => KEYS[k][0].clone().lerp(KEYS[k][1], d);
    this.uniforms.topColor.value.copy(mix('top'));
    this.uniforms.midColor.value.copy(mix('mid'));
    this.uniforms.horizonColor.value.copy(mix('horizon'));
    this.uniforms.sunColor.value.copy(mix('sun'));
    // sun over the sea (east), sinking as dusk advances
    const elev = lerp(0.42, 0.06, d);
    this.sunDir = new THREE.Vector3(Math.cos(elev) * 0.94, Math.sin(elev), -Math.cos(elev) * 0.34).normalize();
    this.uniforms.sunDir.value.copy(this.sunDir);
    this.scene.fog.color.copy(mix('fog'));
    this.sun.color.copy(mix('sun'));
    this.sun.intensity = lerp(2.8, 1.5, d);
    this.hemi.color.copy(mix('hemiSky'));
    this.hemi.groundColor.copy(mix('hemiGround'));
    this.hemi.intensity = lerp(1.15, 0.8, d);
    // hills fade from the haze at their feet to a soft silhouette at the peaks
    const base = mix('fog'), peak = mix('fog').lerp(new THREE.Color(d > 0.5 ? '#5b3a6e' : '#7f8fa0'), 0.45);
    const col = this.hills.geometry.attributes.color;
    for (let i = 0; i < this.hillTops.length; i++) { const c = this.hillTops[i] ? peak : base; col.setXYZ(i, c.r, c.g, c.b); }
    col.needsUpdate = true;
  }

  /** Keep the dome centred on the camera and the shadow box on the focus point. */
  follow(camera, focus) {
    this.dome.position.copy(camera.position);
    this.hills.position.set(camera.position.x * 0.9, 0, camera.position.z * 0.9);
    this.sun.position.set(focus.x + this.sunDir.x * 200, this.sunDir.y * 200 + 20, focus.z + this.sunDir.z * 200);
    this.sun.target.position.set(focus.x, 0, focus.z);
  }
}
