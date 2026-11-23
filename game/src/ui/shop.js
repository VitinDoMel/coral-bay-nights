// Coral Arms: the gun shop counter. Buy weapons, ammo and body armour with cash; prices
// scale with what each item does. Opens when you step on the shop marker, Esc closes.
import { WEAPONS } from '../player/weapons.js';
import { drawWeaponIcon } from './icons.js';
import { formatMoney } from '../core/mathx.js';

export class Shop {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('shop');
    this.open_ = false;
  }

  get isOpen() { return this.open_; }

  open() {
    const g = this.game;
    this.open_ = true;
    g.mode = 'shop';
    g.input.unlock();
    this.render();
    this.el.classList.remove('hidden');
  }

  close() {
    this.open_ = false;
    this.el.classList.add('hidden');
    this.game.mode = 'play';
  }

  items() {
    const a = this.game.arsenal;
    const out = [];
    for (const w of WEAPONS) {
      if (w.id === 0) continue;
      if (!a.owned[w.id]) out.push({ id: `w${w.id}`, wid: w.id, name: w.name, sub: w.key, price: w.price, act: () => a.give(w.id, w.ammoPack ?? 0) });
      else if (w.clip) out.push({ id: `a${w.id}`, wid: w.id, name: `${w.name} ammo`, sub: `+${w.ammoPack} rounds`, price: w.ammoPrice, act: () => { a.ammo[w.id] += w.ammoPack; if (a.clip[w.id] === 0) a.refill(w.id); } });
    }
    out.push({ id: 'armor', wid: -1, name: 'Body armour', sub: 'Full vest · absorbs 70%', price: 600, act: () => { this.game.player.armor = 100; } });
    out.push({ id: 'med', wid: -1, name: 'First-aid kit', sub: 'Full health', price: 250, act: () => { this.game.player.health = 100; } });
    return out;
  }

  render() {
    const g = this.game;
    this.el.innerHTML = `<div class="shop-panel"><div class="shop-head"><h2>CORAL ARMS</h2><span>Licensed &amp; mostly legal · ${formatMoney(g.progress.money)}</span></div><div class="shop-grid"></div><div class="shop-foot">Click to buy · Esc to leave</div></div>`;
    const grid = this.el.querySelector('.shop-grid');
    for (const it of this.items()) {
      const b = document.createElement('button');
      b.className = 'shop-item';
      const afford = g.progress.money >= it.price;
      if (!afford) b.classList.add('poor');
      const c = document.createElement('canvas');
      c.width = 90; c.height = 45;
      if (it.wid >= 0) drawWeaponIcon(c.getContext('2d'), it.wid, 90, 45, '#fff');
      else { const x = c.getContext('2d'); x.fillStyle = it.id === 'armor' ? '#8fc1ff' : '#ff7a8f'; x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.fillText(it.id === 'armor' ? '⛨' : '✚', 45, 36); }
      b.appendChild(c);
      b.insertAdjacentHTML('beforeend', `<b>${it.name}</b><small>${it.sub}</small><em>${formatMoney(it.price)}</em>`);
      b.onclick = () => {
        if (!g.progress.spend(it.price)) { g.audio?.deny(); return; }
        it.act();
        g.audio?.pickup();
        g.hud.notify(`Bought ${it.name}`, '#ff8a3d');
        this.render();
      };
      grid.appendChild(b);
    }
  }

  update() {
    if (this.open_ && this.game.input.pressed('Escape')) this.close();
  }
}
