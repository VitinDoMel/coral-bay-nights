// Dialogue box: queued lines with the speaker's illustrated portrait, name and role.
// Lines advance on their own (reading time) or with Enter.
import { portrait, CAST } from './portraits.js';

export class Dialogue {
  constructor(game) {
    this.game = game;
    this.box = document.getElementById('dialogue');
    this.queue = [];
    this.current = null;
    this.t = 0;
  }

  /** Queue one line. */
  say(who, text, dur = null) {
    this.queue.push({ who, text, dur: dur ?? Math.min(7, 2.2 + text.length * 0.045) });
    if (!this.current) this.next();
  }

  /** Queue a scene: [[who, text], ...]; `then` runs after the last line. */
  scene(lines, then = null) {
    lines.forEach(([who, text], i) => {
      this.queue.push({ who, text, dur: Math.min(7, 2.2 + text.length * 0.045), then: i === lines.length - 1 ? then : null });
    });
    if (!this.current) this.next();
  }

  next() {
    const done = this.current?.then;
    this.current = this.queue.shift() ?? null;
    if (done) done();
    if (!this.current) { this.box.classList.add('hidden'); return; }
    const c = CAST[this.current.who];
    this.box.innerHTML = '';
    this.box.appendChild(portrait(this.current.who, 96));
    const txt = document.createElement('div');
    txt.innerHTML = `<div class="dl-name">${c.name}</div><div class="dl-role">${c.role}</div><div class="dl-line">${this.current.text}</div>`;
    this.box.appendChild(txt);
    this.box.classList.remove('hidden');
    this.t = this.current.dur;
  }

  clear() { this.queue = []; this.current = null; this.box.classList.add('hidden'); }

  get busy() { return !!this.current; }

  update(dt) {
    if (!this.current) return;
    this.t -= dt;
    if (this.t <= 0 || this.game.input.pressed('Enter')) this.next();
  }
}
