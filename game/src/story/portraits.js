// Illustrated character portraits drawn on canvas (flat-shaded, original designs): Rafa Sol,
// Nina Vega, Don Marlon of Los Manta, the crew (Teo, Mags, Pip) and a CVPD sergeant.

export const CAST = {
  rafa: { name: 'Rafa Sol', role: 'Ex-getaway driver · You', bg: ['#ff8a5c', '#ffcf6b'], skin: '#c98d66', hair: '#1d1410', hairStyle: 'short', shirt: '#ff7a59', shades: true },
  nina: { name: 'Nina Vega', role: 'Hacker · Your inside line', bg: ['#6a5cff', '#2ef2ff'], skin: '#e0a98a', hair: '#7b2cbf', hairStyle: 'bob', shirt: '#1f1b3a', headset: true },
  marlon: { name: 'Don Marlon', role: 'Los Manta · The man you owe', bg: ['#1b4f4a', '#35d0ba'], skin: '#a86d4b', hair: '#d9d4cc', hairStyle: 'slick', shirt: '#f5f2ea', chain: true, beard: true },
  teo: { name: 'Teo', role: 'Driver', bg: ['#ff6f91', '#ffbe0b'], skin: '#8d5a3b', hair: '#111', hairStyle: 'short', shirt: '#2ec4b6', shades: true },
  mags: { name: 'Mags', role: 'Mechanic', bg: ['#fb5607', '#ffd166'], skin: '#f1c7a5', hair: '#b5462a', hairStyle: 'bun', shirt: '#3a86ff', goggles: true },
  pip: { name: 'Pip', role: 'Lookout', bg: ['#3a0ca3', '#7209b7'], skin: '#5e3b26', hair: '#111', hairStyle: 'short', shirt: '#90be6d', cap: '#ffbe0b' },
  sarge: { name: 'Sgt. Okafor', role: 'CVPD · Dispatch', bg: ['#0b2545', '#4f8dff'], skin: '#6b4430', hair: '#111', hairStyle: 'short', shirt: '#1f2b4d', cap: '#141a2a', badge: true },
};

const cache = new Map();

/** Returns a canvas with the portrait of `who` at size px. */
export function portrait(who, size = 96) {
  const key = who + size;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const p = CAST[who] ?? CAST.rafa;
  const s = size / 100;
  g.scale(s, s);
  // background with sun rays
  const bg = g.createLinearGradient(0, 0, 100, 100);
  bg.addColorStop(0, p.bg[0]); bg.addColorStop(1, p.bg[1]);
  g.fillStyle = bg; g.fillRect(0, 0, 100, 100);
  g.save(); g.translate(50, 62); g.fillStyle = 'rgba(255,255,255,0.12)';
  for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.beginPath(); g.moveTo(0, 0); g.lineTo(-8, -80); g.lineTo(8, -80); g.fill(); }
  g.restore();
  // shoulders / shirt
  g.fillStyle = p.shirt;
  g.beginPath(); g.moveTo(12, 100); g.quadraticCurveTo(16, 74, 50, 72); g.quadraticCurveTo(84, 74, 88, 100); g.fill();
  if (p.badge) { g.fillStyle = '#ffd166'; g.beginPath(); g.arc(34, 88, 4, 0, 7); g.fill(); }
  if (p.chain) { g.strokeStyle = '#ffd23f'; g.lineWidth = 2.5; g.beginPath(); g.arc(50, 74, 13, 0.2, Math.PI - 0.2); g.stroke(); }
  if (who === 'rafa') { g.fillStyle = '#f6f1e7'; g.beginPath(); g.moveTo(42, 74); g.lineTo(50, 92); g.lineTo(58, 74); g.fill(); }
  // neck + head
  g.fillStyle = p.skin;
  g.fillRect(43, 60, 14, 14);
  g.beginPath(); g.ellipse(50, 44, 19, 23, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.ellipse(56, 46, 12, 21, 0, -1.2, 1.4); g.fill();
  // ears
  g.fillStyle = p.skin; g.beginPath(); g.ellipse(31, 46, 3.5, 5, 0, 0, 7); g.ellipse(69, 46, 3.5, 5, 0, 0, 7); g.fill();
  // hair
  g.fillStyle = p.hair;
  if (p.hairStyle === 'short') { g.beginPath(); g.ellipse(50, 28, 20, 11, 0, Math.PI, 0); g.fill(); g.fillRect(30, 26, 40, 6); }
  if (p.hairStyle === 'bob') { g.beginPath(); g.ellipse(50, 36, 23, 22, 0, Math.PI, 0); g.fill(); g.fillRect(27, 34, 8, 26); g.fillRect(65, 34, 8, 26); g.fillRect(30, 26, 40, 8); }
  if (p.hairStyle === 'bun') { g.beginPath(); g.ellipse(50, 28, 20, 11, 0, Math.PI, 0); g.fill(); g.beginPath(); g.arc(50, 14, 8, 0, 7); g.fill(); }
  if (p.hairStyle === 'slick') { g.beginPath(); g.ellipse(50, 27, 20, 9, 0, Math.PI, 0); g.fill(); }
  if (p.cap) { g.fillStyle = p.cap; g.beginPath(); g.ellipse(50, 27, 21, 11, 0, Math.PI, 0); g.fill(); g.fillRect(42, 25, 34, 5); }
  // face
  g.fillStyle = '#1a1a1a';
  if (p.shades) { g.fillStyle = '#121212'; g.beginPath(); g.roundRect(34, 39, 14, 8, 3); g.roundRect(52, 39, 14, 8, 3); g.fill(); g.fillRect(47, 41, 6, 2); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(36, 40, 4, 2); g.fillRect(54, 40, 4, 2); }
  else if (p.goggles) { g.strokeStyle = '#333'; g.lineWidth = 3; g.fillStyle = '#9ad1d4'; g.beginPath(); g.arc(42, 43, 6, 0, 7); g.arc(58, 43, 6, 0, 7); g.fill(); g.stroke(); }
  else { g.beginPath(); g.ellipse(42, 43, 2.6, 3.2, 0, 0, 7); g.ellipse(58, 43, 2.6, 3.2, 0, 0, 7); g.fill(); g.fillRect(37, 37, 9, 1.8); g.fillRect(54, 37, 9, 1.8); }
  if (p.beard) { g.fillStyle = p.hair; g.beginPath(); g.ellipse(50, 60, 13, 7, 0, 0, Math.PI); g.fill(); }
  g.strokeStyle = 'rgba(80,30,30,0.8)'; g.lineWidth = 2; g.beginPath(); g.arc(50, 52, 6, 0.25, Math.PI - 0.25); g.stroke();
  if (p.headset) { g.strokeStyle = '#eee'; g.lineWidth = 3; g.beginPath(); g.arc(50, 40, 23, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); g.fillStyle = '#eee'; g.fillRect(25, 40, 6, 12); g.fillRect(69, 40, 6, 12); g.beginPath(); g.moveTo(28, 52); g.quadraticCurveTo(30, 62, 42, 60); g.stroke(); }
  cache.set(key, c);
  return c;
}
