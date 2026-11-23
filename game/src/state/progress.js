// Player progression: cash, RESPECT points and the rank they unlock, story/activity
// records, and the stash pickups found. Saved and loaded with the rest of the game.

export const RANKS = [
  { rp: 0, name: 'Nobody' },
  { rp: 120, name: 'Wheelman' },
  { rp: 320, name: 'Hustler' },
  { rp: 650, name: 'Shot Caller' },
  { rp: 1100, name: 'Heavy' },
  { rp: 1800, name: 'Legend of Coral Vista' },
];

export class Progress {
  constructor(game) {
    this.game = game;
    this.money = 1500;
    this.respect = 0;
    this.story = 0;          // missions completed
    this.stashes = new Set();
    this.bestRace = null;
    this.fares = 0;
    this.kills = 0;
  }

  get rankIndex() {
    let r = 0;
    RANKS.forEach((k, i) => { if (this.respect >= k.rp) r = i; });
    return r;
  }
  get rank() { return RANKS[this.rankIndex]; }
  get nextRank() { return RANKS[this.rankIndex + 1] ?? null; }
  /** 0..1 progress toward the next rank */
  get rankProgress() {
    const n = this.nextRank;
    if (!n) return 1;
    return (this.respect - this.rank.rp) / (n.rp - this.rank.rp);
  }

  addMoney(n, why = '') {
    this.money = Math.max(0, this.money + n);
    if (n > 0) this.game.hud?.moneyPop(n, why);
  }

  spend(n) {
    if (this.money < n) return false;
    this.money -= n;
    return true;
  }

  addRespect(n) {
    const before = this.rankIndex;
    this.respect = Math.max(0, this.respect + n);
    if (this.rankIndex > before) {
      this.game.hud?.banner(`RANK UP`, `${this.rankIndex + 1} · ${this.rank.name}`, '#b08cff');
      this.game.audio?.jingle();
    }
  }

  serialize() {
    return { money: this.money, respect: this.respect, story: this.story, stashes: [...this.stashes], bestRace: this.bestRace, fares: this.fares, kills: this.kills };
  }

  load(s) {
    Object.assign(this, { money: s.money, respect: s.respect, story: s.story, bestRace: s.bestRace, fares: s.fares ?? 0, kills: s.kills ?? 0 });
    this.stashes = new Set(s.stashes ?? []);
  }
}
