// The sea: turquoise shallows along the beach, the pier and Heron Key, deepening to navy
// offshore, with animated wave shading, sun glints and a foam line at the shore.
import * as THREE from 'three';
import { SEA_X, ISLAND, PIER } from './layout.js';

export class Sea {
  constructor(scene) {
    this.uniforms = {
      time: { value: 0 },
      sunDir: { value: new THREE.Vector3(1, 0.3, 0) },
      sunColor: { value: new THREE.Color('#fff0d0') },
      skyColor: { value: new THREE.Color('#8cc3ec') },
      fogColor: { value: new THREE.Color('#f3c9a6') },
      fogNear: { value: 140 },
      fogFar: { value: 900 },
      dusk: { value: 0 },
      island: { value: new THREE.Vector4(ISLAND.minX, ISLAND.minZ, ISLAND.maxX, ISLAND.maxZ) },
      pier: { value: new THREE.Vector4(PIER.minX, PIER.minZ, PIER.maxX, PIER.maxZ) },
      shoreX: { value: SEA_X - 7 }, // where the sloped sand actually meets the water
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: false,
      vertexShader: `
        varying vec3 vWorld; varying float vDepth;
        void main(){
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          vec4 mv = viewMatrix * w;
          vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float time; uniform vec3 sunDir; uniform vec3 sunColor; uniform vec3 skyColor;
        uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; uniform float dusk;
        uniform vec4 island; uniform vec4 pier; uniform float shoreX;
        varying vec3 vWorld; varying float vDepth;
        float boxDist(vec2 p, vec4 b){ vec2 c = (b.xy + b.zw) * 0.5; vec2 h = (b.zw - b.xy) * 0.5; vec2 q = abs(p - c) - h; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); }
        void main(){
          vec2 p = vWorld.xz;
          float d = min(p.x - shoreX, min(boxDist(p, island), boxDist(p, pier)));
          d = max(d, 0.0);
          // wave normal from a few travelling sines
          float t = time;
          vec3 n = normalize(vec3(
            sin(p.x * 0.11 + t * 1.3) * 0.12 + sin(p.y * 0.23 + p.x * 0.05 + t * 1.9) * 0.08 + sin((p.x + p.y) * 0.6 + t * 3.1) * 0.03,
            1.0,
            cos(p.y * 0.09 + t * 1.1) * 0.12 + cos(p.x * 0.19 - p.y * 0.07 + t * 2.3) * 0.08 + cos((p.x - p.y) * 0.55 + t * 2.7) * 0.03));
          vec3 shallow = mix(vec3(0.20, 0.86, 0.82), vec3(0.25, 0.62, 0.72), dusk);
          vec3 mid = mix(vec3(0.05, 0.55, 0.70), vec3(0.15, 0.32, 0.55), dusk);
          vec3 deep = mix(vec3(0.03, 0.27, 0.52), vec3(0.08, 0.12, 0.33), dusk);
          vec3 col = mix(shallow, mid, smoothstep(4.0, 60.0, d));
          col = mix(col, deep, smoothstep(60.0, 260.0, d));
          vec3 viewDir = normalize(cameraPosition - vWorld);
          float fres = pow(1.0 - max(dot(viewDir, n), 0.0), 4.0);
          col = mix(col, skyColor, fres * 0.35);
          vec3 h = normalize(viewDir + normalize(sunDir));
          float spec = pow(max(dot(n, h), 0.0), 180.0);
          col += sunColor * spec * 2.2;
          float foam = smoothstep(2.2, 0.0, d + sin(p.y * 0.3 + t * 2.0) * 0.6);
          col = mix(col, vec3(1.0), foam * 0.6);
          float f = smoothstep(fogNear, fogFar * 2.0, vDepth) * 0.6;
          gl_FragColor = vec4(mix(col, fogColor, f), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const geo = new THREE.PlaneGeometry(5000, 5000);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(SEA_X + 2300, -0.9, 0);
    scene.add(this.mesh);
  }

  update(dt, sky, scene) {
    this.uniforms.time.value += dt;
    this.uniforms.sunDir.value.copy(sky.sunDir);
    this.uniforms.sunColor.value.copy(sky.uniforms.sunColor.value);
    this.uniforms.skyColor.value.copy(sky.uniforms.midColor.value);
    this.uniforms.fogColor.value.copy(scene.fog.color);
    this.uniforms.fogNear.value = scene.fog.near;
    this.uniforms.fogFar.value = scene.fog.far;
    this.uniforms.dusk.value = sky.dusk;
  }
}
