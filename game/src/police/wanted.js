// Wanted level 0-5 stars. Crimes raise it (harder crimes, or crimes a cop sees, raise it
// more); it drains away once no CVPD unit has eyes on the player for long enough.

const CRIMES = {
  gunfire: { min: 1, seenOnly: true },
  carjack: { min: 1, seenOnly: true },
  assault: { min: 1, step: 3 },
  ramcop: { min: 1 },
  copcar: { min: 2 },
  shootcop: { min: 2, step: 4 },
  killcop: { min: 2, step: 1 },
  heist: { min: 2 },
};

export class Wanted {
  constructor(game) {
    this.game = game;
    this.stars = 0;
    this.counts = {};
    this.lostT = 0;     // seconds without being seen
    this.seen = false;
    this.flash = 0;     // HUD flash when stars change
    this.minLock = 0;   // missions can pin a minimum level
    this.eyesOut = 0;   // crew lookout ability: faster evasion
  }

  get hidden() { return this.stars > 0 && !this.seen; }

  /** Seconds out of sight needed to lose the cops at the current level. */
  get escapeTime() { return (8 + this.stars * 4) * (this.eyesOut > 0 ? 0.5 : 1); }

  set(level) {
    const prev = this.stars;
    this.stars = Math.max(0, Math.min(5, level));
    if (this.stars !== prev) {
      this.flash = 1.2;
      this.lostT = 0;
      if (this.stars > prev) this.game.audio?.wantedUp();
    }
  }

  crime(type, pos) {
    const c = CRIMES[type];
    if (!c || this.game.mode !== 'play') return;
    const witnessed = this.game.police?.witness(pos.x, pos.z) ?? false;
    if (c.seenOnly && !witnessed && this.stars === 0) {
      // civilians call it in sometimes
      this.counts[type] = (this.counts[type] ?? 0) + 1;
      if (this.counts[type] < 3) return;
      this.counts[type] = 0;
    }
    let next = Math.max(this.stars, c.min);
    if (c.step) {
      this.counts[type] = (this.counts[type] ?? 0) + 1;
      if (this.counts[type] >= c.step) { this.counts[type] = 0; next = Math.max(next, this.stars + 1); }
    }
    if (witnessed && this.stars > 0 && type !== 'gunfire') next = Math.max(next, this.stars);
    this.set(next);
    if (this.stars > 0) this.seen = true;
  }

  clear() {
    this.set(0);
    this.counts = {};
  }

  update(dt, seen) {
    if (this.flash > 0) this.flash -= dt;
    if (this.eyesOut > 0) this.eyesOut -= dt;
    if (this.stars < this.minLock) this.set(this.minLock);
    this.seen = seen;
    if (this.stars === 0) return;
    if (seen) this.lostT = 0;
    else {
      this.lostT += dt;
      if (this.lostT > this.escapeTime && this.stars > this.minLock) {
        this.set(this.minLock);
        this.game.hud?.notify('You lost the CVPD');
        this.game.progress?.addRespect(10);
      }
    }
  }
}
