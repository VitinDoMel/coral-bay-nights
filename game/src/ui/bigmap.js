// Full-screen map (M): pan with drag, zoom with the wheel. District names, numbered story
// missions (done ones ticked), activities and services, cash stashes, police, the GPS route,
// a legend and a progress panel. Labels are placed so none overlap another.
import { mapCanvas, MAP, MAP_SCALE } from './mapart.js';
import { DISTRICTS, BLOCKS, POI, ISLAND, BRIDGE, SEA_X, MARINA, PIER } from '../world/layout.js';
import { STORY } from '../missions/story-missions.js';
import { formatMoney } from '../core/mathx.js';

const LEGEND = [
  ['!', '#ffd23f', 'Story mission'], ['✓', '#8b93a3', 'Mission complete'], ['◆', '#ff4fd8', 'Objective / GPS'],
  ['A', POI.arms.color, 'Coral Arms'], ['M', POI.garage.color, 'Manta Motors (repair)'], ['N', POI.loft.color, "Nina's Loft (save)"],
  ['+', POI.hospital.color, 'Vista General'], ['P', POI.precinct.color, 'CVPD Precinct'], ['R', POI.race.color, 'Street race'],
  ['T', POI.cab.color, 'Vista Cab fares'], ['$', '#3ddc84', 'Cash stash'], ['●', '#ff2f4a', 'Police'],
];

export class BigMap {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('bigmap');
    this.canvas = document.getElementById('bigmap-canvas');
    this.side = document.getElementById('bigmap-side');
    this.view = { cx: 250, cz: -30, scale: 1.05 };
    this.drag = null;
    this.canvas.addEventListener('mousedown', (e) => { this.drag = { x: e.clientX, y: e.clientY, cx: this.view.cx, cz: this.view.cz }; });
    addEventListener('mouseup', () => { this.drag = null; });
    addEventListener('mousemove', (e) => {
      if (!this.drag || !this.isOpen) return;
      this.view.cx = this.drag.cx - (e.clientX - this.drag.x) / this.view.scale;
      this.view.cz = this.drag.cz - (e.clientY - this.drag.y) / this.view.scale;
    });
    this.canvas.addEventListener('wheel', (e) => { this.view.scale = Math.min(4, Math.max(0.5, this.view.scale * (e.deltaY > 0 ? 0.9 : 1.1))); }, { passive: true });
  }

  get isOpen() { return !this.root.classList.contains('hidden'); }

  open() {
    const g = this.game;
    this.root.classList.remove('hidden');
    g.input.unlock();
    const f = g.player.vehicle ? g.player.vehicle.pos : g.player.pos;
    this.view.cx = Math.max(-120, Math.min(420, f.x * 0.3 + 250 * 0.7));
    this.renderSide();
  }

  close() { this.root.classList.add('hidden'); }

  renderSide() {
    const g = this.game, p = g.progress;
    const next = STORY[p.story];
    this.side.innerHTML = `<h1>CORAL VISTA</h1>` +
      `<div class="legend">${LEGEND.map(([i, c, t]) => `<div><span style="background:${c}">${i}</span>${t}</div>`).join('')}</div>` +
      `<h3>PROGRESS</h3><div class="prog">` +
      `<div><span>Story</span><b>${p.story} / 5</b></div><div class="pbar"><i style="width:${p.story * 20}%"></i></div>` +
      `<div><span>Rank</span><b>${p.rankIndex + 1} · ${p.rank.name}</b></div>` +
      `<div><span>Respect</span><b>${p.respect} RP</b></div>` +
      `<div><span>Cash</span><b>${formatMoney(p.money)}</b></div>` +
      `<div><span>Stashes found</span><b>${p.stashes.size} / 12</b></div>` +
      `<div><span>Best sprint</span><b>${p.bestRace ? p.bestRace.toFixed(1) + ' s' : '—'}</b></div>` +
      `<div><span>Cab fares</span><b>${p.fares}</b></div>` +
      `<div><span>Next</span><b>${next ? `${next.id}. ${next.title}` : 'Free roam'}</b></div></div>` +
      `<p class="mhint">Drag to pan · Wheel to zoom · M to close</p>`;
  }

  draw() {
    const g = this.game, c = this.canvas;
    const W = c.clientWidth, H = c.clientHeight;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const x = c.getContext('2d');
    const v = { ...this.view, w: W, h: H };
    const P = (wx, wz) => ({ x: (wx - v.cx) * v.scale + W / 2, y: (wz - v.cz) * v.scale + H / 2 });
    x.fillStyle = '#151a24'; x.fillRect(0, 0, W, H);
    const m = mapCanvas();
    const o = P(MAP.minX, MAP.minZ);
    x.imageSmoothingEnabled = true;
    x.drawImage(m, o.x, o.y, m.width / MAP_SCALE * v.scale, m.height / MAP_SCALE * v.scale);

    const placed = [];
    const overlaps = (r) => placed.some((q) => r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y);
    const label = (text, px, py, { color = '#fff', bg = 'rgba(16,18,28,0.82)', size = 13, bold = false, anchor = 'right' } = {}) => {
      x.font = `${bold ? 'bold ' : ''}${size}px Trebuchet MS, sans-serif`;
      const w = x.measureText(text).width + 10, h = size + 7;
      const tries = anchor === 'center' ? [[-w / 2, -h / 2], [-w / 2, -h - 12], [-w / 2, 12]] : [[14, -h / 2], [-w - 14, -h / 2], [-w / 2, -h - 14], [-w / 2, 14], [14, -h - 6], [14, 6]];
      for (const [dx, dy] of tries) {
        const r = { x: px + dx, y: py + dy, w, h };
        if (overlaps(r) || r.x < 4 || r.x + w > W - 4 || r.y < 4 || r.y + h > H - 4) continue;
        placed.push(r);
        if (bg) { x.fillStyle = bg; x.beginPath(); x.roundRect(r.x, r.y, w, h, 4); x.fill(); }
        x.fillStyle = color; x.textBaseline = 'middle'; x.textAlign = 'left';
        if (!bg) { x.strokeStyle = 'rgba(0,0,0,0.7)'; x.lineWidth = 3; x.strokeText(text, r.x + 5, r.y + h / 2 + 1); }
        x.fillText(text, r.x + 5, r.y + h / 2 + 1);
        return true;
      }
      return false;
    };
    const icon = (px, py, ch, color, r = 11) => {
      x.fillStyle = color; x.strokeStyle = '#111'; x.lineWidth = 2;
      x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); x.stroke();
      x.fillStyle = '#111'; x.font = `bold ${r + 2}px Trebuchet MS, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(ch, px, py + 1);
      placed.push({ x: px - r, y: py - r, w: r * 2, h: r * 2 });
    };

    // GPS route
    const route = g.missions.route;
    if (route) {
      x.strokeStyle = '#ff4fd8'; x.lineWidth = 4; x.setLineDash([10, 7]);
      x.beginPath(); route.forEach((pt, i) => { const q = P(pt.x, pt.z); i ? x.lineTo(q.x, q.y) : x.moveTo(q.x, q.y); }); x.stroke();
      x.setLineDash([]);
    }
    // icons first (they reserve their space), then labels
    const icons = [];
    const prog = g.progress.story;
    for (const def of STORY) {
      const done = def.id <= prog;
      const q = P(def.start.x + (def.id - 3) * 0.01, def.start.z);
      icons.push({ q, ch: done ? '✓' : String(def.id), color: done ? '#8b93a3' : '#ffd23f', text: `${def.id} · ${def.title}`, tcolor: done ? '#aab' : '#ffd23f', offset: def.id });
    }
    for (const k of ['arms', 'garage', 'loft', 'hospital', 'precinct', 'race', 'cab']) {
      const q = P(POI[k].x, POI[k].z);
      icons.push({ q, ch: POI[k].icon, color: POI[k].color, text: POI[k].name, tcolor: POI[k].color });
    }
    // story starts share locations: fan them out
    const seen = new Map();
    for (const it of icons) {
      const key = `${Math.round(it.q.x / 8)}|${Math.round(it.q.y / 8)}`;
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      it.q = { x: it.q.x + n * 26, y: it.q.y + n * 0 };
    }
    // finale destination and harbour landmarks
    const yq = P(MARINA.yacht.x, MARINA.yacht.z);
    icons.push({ q: yq, ch: '⚓', color: '#35d0ba', text: "Don Marlon's yacht · finale", tcolor: '#35d0ba' });
    const pq0 = P((PIER.minX + PIER.maxX) / 2, PIER.maxZ - 6);
    icons.push({ q: pq0, ch: '⚓', color: '#c9c2b4', text: 'Coquina Pier', tcolor: '#ddd' });
    for (const s of g.missions.activities.stashBlips()) { const q = P(s.x, s.z); icon(q.x, q.y, '$', '#3ddc84', 7); }
    for (const it of icons) icon(it.q.x, it.q.y, it.ch, it.color);
    const t = g.missions.target();
    if (t) { const q = P(t.x, t.z); icon(q.x, q.y, '◆', '#ff4fd8', 12); label('Objective', q.x, q.y, { color: '#ff4fd8' }); }
    for (const u of g.police.units) { const q = P(u.v.pos.x, u.v.pos.z); x.fillStyle = '#ff2f4a'; x.beginPath(); x.arc(q.x, q.y, 5, 0, 7); x.fill(); }
    // player arrow
    const pl = g.player.vehicle ? g.player.vehicle : g.player;
    const pq = P(pl.pos.x, pl.pos.z);
    x.save(); x.translate(pq.x, pq.y); x.rotate(Math.PI - pl.heading);
    x.fillStyle = '#fff'; x.strokeStyle = '#111'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, -13); x.lineTo(9, 10); x.lineTo(0, 5); x.lineTo(-9, 10); x.closePath(); x.fill(); x.stroke();
    x.restore();
    placed.push({ x: pq.x - 12, y: pq.y - 12, w: 24, h: 24 });
    for (const it of icons) label(it.text, it.q.x, it.q.y, { color: it.tcolor });
    // district names
    const dist = new Map();
    for (const b of BLOCKS) { const d = dist.get(b.district) ?? { x: 0, z: 0, n: 0 }; d.x += (b.minX + b.maxX) / 2; d.z += (b.minZ + b.maxZ) / 2; d.n++; dist.set(b.district, d); }
    for (const [k, d] of dist) { const q = P(d.x / d.n, d.z / d.n); label(DISTRICTS[k].name.toUpperCase(), q.x, q.y, { bg: null, size: 15, bold: true, anchor: 'center', color: '#e9e6f5' }); }
    let q = P((ISLAND.minX + ISLAND.maxX) / 2, ISLAND.minZ + 40); label('HERON KEY', q.x, q.y, { bg: null, size: 16, bold: true, anchor: 'center' });
    q = P((MARINA.x0 + MARINA.x1) / 2, MARINA.z + MARINA.len + 10); label('HERON KEY MARINA', q.x, q.y, { bg: null, size: 12, bold: true, anchor: 'center', color: '#e6fffb' });
    q = P((SEA_X + BRIDGE.x1) / 2, BRIDGE.z - 22); label('HERON BRIDGE', q.x, q.y, { bg: null, size: 14, bold: true, anchor: 'center' });
    q = P(SEA_X + 140, 60); label('CORAL BAY', q.x, q.y, { bg: null, size: 18, bold: true, anchor: 'center', color: '#dffcff' });
    q = P(271, 40); x.save(); x.translate(q.x, q.y); x.rotate(-Math.PI / 2);
    x.font = 'bold 12px Trebuchet MS, sans-serif'; x.textAlign = 'center'; x.fillStyle = '#6b5326'; x.fillText('SEABREEZE BEACH', 0, 4); x.restore();
  }

  update() {
    if (this.isOpen) this.draw();
  }
}
