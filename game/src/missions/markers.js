// World markers: glowing translucent columns with a bobbing icon (mission numbers, shop,
// garage, cab depot, race start), checkpoint rings and spinning cash pickups.
import * as THREE from 'three';

const iconCache = new Map();
function iconTexture(text, color) {
  const k = text + color;
  if (iconCache.has(k)) return iconCache.get(k);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = color; g.beginPath(); g.arc(64, 64, 54, 0, 7); g.fill();
  g.lineWidth = 8; g.strokeStyle = '#111'; g.stroke();
  g.fillStyle = '#111'; g.font = 'bold 64px Trebuchet MS, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 64, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  iconCache.set(k, t);
  return t;
}

const columnGeo = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true);
columnGeo.translate(0, 0.5, 0);
// fade out toward the top using vertex colours
{
  const pos = columnGeo.attributes.position, col = [];
  for (let i = 0; i < pos.count; i++) { const a = 1 - pos.getY(i); col.push(a, a, a); }
  columnGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
}

export class Marker {
  constructor(scene, x, z, { color = '#ffd23f', icon = null, radius = 2.2, height = 5 } = {}) {
    this.scene = scene;
    this.x = x; this.z = z; this.radius = radius;
    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, vertexColors: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    this.column = new THREE.Mesh(columnGeo, mat);
    this.column.scale.set(radius, height, radius);
    this.column.renderOrder = 3;
    this.group.add(this.column);
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.86, radius, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.07;
    this.group.add(ring);
    if (icon) {
      this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(icon, color), depthWrite: false }));
      this.sprite.scale.set(1.8, 1.8, 1);
      this.sprite.position.y = height * 0.6 + 1;
      this.group.add(this.sprite);
    }
    scene.add(this.group);
  }

  inside(x, z, extra = 0) { return Math.hypot(x - this.x, z - this.z) < this.radius + extra; }

  update(t) {
    if (this.sprite) this.sprite.position.y = 4 + Math.sin(t * 2.5) * 0.3;
    this.column.material.opacity = 0.35 + Math.sin(t * 3) * 0.1;
  }

  dispose() { this.scene.remove(this.group); }
}

const cashGeo = new THREE.BoxGeometry(0.9, 0.45, 0.45);
const cashMat = new THREE.MeshStandardMaterial({ color: '#3ddc84', emissive: '#1a7a40', emissiveIntensity: 0.6 });

export class CashPickup {
  constructor(scene, x, z, id) {
    this.scene = scene; this.x = x; this.z = z; this.id = id;
    this.mesh = new THREE.Mesh(cashGeo, cashMat);
    this.mesh.position.set(x, 1, z);
    this.mesh.castShadow = true;
    scene.add(this.mesh);
  }
  update(t) { this.mesh.rotation.y = t * 2; this.mesh.position.y = 1 + Math.sin(t * 3 + this.id) * 0.2; }
  dispose() { this.scene.remove(this.mesh); }
}
