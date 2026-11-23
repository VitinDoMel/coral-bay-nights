// Hand-drawn canvas icons: weapon silhouettes for the rack, and the small SVG glyphs used
// by the HUD bars (heart, shield, wrench, star).

export function drawWeaponIcon(g, id, w, h, color = '#fff') {
  g.save();
  g.clearRect(0, 0, w, h);
  g.fillStyle = color; g.strokeStyle = color;
  g.translate(w / 2, h / 2);
  const s = Math.min(w / 60, h / 30);
  g.scale(s, s);
  const r = (x, y, ww, hh) => g.fillRect(x, y, ww, hh);
  if (id === 0) { // fist
    g.beginPath(); g.roundRect(-11, -9, 20, 17, 5); g.fill();
    g.clearRect(-9, -5, 16, 1.4); g.clearRect(-9, -1, 16, 1.4);
    r(-15, -3, 5, 9);
  } else if (id === 1) { // bat
    g.beginPath(); g.moveTo(-26, 5); g.lineTo(18, -6); g.quadraticCurveTo(25, -8, 25, -4); g.lineTo(-24, 8); g.closePath(); g.fill();
    r(-28, 4, 4, 5);
  } else if (id === 2) { // pistol
    r(-14, -8, 26, 7); r(8, -9, 3, 2);
    g.beginPath(); g.moveTo(-12, -1); g.lineTo(-4, -1); g.lineTo(-7, 11); g.lineTo(-14, 11); g.closePath(); g.fill();
    g.fillRect(-4, -1, 6, 1.5); g.fillRect(1, -1, 1.5, 4);
  } else if (id === 3) { // SMG
    r(-16, -7, 30, 7); r(14, -5, 8, 3);
    r(-4, 0, 5, 12); r(-14, 0, 5, 8);
    r(-26, -6, 10, 3);
  } else if (id === 4) { // shotgun
    r(-10, -6, 38, 4); r(-6, -2, 22, 3);
    g.beginPath(); g.moveTo(-10, -6); g.lineTo(-28, -2); g.lineTo(-28, 5); g.lineTo(-10, 0); g.closePath(); g.fill();
  } else if (id === 5) { // rifle
    r(-14, -7, 34, 6); r(20, -5, 9, 2); r(-2, -1, 5, 11); r(6, -1, 4, 8);
    g.beginPath(); g.moveTo(-14, -7); g.lineTo(-28, -4); g.lineTo(-28, 4); g.lineTo(-14, -1); g.closePath(); g.fill();
    r(-6, -11, 12, 3);
  } else if (id === 6) { // launcher
    r(-26, -6, 46, 9); g.beginPath(); g.moveTo(20, -8); g.lineTo(29, -3); g.lineTo(20, 5); g.closePath(); g.fill();
    r(-6, 3, 4, 8); r(4, 3, 4, 6);
  }
  g.restore();
}

export const SVG = {
  heart: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.2C.8 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.1 5.3 3 1.7-1.9 3.2-3 5.3-3 3.7 0 5.9 3.8 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z"/></svg>',
  wrench: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M21 7.5a5.5 5.5 0 0 1-7.4 5.2L6 20.3a2 2 0 0 1-2.8-2.8l7.6-7.6A5.5 5.5 0 0 1 17.5 2.6l-3.3 3.3.6 2.9 2.9.6z"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>',
  radio: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 8h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zm2.5-1.6L17 3l.6 1.6L9.8 8H6.5zM7 12a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm6 0v1.5h5V12zm0 3v1.5h5V15z"/></svg>',
};
