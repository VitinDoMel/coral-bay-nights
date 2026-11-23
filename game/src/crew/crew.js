// Crew abilities on Z / X / C: Teo the driver swaps your plates (sheds wanted stars while
// you're in a car), Mags the mechanic does a quick fix on your ride, Pip the lookout keeps
// eyes out (police blips revealed, evasion twice as fast). Each has a cooldown.

export const CREW = [
  { key: 'KeyZ', label: 'Z', who: 'teo', title: 'Swap Plates', cooldown: 75 },
  { key: 'KeyX', label: 'X', who: 'mags', title: 'Quick Fix', cooldown: 45 },
  { key: 'KeyC', label: 'C', who: 'pip', title: 'Eyes Out', cooldown: 60 },
];

export class Crew {
  constructor(game) {
    this.game = game;
    this.cool = [0, 0, 0];
    this.active = [0, 0, 0];
  }

  ready(i) { return this.cool[i] <= 0 && this.usable(i); }

  usable(i) {
    const g = this.game;
    if (i === 0) return !!g.player.vehicle && g.wanted.stars > 0 && g.wanted.stars > g.wanted.minLock;
    if (i === 1) return !!g.player.vehicle && g.player.vehicle.health < 100;
    return g.wanted.stars > 0;
  }

  use(i) {
    const g = this.game;
    if (this.cool[i] > 0) { g.hud?.notify(`${CREW[i].title} recharging (${Math.ceil(this.cool[i])} s)`); return; }
    if (!this.usable(i)) { g.hud?.notify(['Swap Plates: be in a car with the cops on you', 'Quick Fix: be in a damaged car', 'Eyes Out: only useful when wanted'][i]); return; }
    this.cool[i] = CREW[i].cooldown;
    if (i === 0) {
      g.wanted.set(Math.max(g.wanted.minLock, g.wanted.stars - 2));
      g.dialogue?.say('teo', 'Fresh plates, new paint on the record. They\'re chasing a ghost.');
    } else if (i === 1) {
      const v = g.player.vehicle;
      v.health = Math.min(100, v.health + 50);
      v.burnT = 0;
      g.dialogue?.say('mags', 'Zip-ties and prayer. She\'ll hold — don\'t hug any lampposts.');
    } else {
      this.active[2] = 20;
      g.wanted.eyesOut = 20;
      g.dialogue?.say('pip', 'I\'m on the roof. Every cruiser\'s on your map — go dark and they\'ll lose you.');
    }
    g.audio?.ability();
  }

  update(dt) {
    const i = this.game.input;
    for (let k = 0; k < 3; k++) {
      if (this.cool[k] > 0) this.cool[k] -= dt;
      if (this.active[k] > 0) this.active[k] -= dt;
      if (this.game.mode === 'play' && !this.game.player.dead && i.pressed(CREW[k].key)) this.use(k);
    }
  }
}
