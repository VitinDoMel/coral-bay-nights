// GPU point particles in two pools (additive glow: fire, sparks, muzzle flashes, explosion
// cores; soft alpha: smoke, dust, sand) plus bullet tracers and short-lived flash lights.
import * as THREE from 'three';
import { rand, range } from '../core/rng.js';

const VERT = `
  attribute float size; attribute float alpha; attribute vec3 tint;
  varying float vAlpha; varying vec3 vTint;
  uniform float scale;
  void main(){
    vAlpha = alpha; vTint = tint;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * scale / max(0.5, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG = `
  varying float vAlpha; varying vec3 vTint;
  void main(){
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vTint, a * vAlpha);
  }`;

class Pool {
  constructor(scene, max, additive) {
    this.max = max;
    this.n = 0;
    this.p = [];
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.tint = new Float32Array(max * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('tint', new THREE.BufferAttribute(this.tint, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 400 } }, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 5 : 4;
    scene.add(this.points);
  }

  spawn(o) {
    if (this.p.length >= this.max) this.p.shift();
    this.p.push(o);
  }

  update(dt) {
    const keep = [];
    for (const q of this.p) {
      q.age += dt;
      if (q.age >= q.life) continue;
      q.vy -= q.grav * dt;
      const drag = Math.exp(-q.drag * dt);
      q.vx *= drag; q.vy *= drag; q.vz *= drag;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.y < 0.05) { q.y = 0.05; q.vy = Math.abs(q.vy) * 0.3; }
      keep.push(q);
    }
    this.p = keep;
    let i = 0;
    for (const q of this.p) {
      const t = q.age / q.life;
      this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z;
      this.size[i] = q.s0 + (q.s1 - q.s0) * t;
      this.alpha[i] = q.a * (t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9);
      const c = q.c0.clone().lerp(q.c1, t);
      this.tint[i * 3] = c.r; this.tint[i * 3 + 1] = c.g; this.tint[i * 3 + 2] = c.b;
      i++;
    }
    this.geo.setDrawRange(0, i);
    for (const k of ['position', 'size', 'alpha', 'tint']) this.geo.attributes[k].needsUpdate = true;
  }
}

const C = (h) => new THREE.Color(h);
const FIRE0 = C('#fff3a0'), FIRE1 = C('#ff3a10'), SMOKE_D = C('#2b2b30'), SMOKE_L = C('#9a958f'), SPARK = C('#ffd27a');

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.glow = new Pool(scene, 2500, true);
    this.soft = new Pool(scene, 2500, false);
    this.tracers = [];
    const tg = new THREE.BufferGeometry();
    this.tracerPos = new Float32Array(200 * 6);
    this.tracerCol = new Float32Array(200 * 6);
    tg.setAttribute('position', new THREE.BufferAttribute(this.tracerPos, 3).setUsage(THREE.DynamicDrawUsage));
    tg.setAttribute('color', new THREE.BufferAttribute(this.tracerCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.tracerLines = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.tracerLines.frustumCulled = false;
    scene.add(this.tracerLines);
    this.lights = [];
    for (let i = 0; i < 3; i++) { // recycled flash lights
      const l = new THREE.PointLight('#ffb050', 0, 30, 2);
      scene.add(l);
      this.lights.push({ l, t: 0, dur: 0.1, peak: 0 });
    }
  }

  setViewport(h) { this.glow.mat.uniforms.scale.value = this.soft.mat.uniforms.scale.value = h * 0.9; }

  part(pool, x, y, z, o) {
    pool.spawn({ x, y, z, vx: o.vx ?? 0, vy: o.vy ?? 0, vz: o.vz ?? 0, grav: o.grav ?? 0, drag: o.drag ?? 0.5, life: o.life, age: 0, s0: o.s0, s1: o.s1 ?? o.s0, a: o.a ?? 1, c0: o.c0, c1: o.c1 ?? o.c0 });
  }

  flash(x, y, z, color, peak, dur) {
    const f = this.lights.reduce((a, b) => (a.t <= 0 ? a : b.t < a.t ? b : a));
    f.l.position.set(x, y, z); f.l.color.set(color); f.t = dur; f.dur = dur; f.peak = peak;
  }

  muzzle(x, y, z, dx, dz) {
    this.part(this.glow, x, y, z, { life: 0.07, s0: 1.4, s1: 0.4, c0: FIRE0, c1: C('#ff9a30') });
    for (let i = 0; i < 3; i++) this.part(this.glow, x, y, z, { vx: dx * 8 + range(-2, 2), vy: range(-1, 2), vz: dz * 8 + range(-2, 2), life: 0.12, s0: 0.35, s1: 0.1, c0: SPARK });
    this.part(this.soft, x, y, z, { vx: dx * 2, vy: 0.8, vz: dz * 2, life: 0.6, s0: 0.4, s1: 1.4, a: 0.35, c0: SMOKE_L });
    this.flash(x, y, z, '#ffc070', 6, 0.06);
  }

  tracer(ax, ay, az, bx, by, bz, color = '#ffe08a') {
    if (this.tracers.length >= 200) this.tracers.shift();
    this.tracers.push({ a: [ax, ay, az], b: [bx, by, bz], c: C(color), t: 0.09 });
  }

  sparks(x, y, z, n = 8) {
    for (let i = 0; i < n; i++) this.part(this.glow, x, y, z, { vx: range(-5, 5), vy: range(1, 6), vz: range(-5, 5), grav: 14, drag: 0.4, life: range(0.2, 0.5), s0: 0.22, s1: 0.05, c0: SPARK, c1: C('#ff6a00') });
  }

  dust(x, y, z, n = 4, color = '#d8c7a8') {
    for (let i = 0; i < n; i++) this.part(this.soft, x + range(-0.4, 0.4), y, z + range(-0.4, 0.4), { vx: range(-1, 1), vy: range(0.3, 1.2), vz: range(-1, 1), life: range(0.6, 1.1), s0: 0.6, s1: 2.2, a: 0.35, c0: C(color) });
  }

  blood(x, y, z) {
    for (let i = 0; i < 6; i++) this.part(this.soft, x, y, z, { vx: range(-2, 2), vy: range(0, 3), vz: range(-2, 2), grav: 12, life: 0.4, s0: 0.25, s1: 0.1, a: 0.9, c0: C('#a3121f') });
  }

  smoke(x, y, z, dark = 0.5, scale = 1) {
    const c = SMOKE_L.clone().lerp(SMOKE_D, dark);
    this.part(this.soft, x + range(-0.3, 0.3), y, z + range(-0.3, 0.3), { vx: range(-0.4, 0.4), vy: range(1.2, 2.4), vz: range(-0.4, 0.4), drag: 0.3, life: range(1.4, 2.4), s0: 0.8 * scale, s1: 3.4 * scale, a: 0.55, c0: c, c1: SMOKE_L });
  }

  fire(x, y, z, scale = 1) {
    this.part(this.glow, x + range(-0.4, 0.4) * scale, y, z + range(-0.4, 0.4) * scale, { vx: range(-0.3, 0.3), vy: range(1.5, 3) * scale, vz: range(-0.3, 0.3), life: range(0.35, 0.7), s0: 1.3 * scale, s1: 0.3, c0: FIRE0, c1: FIRE1 });
    if (rand() < 0.4) this.smoke(x, y + 1.5 * scale, z, 0.9, scale);
  }

  explosion(x, y, z, scale = 1) {
    for (let i = 0; i < 46; i++) {
      const a = rand() * Math.PI * 2, e = rand() * Math.PI / 2, sp = range(4, 13) * scale;
      this.part(this.glow, x, y + 0.6, z, { vx: Math.cos(a) * Math.cos(e) * sp, vy: Math.sin(e) * sp, vz: Math.sin(a) * Math.cos(e) * sp, drag: 2.6, life: range(0.5, 1.0), s0: range(2.5, 4.5) * scale, s1: 0.8, c0: FIRE0, c1: FIRE1 });
    }
    for (let i = 0; i < 30; i++) {
      const a = rand() * Math.PI * 2, sp = range(1, 6) * scale;
      this.part(this.soft, x, y + 1, z, { vx: Math.cos(a) * sp, vy: range(2, 7), vz: Math.sin(a) * sp, drag: 1.2, life: range(2, 3.5), s0: 2.5 * scale, s1: 7 * scale, a: 0.7, c0: SMOKE_D, c1: SMOKE_L });
    }
    this.sparks(x, y + 1, z, 30);
    this.flash(x, y + 2, z, '#ff9a40', 60, 0.5);
  }

  update(dt) {
    this.glow.update(dt);
    this.soft.update(dt);
    let i = 0;
    this.tracers = this.tracers.filter((t) => (t.t -= dt) > 0);
    for (const t of this.tracers) {
      this.tracerPos.set(t.a, i * 6); this.tracerPos.set(t.b, i * 6 + 3);
      const k = Math.min(1, t.t / 0.06);
      this.tracerCol.set([t.c.r * k * 0.4, t.c.g * k * 0.4, t.c.b * k * 0.4, t.c.r * k, t.c.g * k, t.c.b * k], i * 6);
      i++;
    }
    this.tracerLines.geometry.setDrawRange(0, i * 2);
    this.tracerLines.geometry.attributes.position.needsUpdate = true;
    this.tracerLines.geometry.attributes.color.needsUpdate = true;
    for (const f of this.lights) {
      if (f.t > 0) { f.t -= dt; f.l.intensity = f.peak * Math.max(0, f.t / f.dur); } else f.l.intensity = 0;
    }
  }
}
