// Mission state machine: start markers for the next story mission, intro dialogue, steps
// with objectives/timers/targets, pass and fail, rewards and autosave, the GPS route and
// the blips the minimap and big map draw. Side activities run through Activities.
import { STORY } from './story-missions.js';
import { Marker } from './markers.js';
import { Activities } from './activities.js';
import { routeBetween, POI } from '../world/layout.js';
import { saveGame } from '../state/save.js';

export class Missions {
  constructor(game) {
    this.game = game;
    this.active = null;   // { def, stepIndex, m, timer }
    this.startMarker = null;
    this.enemies = [];
    this.route = null;
    this.routeT = 0;
    this.activities = new Activities(game, this);
    this.introPlaying = false;
  }

  get next() { return STORY[this.game.progress.story] ?? null; }

  refreshStartMarker() {
    this.startMarker?.dispose();
    this.startMarker = null;
    const n = this.next;
    if (n && !this.active) this.startMarker = new Marker(this.game.scene, n.start.x, n.start.z, { color: '#ffd23f', icon: String(n.id), radius: 2.4 });
  }

  begin(def) {
    const g = this.game;
    this.active = { def, stepIndex: -1, m: {}, timer: null };
    this.startMarker?.dispose(); this.startMarker = null;
    this.activities.stop();
    this.introPlaying = true;
    g.hud.banner(`${def.id} · ${def.title.toUpperCase()}`, 'Story mission', '#ffd23f', 2.6);
    g.dialogue.scene(def.intro, () => { this.introPlaying = false; this.advance(); });
  }

  ctx() { return { game: this.game, m: this.active.m, engine: this, step: this.active.step }; }

  advance() {
    const a = this.active;
    a.stepIndex++;
    const step = a.def.steps[a.stepIndex];
    if (!step) { this.pass(); return; }
    a.step = { ...step };
    a.timer = step.timer ?? null;
    step.setup?.(this.ctx());
    this.game.audio?.blip();
  }

  pass() {
    const g = this.game, def = this.active.def;
    g.progress.story = Math.max(g.progress.story, def.id);
    g.progress.addMoney(def.reward.money, `· ${def.title}`);
    g.progress.addRespect(def.reward.rp);
    g.hud.banner('MISSION PASSED', `${def.title} · +$${def.reward.money.toLocaleString('en-US')} · +${def.reward.rp} RP`, '#ffd23f', 4);
    g.audio?.jingle();
    g.dialogue.scene(def.outro);
    this.cleanup();
    if (def.id === 5) g.hud.notify('Story complete · Coral Vista is yours to roam', '#ffd23f');
    saveGame(g);
    this.refreshStartMarker();
  }

  fail(reason) {
    if (!this.active) { this.activities.stop(reason); return; }
    const g = this.game;
    g.hud.banner('MISSION FAILED', reason, '#ff3b5c', 3.5);
    g.wanted.minLock = 0;
    this.cleanup();
    this.refreshStartMarker();
  }

  cleanup() {
    const m = this.active?.m;
    if (m) {
      for (const e of m.enemies ?? []) e.dispose();
      for (const k of ['car', 'target']) if (m[k] && m[k] !== this.game.player.vehicle) m[k].keep = false;
    }
    this.enemies = [];
    this.active = null;
    this.introPlaying = false;
    this.route = null;
  }

  hitEnemy(e, dmg) {
    if (!e.alive) return;
    e.health -= dmg;
    e.alert = true;
    this.game.fx.blood(e.x, 1.2, e.z);
    if (e.health <= 0) { e.alive = false; this.game.progress.addRespect(3); this.game.progress.kills++; }
  }

  onEnterVehicle(v) { this.activities.onEnterVehicle(v); }
  onRam(other, impact) { const s = this.active?.def.steps[this.active.stepIndex]; s?.onRam?.(this.ctx(), other, impact); }
  onCarDamaged() {}

  /** Current target position (for GPS + blips). */
  target() {
    if (this.active && this.active.stepIndex >= 0) {
      const s = this.active.def.steps[this.active.stepIndex];
      const t = s.target?.(this.ctx());
      return t ? { x: t.x, z: t.z } : null;
    }
    const act = this.activities.target();
    if (act) return act;
    return this.next ? { x: this.next.start.x, z: this.next.start.z } : null;
  }

  hudInfo() {
    const a = this.active;
    if (a) {
      const timer = a.timer != null ? `${Math.max(0, Math.ceil(a.timer))} s` : null;
      return { title: `STORY ${a.def.id}/5 · ${a.def.title.toUpperCase()}`, objective: this.introPlaying ? 'Listen in…' : a.step?.text ?? '', timer };
    }
    const act = this.activities.hudInfo();
    if (act) return act;
    const n = this.next;
    if (n) return { title: `STORY ${n.id}/5 · ${n.title.toUpperCase()}`, objective: `Go to the <b style="color:#ffd23f">${n.id}</b> marker at ${n.start.name}` };
    return { title: 'FREE ROAM', objective: 'Races, cab fares, stashes and Coral Arms await' };
  }

  blips() {
    const out = [];
    const t = this.target();
    if (t) out.push({ x: t.x, z: t.z, color: '#ff4fd8', icon: '◆', edge: true, size: 9 });
    if (!this.active && this.next) out.push({ x: this.next.start.x, z: this.next.start.z, color: '#ffd23f', icon: String(this.next.id), edge: true });
    for (const k of ['arms', 'garage', 'cab', 'race', 'loft']) out.push({ x: POI[k].x, z: POI[k].z, color: POI[k].color, icon: POI[k].icon, size: 7 });
    for (const s of this.activities.stashBlips()) out.push(s);
    for (const e of this.enemies) if (e.alive) out.push({ x: e.x, z: e.z, color: '#ff3030', size: 4 });
    return out;
  }

  update(dt) {
    const g = this.game;
    const f = g.player.vehicle ? g.player.vehicle.pos : g.player.pos;
    this.startMarker?.update(g.time);
    for (const e of this.enemies) e.update(dt);
    if (!this.active && this.startMarker && !g.player.dead && this.startMarker.inside(f.x, f.z, g.player.vehicle ? 2 : 0) && !g.dialogue.busy) {
      if (g.wanted.stars > 0) { if (!this.warned) { g.hud.notify('Lose your wanted level to start the mission', '#ff6f91'); this.warned = true; } }
      else { this.warned = false; this.begin(this.next); }
    }
    const a = this.active;
    if (a && a.stepIndex >= 0 && !g.player.dead) {
      const step = a.def.steps[a.stepIndex];
      if (a.timer != null) {
        a.timer -= dt;
        if (a.timer <= 0) { this.fail('Out of time'); return; }
      }
      const r = step.update(this.ctx());
      if (a.step && this.active) a.step.text = this.ctx().step.text;
      if (r === 'done') this.advance();
      else if (r && r.startsWith('fail:')) this.fail(r.slice(5));
    }
    if (!this.active) this.activities.update(dt);
    // GPS
    this.routeT -= dt;
    if (this.routeT <= 0) {
      this.routeT = 0.8;
      const t = this.target();
      this.route = t && Math.hypot(t.x - f.x, t.z - f.z) > 25 ? routeBetween(f.x, f.z, t.x, t.z) : null;
    }
  }
}
