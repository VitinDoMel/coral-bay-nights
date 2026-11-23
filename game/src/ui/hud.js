// In-game HUD: mission card, CVPD tactical dispatch board, radio now-playing, cash, wanted
// stars, weapon rack with ammo, crew ability cards, minimap with location, health / armour /
// vehicle condition / respect bars, speedometer, crosshair, notifications and big banners.
import { Minimap } from './minimap.js';
import { drawWeaponIcon, SVG } from './icons.js';
import { WEAPONS } from '../player/weapons.js';
import { CREW } from '../crew/crew.js';
import { portrait, CAST } from '../story/portraits.js';
import { roadNameAt, districtAt } from '../world/layout.js';
import { formatMoney } from '../core/mathx.js';

const ROLE_COLORS = { RAMMING: '#ff4a5f', FLANKING: '#ff9d2e', BLOCKADE: '#a87bff', SPOTLIGHT: '#ffe15a', 'ON FOOT': '#3ea2ff' };

function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  parent?.appendChild(e);
  return e;
}

export class Hud {
  constructor(game) {
    this.game = game;
    const root = this.root = document.getElementById('hud');
    root.innerHTML = '';
    this.cache = new Map();

    const tl = el('div', 'hud-tl', root);
    this.mission = el('div', 'mission-card', tl);
    this.missionTitle = el('div', 'mc-title', this.mission);
    this.missionObj = el('div', 'mc-obj', this.mission);
    this.missionTimer = el('div', 'mc-timer', this.mission);
    this.dispatch = el('div', 'dispatch', tl);
    el('div', 'dp-head', this.dispatch, '<i></i>CVPD TACTICAL DISPATCH');
    this.dispatchRows = el('div', 'dp-rows', this.dispatch);

    this.radio = el('div', 'radio-box', root);

    const tr = el('div', 'hud-tr', root);
    this.money = el('div', 'money', tr);
    this.stars = el('div', 'stars', tr);
    this.starEls = [];
    for (let i = 0; i < 5; i++) this.starEls.push(el('span', 'star', this.stars, SVG.star));
    this.rack = el('div', 'rack', tr);
    this.slots = WEAPONS.map((w, i) => {
      const s = el('div', 'slot', this.rack);
      el('b', 'slot-num', s, String(i + 1));
      const c = el('canvas', '', s); c.width = 60; c.height = 30;
      drawWeaponIcon(c.getContext('2d'), i, 60, 30, '#fff');
      const ammo = el('div', 'slot-ammo', s);
      return { s, ammo };
    });
    this.weaponName = el('div', 'weapon-name', tr);
    this.crew = el('div', 'crew', tr);
    this.crewCards = CREW.map((c) => {
      const card = el('div', 'crew-card', this.crew);
      card.appendChild(portrait(c.who, 44));
      const t = el('div', 'cc-text', card, `<b>${c.title}</b><span>${CAST[c.who].name} · ${CAST[c.who].role}</span>`);
      void t;
      const key = el('div', 'cc-key', card, c.label);
      const bar = el('div', 'cc-bar', card);
      return { card, key, bar };
    });

    const bl = el('div', 'hud-bl', root);
    this.miniCanvas = el('canvas', 'minimap', bl);
    this.miniCanvas.width = this.miniCanvas.height = 224;
    this.minimap = new Minimap(this.miniCanvas);
    this.location = el('div', 'location', bl);
    const bars = el('div', 'bars', bl);
    const bar = (icon, cls) => {
      const row = el('div', 'bar-row ' + cls, bars);
      el('span', 'bar-icon', row, SVG[icon]);
      const track = el('div', 'bar-track', row);
      const fill = el('div', 'bar-fill', track);
      const label = el('div', 'bar-label', track);
      return { row, fill, label };
    };
    this.health = bar('heart', 'b-health');
    this.armor = bar('shield', 'b-armor');
    this.cond = bar('wrench', 'b-cond');
    this.respect = bar('star', 'b-respect');

    this.speedo = el('canvas', 'speedo', root);
    this.speedo.width = this.speedo.height = 190;
    this.hint = el('div', 'hint', root, 'Click aim &amp; shoot · 1-7 weapons · R reload · Shift run · Space jump · F car · Z/X/C crew · Q radio · M map · Esc pause');
    this.crosshair = el('div', 'crosshair', root);
    this.feed = document.getElementById('notify');
    this.bannerEl = document.getElementById('banner');
    this.bannerT = 0;
    this.flashEl = el('div', 'hit-flash', root);
  }

  set(elm, key, html) {
    if (this.cache.get(key) === html) return;
    this.cache.set(key, html);
    elm.innerHTML = html;
  }

  notify(text, color = '#fff') {
    const n = el('div', 'note', this.feed, text);
    n.style.borderLeftColor = color;
    setTimeout(() => n.classList.add('out'), 3600);
    setTimeout(() => n.remove(), 4200);
    while (this.feed.children.length > 4) this.feed.firstChild.remove();
  }

  moneyPop(n, why) {
    this.notify(`<b style="color:#7dffa8">+${formatMoney(n)}</b> ${why}`, '#7dffa8');
  }

  banner(title, sub = '', color = '#ffd23f', dur = 3.2) {
    this.bannerEl.innerHTML = `<div class="bn-title" style="color:${color}">${title}</div><div class="bn-sub">${sub}</div>`;
    this.bannerEl.classList.remove('hidden');
    this.bannerT = dur;
  }

  show(on) { this.root.classList.toggle('hidden', !on); }

  update(dt) {
    const g = this.game, p = g.player, v = p.vehicle, w = g.wanted, prog = g.progress, a = g.arsenal;
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.bannerEl.classList.add('hidden'); }

    // mission card
    const m = g.missions?.hudInfo() ?? { title: 'FREE ROAM', objective: 'Explore Coral Vista' };
    this.set(this.missionTitle, 'mt', m.title);
    this.set(this.missionObj, 'mo', m.objective);
    this.set(this.missionTimer, 'mtm', m.timer ?? '');
    this.missionTimer.classList.toggle('hidden', !m.timer);

    // dispatch board
    const board = w.stars > 0 ? g.police.board() : [];
    this.dispatch.classList.toggle('hidden', board.length === 0);
    this.set(this.dispatchRows, 'dp', board.map((r) => `<div class="dp-row"><span>${r.name}</span><em>${r.dist} m</em><b style="background:${ROLE_COLORS[r.role]}">${r.role}</b></div>`).join(''));

    // radio
    const rd = g.radio;
    const showRadio = v && rd && rd.station > 0;
    this.radio.classList.toggle('hidden', !showRadio);
    if (showRadio) {
      const st = rd.current;
      this.set(this.radio, 'rd', `<div class="rd-top"><span class="rd-icon">${SVG.radio}</span><b style="color:${st.color}">${st.name}</b> <small>${st.freq} · ${st.genre}</small></div><div class="rd-track">♪ ${rd.track} <i>— ${st.dj}</i> · Q next station</div>`);
    }

    // cash + stars
    this.set(this.money, 'money', formatMoney(prog.money));
    const blink = w.hidden && Math.floor(g.time * 3) % 2 === 0;
    this.starEls.forEach((s, i) => {
      const on = i < w.stars;
      s.classList.toggle('on', on && !blink);
      s.classList.toggle('dim', on && blink);
    });
    this.stars.classList.toggle('flash', w.flash > 0);

    // weapon rack
    this.slots.forEach((s, i) => {
      const wp = WEAPONS[i];
      s.s.classList.toggle('owned', a.owned[i]);
      s.s.classList.toggle('sel', a.current === i);
      this.set(s.ammo, 'ammo' + i, !a.owned[i] ? 'LOCKED' : wp.clip ? `${a.clip[i]}/${a.ammo[i]}` : '∞');
    });
    const cw = a.weapon;
    this.set(this.weaponName, 'wn', `${cw.name} ${cw.clip ? `<b>${a.clip[cw.id]} | ${a.ammo[cw.id]}</b>` : ''}${a.reloadT > 0 ? ' <i>RELOADING</i>' : ''}`);

    // crew
    this.crewCards.forEach((c, i) => {
      const cd = g.crew.cool[i];
      c.card.classList.toggle('ready', g.crew.ready(i));
      c.card.classList.toggle('active', g.crew.active[i] > 0);
      c.bar.style.width = cd > 0 ? `${(1 - cd / CREW[i].cooldown) * 100}%` : '100%';
    });

    // bars
    this.health.fill.style.width = `${p.health}%`;
    this.set(this.health.label, 'hl', `HEALTH ${Math.ceil(p.health)}`);
    this.armor.fill.style.width = `${p.armor}%`;
    this.set(this.armor.label, 'al', p.armor > 0 ? `ARMOR ${Math.ceil(p.armor)}` : 'NO ARMOR');
    this.cond.row.classList.toggle('hidden', !v);
    if (v) {
      this.cond.fill.style.width = `${v.health}%`;
      this.set(this.cond.label, 'cl', `CONDITION ${Math.ceil(v.health)}%${v.health < 70 ? ' · DENTED' : ''}${v.health < 30 ? ' · SMOKING' : ''}`);
    }
    this.respect.fill.style.width = `${prog.rankProgress * 100}%`;
    this.set(this.respect.label, 'rl', `RANK ${prog.rankIndex + 1} · ${prog.rank.name.toUpperCase()} · ${prog.respect} RP`);

    // location + minimap
    const fx = v ? v.pos.x : p.pos.x, fz = v ? v.pos.z : p.pos.z;
    this.set(this.location, 'loc', `${roadNameAt(fx, fz)} · ${districtAt(fx, fz)}`);
    const police = [];
    const reveal = w.stars > 0;
    if (reveal) {
      for (const u of g.police.units) police.push({ x: u.v.pos.x, z: u.v.pos.z, phase: u.v.id });
      for (const c of g.police.cops) if (c.alive) police.push({ x: c.x, z: c.z, phase: 1 });
      if (g.police.heli) police.push({ x: g.police.heli.pos.x, z: g.police.heli.pos.z, heli: true });
    }
    this.minimap.draw({
      x: fx, z: fz, yaw: g.cam.yaw, heading: v ? v.heading : p.heading, speed: v ? Math.abs(v.speed) : 0,
      blips: g.missions?.blips() ?? [], police, route: g.missions?.route ?? null,
      heli: g.police.heli ? g.police.heli.aim : null, t: g.time,
    });

    // speedometer
    this.speedo.classList.toggle('hidden', !v);
    if (v) this.drawSpeedo(v);

    // crosshair + damage flash
    this.crosshair.classList.toggle('hidden', !!v || cw.melee || p.dead);
    this.crosshair.classList.toggle('aim', p.aiming);
    this.flashEl.style.opacity = p.hitFlash > 0 ? Math.min(0.3, p.hitFlash) : (p.health < 25 ? 0.25 + Math.sin(g.time * 6) * 0.1 : 0);
    document.getElementById('vignette').classList.toggle('wanted', w.stars > 0);
  }

  drawSpeedo(v) {
    const g = this.speedo.getContext('2d'), W = 190, R = 80;
    const kmh = Math.abs(v.speed) * 3.6;
    const max = v.spec.maxSpeed * 3.6 * 1.05;
    g.clearRect(0, 0, W, W);
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    g.lineCap = 'round';
    g.lineWidth = 12; g.strokeStyle = 'rgba(15,12,30,0.75)';
    g.beginPath(); g.arc(W / 2, W / 2, R, a0, a1); g.stroke();
    const t = Math.min(1, kmh / max);
    const grad = g.createLinearGradient(0, W, W, 0);
    grad.addColorStop(0, '#2ef2ff'); grad.addColorStop(0.6, '#59e3a0'); grad.addColorStop(1, '#ff3fa4');
    g.lineWidth = 8; g.strokeStyle = grad;
    g.beginPath(); g.arc(W / 2, W / 2, R, a0, a0 + (a1 - a0) * t); g.stroke();
    g.fillStyle = '#fff'; g.textAlign = 'center';
    g.font = 'bold 46px Trebuchet MS, sans-serif'; g.fillText(String(Math.round(kmh)), W / 2, W / 2 + 12);
    const gear = v.speed < -0.5 ? 'R' : Math.min(5, 1 + Math.floor(kmh / (max / 5)));
    g.font = 'bold 14px Trebuchet MS, sans-serif'; g.fillStyle = '#9ff7ff';
    g.fillText(`KM/H · GEAR ${gear}`, W / 2, W / 2 + 34);
    g.fillStyle = v.health > 50 ? '#7dffa8' : '#ff9d2e';
    g.font = 'bold 12px Trebuchet MS, sans-serif';
    g.fillText(`${v.spec.name.toUpperCase()} · ENGINE ${Math.ceil(v.health)}%`, W / 2, W / 2 + 52);
  }
}
