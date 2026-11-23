// Circular radar in the HUD corner: the painted city rotated with the camera, the GPS route,
// mission/POI blips clamped to the rim, flashing police dots, the helicopter's searchlight
// and the player's arrow; zooms out with speed.
import { mapCanvas, MAP, MAP_SCALE } from './mapart.js';

export class Minimap {
  constructor(canvas) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.zoom = 1.25; // px per metre
  }

  draw(state) {
    const { x, z, yaw, heading, speed = 0, blips = [], police = [], route = null, heli = null, t = 0 } = state;
    const g = this.g, W = this.c.width, H = this.c.height, R = W / 2;
    this.zoom += ((1.35 - Math.min(0.6, speed / 60)) - this.zoom) * 0.05;
    const k = this.zoom;
    const th = yaw - Math.PI, cs = Math.cos(th), sn = Math.sin(th);
    const toMini = (wx, wz) => {
      const dx = (wx - x) * k, dz = (wz - z) * k;
      return { x: R + dx * cs - dz * sn, y: R + dx * sn + dz * cs };
    };
    g.save();
    g.clearRect(0, 0, W, H);
    g.beginPath(); g.arc(R, R, R - 2, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#1c2230'; g.fillRect(0, 0, W, H);
    g.save();
    g.translate(R, R);
    g.rotate(th);
    const m = mapCanvas();
    const s = k / MAP_SCALE;
    g.drawImage(m, -(x - MAP.minX) * k, -(z - MAP.minZ) * k, m.width * s, m.height * s);
    g.restore();

    if (route && route.length > 1) {
      g.strokeStyle = '#ff4fd8'; g.lineWidth = 4; g.lineJoin = 'round';
      g.beginPath();
      route.forEach((p, i) => { const q = toMini(p.x, p.z); i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); });
      g.stroke();
    }
    if (heli) {
      const q = toMini(heli.x, heli.z);
      g.fillStyle = 'rgba(255,245,200,0.25)'; g.beginPath(); g.arc(q.x, q.y, 9, 0, 7); g.fill();
    }
    for (const p of police) {
      const q = toMini(p.x, p.z);
      const d = Math.hypot(q.x - R, q.y - R);
      if (d > R - 6) continue;
      g.fillStyle = Math.floor(t * 4 + (p.phase ?? 0)) % 2 ? '#ff2f4a' : '#2f6bff';
      g.beginPath(); g.arc(q.x, q.y, p.heli ? 6 : 4.5, 0, 7); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke();
    }
    g.restore();

    // blips clamp to rim
    for (const b of blips) {
      let q = toMini(b.x, b.z);
      const dx = q.x - R, dy = q.y - R, d = Math.hypot(dx, dy);
      const lim = R - 12;
      if (d > lim) { if (!b.edge) continue; q = { x: R + dx / d * lim, y: R + dy / d * lim }; }
      g.fillStyle = b.color; g.strokeStyle = '#111'; g.lineWidth = 2;
      g.beginPath(); g.arc(q.x, q.y, b.size ?? 8, 0, 7); g.fill(); g.stroke();
      if (b.icon) { g.fillStyle = '#111'; g.font = 'bold 10px Trebuchet MS, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(b.icon, q.x, q.y + 0.5); }
    }
    // player arrow
    g.save(); g.translate(R, R); g.rotate(yaw - heading);
    g.fillStyle = '#fff'; g.strokeStyle = '#111'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath(); g.fill(); g.stroke();
    g.restore();
    // north marker
    const north = { x: R + sn * (R - 12), y: R - cs * (R - 12) };
    g.fillStyle = '#111'; g.beginPath(); g.arc(north.x, north.y, 8, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 11px Trebuchet MS, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', north.x, north.y + 0.5);
    // rim
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 4; g.beginPath(); g.arc(R, R, R - 2, 0, Math.PI * 2); g.stroke();
  }
}
