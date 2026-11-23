// Canvas-painted textures: building facades (with a matching lit-window emissive map),
// asphalt, sand, grass and the shop/neon signs. Nothing is loaded from disk.
import * as THREE from 'three';
import { makeRng } from '../core/rng.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function toTexture(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function speckle(ctx, w, h, rng, alpha, count) {
  for (let i = 0; i < count; i++) {
    const v = rng.next() < 0.5 ? 0 : 255;
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * rng.next()})`;
    ctx.fillRect(rng.next() * w, rng.next() * h, 2, 2);
  }
}

// One facade tile = 4 windows across (16 m) x 4 floors (14 m).
export const FACADE_TILE = { w: 16, h: 14 };

/**
 * Facade styles: 'glass' curtain-wall towers, 'stucco' pastel walls with framed windows and
 * balconies, 'house' small residential walls. Returns { map, emissive }.
 */
export function facadeTextures(style, wall, seed) {
  const rng = makeRng(seed);
  const S = 256;
  const c = canvas(S, S), e = canvas(S, S);
  const g = c.getContext('2d'), ge = e.getContext('2d');
  ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
  g.fillStyle = wall; g.fillRect(0, 0, S, S);
  speckle(g, S, S, rng, 0.06, 900);
  const cols = 4, rows = 4, cw = S / cols, rh = S / rows;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      const x = k * cw, y = r * rh;
      const lit = rng.next() < 0.42;
      const warm = ['#ffd98a', '#ffe7b0', '#ffc86b', '#bfe8ff'][Math.floor(rng.next() * 4)];
      if (style === 'glass') {
        const grad = g.createLinearGradient(x, y, x + cw, y + rh);
        grad.addColorStop(0, '#9fd2e8'); grad.addColorStop(0.5, '#4f86a8'); grad.addColorStop(1, '#2c5577');
        g.fillStyle = grad; g.fillRect(x + 2, y + 6, cw - 4, rh - 8);
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 4, y + 8, 6, rh - 14);
        g.fillStyle = wall; g.fillRect(x, y, cw, 6); // floor slab band
        if (lit) { ge.fillStyle = warm; ge.fillRect(x + 4, y + 8, cw - 8, rh - 12); }
      } else if (style === 'stucco') {
        const wx = x + cw * 0.2, wy = y + rh * 0.22, ww = cw * 0.6, wh = rh * 0.55;
        g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
        const grad = g.createLinearGradient(wx, wy, wx, wy + wh);
        grad.addColorStop(0, '#7fb3cf'); grad.addColorStop(1, '#2f5068');
        g.fillStyle = grad; g.fillRect(wx, wy, ww, wh);
        g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(wx + ww / 2 - 1, wy, 2, wh);
        if (r % 2 === 1) { // balcony rail
          g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(wx - 6, wy + wh - 4, ww + 12, 4);
          for (let b = 0; b < 7; b++) g.fillRect(wx - 6 + b * ((ww + 12) / 6), wy + wh - 12, 2, 10);
        }
        if (lit) { ge.fillStyle = warm; ge.fillRect(wx, wy, ww, wh); }
      } else {
        const wx = x + cw * 0.25, wy = y + rh * 0.3, ww = cw * 0.5, wh = rh * 0.42;
        g.fillStyle = '#f4efe6'; g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
        g.fillStyle = '#3c5c74'; g.fillRect(wx, wy, ww, wh);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(wx - 5, wy + wh + 3, ww + 10, 3);
        if (lit) { ge.fillStyle = warm; ge.fillRect(wx, wy, ww, wh); }
      }
    }
  }
  // gentle vertical grime toward the bottom of each tile
  const grime = g.createLinearGradient(0, 0, 0, S);
  grime.addColorStop(0, 'rgba(0,0,0,0)'); grime.addColorStop(1, 'rgba(60,30,20,0.08)');
  g.fillStyle = grime; g.fillRect(0, 0, S, S);
  return { map: toTexture(c), emissive: toTexture(e) };
}

export function asphaltTexture() {
  const rng = makeRng(77);
  const c = canvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#585a62'; g.fillRect(0, 0, 256, 256);
  speckle(g, 256, 256, rng, 0.07, 4000);
  for (let i = 0; i < 6; i++) { // tar seams
    g.strokeStyle = 'rgba(20,20,24,0.35)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(rng.next() * 256, 0);
    for (let y = 0; y <= 256; y += 32) g.lineTo(rng.next() * 256, y);
    g.stroke();
  }
  return toTexture(c);
}

export function concreteTexture(base = '#d9d2c4', seed = 5) {
  const rng = makeRng(seed);
  const c = canvas(128, 128), g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  speckle(g, 128, 128, rng, 0.12, 1400);
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1;
  for (let i = 0; i <= 128; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
  return toTexture(c);
}

export function sandTexture() {
  const rng = makeRng(9);
  const c = canvas(128, 128), g = c.getContext('2d');
  g.fillStyle = '#f0d9a8'; g.fillRect(0, 0, 128, 128);
  speckle(g, 128, 128, rng, 0.2, 2500);
  return toTexture(c);
}

export function grassTexture() {
  const rng = makeRng(13);
  const c = canvas(128, 128), g = c.getContext('2d');
  g.fillStyle = '#6fae55'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1800; i++) {
    g.fillStyle = rng.next() < 0.5 ? 'rgba(40,90,40,0.35)' : 'rgba(170,220,120,0.3)';
    g.fillRect(rng.next() * 128, rng.next() * 128, 1, 3);
  }
  return toTexture(c);
}

/** A storefront / rooftop sign: text on a dark plate, used with emissive glow. */
export function signTexture(text, color, bg = '#1a1024') {
  const c = canvas(512, 128), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = color; g.lineWidth = 6; g.strokeRect(8, 8, 496, 112);
  g.font = 'bold 64px "Trebuchet MS", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 18;
  g.fillStyle = color; g.fillText(text, 256, 68);
  g.fillStyle = '#fff'; g.shadowBlur = 0; g.globalAlpha = 0.6; g.fillText(text, 256, 68);
  return toTexture(c, false);
}
