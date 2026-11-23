// Heron Key marina and the boats of Coral Bay: wooden finger piers, Don Marlon's yacht
// (the last mission's destination), speedboats and sailboats bobbing on the swell.
import * as THREE from 'three';
import { MARINA, BOATS } from './layout.js';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
const WOOD = mat('#a8794f');
const HULL = mat('#f5f3ee');
const NAVY = mat('#1d3557');
const TEAL = mat('#2ec4b6');
const GLASS = new THREE.MeshStandardMaterial({ color: '#2a4a66', roughness: 0.1, metalness: 0.6 });

function box(g, w, h, d, m, x, y, z) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z);
  b.castShadow = true;
  g.add(b);
  return b;
}

function speedboat(color) {
  const g = new THREE.Group();
  box(g, 2.4, 0.9, 6.5, HULL, 0, 0.2, 0);
  box(g, 2.0, 0.6, 1.6, HULL, 0, 0.1, 3.6).rotation.x = 0.3;
  box(g, 2.45, 0.25, 6.55, mat(color), 0, -0.1, 0);
  box(g, 1.8, 0.6, 1.2, GLASS, 0, 0.9, 0.8);
  return g;
}

function sailboat(color) {
  const g = new THREE.Group();
  box(g, 2.2, 0.9, 7, HULL, 0, 0.2, 0);
  box(g, 2.25, 0.2, 7.05, mat(color), 0, 0.55, 0);
  box(g, 0.15, 9, 0.15, mat('#dddddd'), 0, 5, 0.4);
  const sail = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1, 0.5), new THREE.Vector3(0, 9.3, 0.5), new THREE.Vector3(0, 1, -2.8)]), new THREE.MeshStandardMaterial({ color: '#fffaf0', side: THREE.DoubleSide }));
  sail.geometry.computeVertexNormals();
  g.add(sail);
  return g;
}

function yacht() {
  const g = new THREE.Group();
  box(g, 5, 1.8, 18, HULL, 0, 0.5, 0);
  box(g, 5.05, 0.35, 18.05, NAVY, 0, -0.2, 0);
  box(g, 4.2, 1.6, 9, HULL, 0, 2.2, -1.5);
  box(g, 4.25, 0.7, 9.05, GLASS, 0, 2.3, -1.5);
  box(g, 3.4, 1.2, 5, HULL, 0, 3.6, -2.5);
  box(g, 3.45, 0.5, 5.05, GLASS, 0, 3.7, -2.5);
  box(g, 0.2, 2.5, 0.2, mat('#cccccc'), 0, 5.3, -3);
  box(g, 5.1, 0.3, 0.3, TEAL, 0, 1.2, 8.5); // bow stripe
  return g;
}

export class Marina {
  constructor(scene) {
    this.group = new THREE.Group();
    this.boats = [];
    const m = MARINA;
    // main boardwalk along the shore and finger piers out over the water
    box(this.group, m.x1 - m.x0, 0.4, 4, WOOD, (m.x0 + m.x1) / 2, -0.2, m.z + 2);
    for (let x = m.x0 + 8; x < m.x1; x += 22) {
      box(this.group, 2.5, 0.35, m.len, WOOD, x, -0.25, m.z + m.len / 2 + 2);
      for (let z = m.z + 8; z < m.z + m.len; z += 10) box(this.group, 0.4, 1.6, 0.4, WOOD, x + 1.3, -0.6, z);
    }
    const y = yacht();
    y.position.set(m.yacht.x, -0.4, m.yacht.z + 4);
    y.rotation.y = 0.05;
    this.group.add(y);
    this.boats.push({ obj: y, base: -0.4, phase: 0 });
    const colors = ['#ff6f91', '#2ec4b6', '#ffbe0b', '#3a86ff', '#fb5607'];
    BOATS.forEach(([x, z, h, kind], i) => {
      const b = kind === 'sail' ? sailboat(colors[i % 5]) : speedboat(colors[(i + 2) % 5]);
      b.position.set(x, -0.5, z);
      b.rotation.y = h;
      this.group.add(b);
      this.boats.push({ obj: b, base: -0.5, phase: i * 1.7 });
    });
    scene.add(this.group);
  }

  update(t) {
    for (const b of this.boats) {
      b.obj.position.y = b.base + Math.sin(t * 1.1 + b.phase) * 0.15;
      b.obj.rotation.z = Math.sin(t * 0.9 + b.phase) * 0.04;
    }
  }
}
