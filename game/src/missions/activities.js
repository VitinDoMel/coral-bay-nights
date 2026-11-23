// Side activities: the Seabreeze Sprint checkpoint race, Vista Cab fares, twelve cash
// stashes, Coral Arms (shop), Manta Motors (repair + respray drops 2 stars) and saving at
// Nina's Loft.
import { Marker, CashPickup } from './markers.js';
import { POI, BLOCKS, curbPoint, PROMENADE, ISLAND } from '../world/layout.js';
import { makeRng } from '../core/rng.js';
import { saveGame } from '../state/save.js';
import { formatMoney } from '../core/mathx.js';

const RACE = [
  { x: 241, z: 60 }, { x: 229, z: -40 }, { x: 229, z: -150 }, { x: 160, z: -160 }, { x: 32, z: -160 },
  { x: -32, z: -100 }, { x: -32, z: -32 }, { x: 60, z: -32 }, { x: 160, z: -32 }, { x: 229, z: 40 }, { x: 241, z: 118 },
];

function stashSpots() {
  const rng = makeRng(2026);
  const spots = [];
  const blocks = BLOCKS.filter((b) => b.district !== 'port');
  for (let i = 0; i < 9; i++) {
    const b = blocks[rng.int(0, blocks.length - 1)];
    spots.push(curbPoint(b.bx, b.bz, rng.pick(['n', 's', 'e', 'w']), rng.range(0.15, 0.85), 1.4));
  }
  spots.push({ x: PROMENADE[1] + 30, z: -90 }, { x: 330, z: 200 }, { x: ISLAND.minX + 50, z: ISLAND.maxZ - 30 });
  return spots;
}

export class Activities {
  constructor(game, missions) {
    this.game = game;
    this.missions = missions;
    this.mode = null; // null | 'race' | 'cab'
    this.markers = {};
    this.stashes = [];
    this.spots = stashSpots();
    this.cooldown = 0;
  }

  /** Build the fixed markers and the stashes not yet found. */
  init() {
    const s = this.game.scene;
    this.markers.arms = new Marker(s, POI.arms.x, POI.arms.z, { color: POI.arms.color, icon: 'A', radius: 1.6, height: 3 });
    this.markers.garage = new Marker(s, POI.garage.x + 5, POI.garage.z, { color: POI.garage.color, icon: 'M', radius: 3.2, height: 3 });
    this.markers.cab = new Marker(s, POI.cab.x + 5, POI.cab.z, { color: POI.cab.color, icon: 'T', radius: 3.2, height: 3 });
    this.markers.race = new Marker(s, POI.race.x, POI.race.z, { color: POI.race.color, icon: 'R', radius: 3.2, height: 3 });
    this.markers.loft = new Marker(s, POI.loft.x, POI.loft.z + 7, { color: POI.loft.color, icon: 'N', radius: 1.4, height: 3 });
    this.resetStashes();
  }

  resetStashes() {
    for (const c of this.stashes) c.dispose();
    this.stashes = this.spots.map((p, i) => (this.game.progress.stashes.has(i) ? null : new CashPickup(this.game.scene, p.x, p.z, i))).filter(Boolean);
  }

  stashBlips() {
    return this.stashes.map((c) => ({ x: c.x, z: c.z, color: '#3ddc84', icon: '$', size: 5 }));
  }

  stop(reason = null) {
    if (!this.mode) return;
    if (reason) this.game.hud.banner(this.mode === 'race' ? 'RACE OVER' : 'SHIFT OVER', reason, '#ff3b5c');
    this.cp?.dispose(); this.cp = null;
    this.mode = null;
  }

  onEnterVehicle() {}

  target() {
    if (this.mode === 'race') return RACE[this.raceIdx];
    if (this.mode === 'cab') return this.fare.stage === 'pickup' ? this.fare.from : this.fare.to;
    return null;
  }

  hudInfo() {
    if (this.mode === 'race') return { title: 'SEABREEZE SPRINT', objective: `Checkpoint ${this.raceIdx + 1}/${RACE.length}${this.game.progress.bestRace ? ` · best ${this.game.progress.bestRace.toFixed(1)} s` : ''}`, timer: `${this.raceT.toFixed(1)} s` };
    if (this.mode === 'cab') return { title: `VISTA CAB · FARE ${this.fareCount + 1}`, objective: this.fare.stage === 'pickup' ? 'Pick up the passenger' : `Drive the passenger to ${this.fare.name}`, timer: this.fare.stage === 'drop' ? `${Math.max(0, Math.ceil(this.fare.t))} s` : null };
    return null;
  }

  startRace() {
    this.mode = 'race';
    this.raceIdx = 0;
    this.raceT = 0;
    this.placeCheckpoint();
    this.game.hud.banner('SEABREEZE SPRINT', '11 checkpoints · beat the clock', '#59e36b', 2.5);
  }

  placeCheckpoint() {
    this.cp?.dispose();
    const p = RACE[this.raceIdx];
    this.cp = new Marker(this.game.scene, p.x, p.z, { color: '#59e36b', radius: 6, height: 7, icon: String(this.raceIdx + 1) });
  }

  newFare() {
    const rng = makeRng(Math.floor(this.game.time * 1000) + this.fareCount);
    const f = this.game.player.vehicle.pos;
    let from, to, name;
    for (let k = 0; k < 30; k++) {
      const b = BLOCKS[rng.int(0, BLOCKS.length - 1)];
      from = curbPoint(b.bx, b.bz, rng.pick(['n', 's', 'e', 'w']), 0.5, -3);
      if (Math.hypot(from.x - f.x, from.z - f.z) > 50 && Math.hypot(from.x - f.x, from.z - f.z) < 160) break;
    }
    const dests = [['Vista General', POI.hospital], ['Seabreeze Beach', { x: 230, z: 80 }], ['Coral Arms', POI.arms], ['the Port gate', { x: 112, z: 154 }], ['Lagoon Park', { x: -64, z: 32 }], ['Uptown', { x: -96, z: -224 }]];
    for (let k = 0; k < 10; k++) { const d = dests[rng.int(0, dests.length - 1)]; if (Math.hypot(d[1].x - from.x, d[1].z - from.z) > 120) { name = d[0]; to = { x: d[1].x, z: d[1].z }; break; } }
    if (!to) { name = 'Seabreeze Beach'; to = { x: 230, z: 80 }; }
    this.fare = { from, to, name, stage: 'pickup', t: 0 };
    this.cp?.dispose();
    this.cp = new Marker(this.game.scene, from.x, from.z, { color: '#ffd23f', radius: 4, height: 4, icon: 'T' });
  }

  update(dt) {
    const g = this.game, p = g.player, v = p.vehicle;
    const f = v ? v.pos : p.pos;
    if (this.cooldown > 0) this.cooldown -= dt;
    for (const k in this.markers) this.markers[k].update(g.time);
    for (const c of [...this.stashes]) {
      c.update(g.time);
      if (Math.hypot(c.x - f.x, c.z - f.z) < 2.2) {
        g.progress.stashes.add(c.id);
        g.progress.addMoney(250, `· cash stash ${g.progress.stashes.size}/12`);
        g.progress.addRespect(5);
        g.audio?.pickup();
        c.dispose();
        this.stashes = this.stashes.filter((o) => o !== c);
      }
    }
    if (p.dead) return;
    if (this.mode === 'race') {
      this.raceT += dt;
      if (!v) { this.stop('You left the car'); return; }
      this.cp.update(g.time);
      if (this.cp.inside(f.x, f.z, 2)) {
        g.audio?.blip();
        this.raceIdx++;
        if (this.raceIdx >= RACE.length) {
          const best = g.progress.bestRace;
          const record = !best || this.raceT < best;
          if (record) g.progress.bestRace = this.raceT;
          const pay = record ? 900 : 500;
          g.progress.addMoney(pay, '· Seabreeze Sprint');
          g.progress.addRespect(record ? 40 : 20);
          g.hud.banner(record ? 'NEW RECORD' : 'FINISHED', `${this.raceT.toFixed(1)} s · ${formatMoney(pay)}`, '#59e36b');
          this.cp.dispose(); this.cp = null; this.mode = null; this.cooldown = 4;
          return;
        }
        this.placeCheckpoint();
      }
      return;
    }
    if (this.mode === 'cab') {
      if (!v) { this.stop(`Fares completed: ${this.fareCount}`); return; }
      this.cp.update(g.time);
      const fr = this.fare;
      if (fr.stage === 'pickup' && this.cp.inside(f.x, f.z, 1) && Math.abs(v.speed) < 4) {
        fr.stage = 'drop';
        fr.t = 20 + Math.hypot(fr.to.x - fr.from.x, fr.to.z - fr.from.z) / 7;
        this.cp.dispose();
        this.cp = new Marker(g.scene, fr.to.x, fr.to.z, { color: '#ffd23f', radius: 5, height: 4, icon: '$' });
        g.hud.notify(`Passenger: "${['Seabreeze, and step on it!', 'I\'m late, amigo!', 'Take the scenic route. Kidding. Hurry.'][this.fareCount % 3]}"`, '#ffd23f');
      } else if (fr.stage === 'drop') {
        fr.t -= dt;
        if (this.cp.inside(f.x, f.z, 1) && Math.abs(v.speed) < 5) {
          const pay = Math.round(120 + Math.hypot(fr.to.x - fr.from.x, fr.to.z - fr.from.z) * 1.4 + Math.max(0, fr.t) * 8);
          g.progress.addMoney(pay, `· fare to ${fr.name}`);
          g.progress.addRespect(8);
          g.progress.fares++;
          this.fareCount++;
          this.newFare();
        } else if (fr.t <= 0) this.stop('The passenger bailed — too slow');
      }
      return;
    }
    // idle: activity starts and services
    if (this.cooldown > 0) return;
    const m = this.markers;
    if (v && m.race.inside(f.x, f.z, 2)) { if (g.wanted.stars) return; this.startRace(); return; }
    if (v && m.cab.inside(f.x, f.z, 2) && !g.wanted.stars) {
      this.mode = 'cab'; this.fareCount = 0; this.newFare();
      g.hud.banner('VISTA CAB', 'Pick up fares · leave the car to end your shift', '#ffd23f', 2.5);
      return;
    }
    if (v && m.garage.inside(f.x, f.z, 2)) {
      const cost = 200;
      if (v.health < 100 || g.wanted.stars > 0) {
        if (g.progress.spend(cost)) {
          v.health = 100; v.burnT = 0;
          if (g.wanted.stars > 0 && g.wanted.stars <= 3) { g.wanted.set(Math.max(g.wanted.minLock, g.wanted.stars - 2)); }
          g.hud.notify(`Manta Motors: repaired &amp; resprayed · -${formatMoney(cost)}`, '#35d0ba');
          this.cooldown = 6;
        } else { g.hud.notify('Manta Motors: $200 for a respray', '#35d0ba'); this.cooldown = 3; }
      }
    }
    if (!v && m.arms.inside(f.x, f.z, 0.5)) { g.shop?.open(); this.cooldown = 2; }
    if (!v && m.loft.inside(f.x, f.z, 0.5) && !this.missions.active) {
      p.health = 100;
      if (saveGame(g)) g.hud.notify("Game saved at Nina's Loft · health restored", '#b08cff');
      this.cooldown = 8;
    }
  }
}
