// Tyre marks: a ring buffer of dark translucent quads laid on the asphalt wherever a wheel
// slides (drifts, handbrake turns, hard braking). Each wheel keeps its last point so the
// marks join into continuous strips.
import * as THREE from 'three';

const MAX = 3000;

export class SkidMarks {
  constructor(scene) {
    this.pos = new Float32Array(MAX * 4 * 3);
    this.alpha = new Float32Array(MAX * 4);
    const idx = [];
    for (let i = 0; i < MAX; i++) idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4,
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(0.05,0.05,0.06, vA); }',
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
    this.head = 0;
    this.count = 0;
    this.last = new Map();
  }

  /** key identifies the wheel; (x,z) its contact point; strength 0..1 */
  mark(key, x, z, strength = 0.7, width = 0.28) {
    const prev = this.last.get(key);
    this.last.set(key, { x, z, t: 0 });
    if (!prev || Math.hypot(x - prev.x, z - prev.z) > 3) return;
    const dx = x - prev.x, dz = z - prev.z, len = Math.hypot(dx, dz);
    if (len < 0.25) { this.last.set(key, prev); return; }
    const px = -dz / len * width, pz = dx / len * width;
    const i = this.head;
    const y = 0.03;
    this.pos.set([prev.x - px, y, prev.z - pz, prev.x + px, y, prev.z + pz, x + px, y, z + pz, x - px, y, z - pz], i * 12);
    this.alpha.set([strength * 0.55, strength * 0.55, strength * 0.55, strength * 0.55], i * 4);
    this.head = (this.head + 1) % MAX;
    this.count = Math.min(MAX, this.count + 1);
    this.geo.setDrawRange(0, this.count * 6);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;
  }

  /** Break the strip for a wheel that stopped sliding. */
  lift(key) { this.last.delete(key); }
}
