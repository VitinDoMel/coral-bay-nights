// Synthesised sound (WebAudio, no samples): engine hum that follows speed and gear, police
// sirens that wail with distance, gunshots per weapon, explosions, crashes, footsteps of
// UI (blips, pickups, jingles) and the bus the radio plays through.

export class Audio {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.vol = 0.8;
    this.musicVol = 0.6;
  }

  /** Browsers start audio only after a user gesture. */
  unlock() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.vol; this.master.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    this.music = c.createGain(); this.music.gain.value = this.musicVol * 0.5; this.music.connect(this.master);
    // noise buffer
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // engine: two detuned saws through a lowpass
    this.engGain = c.createGain(); this.engGain.gain.value = 0;
    this.engFilter = c.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 400;
    this.eng1 = c.createOscillator(); this.eng1.type = 'sawtooth';
    this.eng2 = c.createOscillator(); this.eng2.type = 'square';
    this.eng1.connect(this.engFilter); this.eng2.connect(this.engFilter);
    this.engFilter.connect(this.engGain); this.engGain.connect(this.sfx);
    this.eng1.start(); this.eng2.start();
    // siren
    this.sirGain = c.createGain(); this.sirGain.gain.value = 0;
    this.sir = c.createOscillator(); this.sir.type = 'triangle';
    this.sir.connect(this.sirGain); this.sirGain.connect(this.sfx); this.sir.start();
    this.game.radio?.attach(c, this.music);
  }

  setVolume(v, m) {
    this.vol = v; this.musicVol = m;
    if (this.master) { this.master.gain.value = v; this.music.gain.value = m * 0.5; }
  }

  atten(pos) {
    if (!pos) return 1;
    const f = this.game.camera.position;
    return 1 / (1 + Math.hypot(pos.x - f.x, pos.z - f.z) / 14);
  }

  noiseHit({ dur = 0.2, freq = 1200, q = 0.7, gain = 0.6, type = 'lowpass', pos = null, decay = 4 }) {
    const c = this.ctx; if (!c) return;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    const t = c.currentTime, a = gain * this.atten(pos);
    g.gain.setValueAtTime(a, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfx);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
    void decay;
  }

  tone({ freq = 440, to = null, dur = 0.12, type = 'sine', gain = 0.2, delay = 0 }) {
    const c = this.ctx; if (!c) return;
    const o = c.createOscillator(); o.type = type;
    const g = c.createGain();
    const t = c.currentTime + delay;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(this.sfx);
    o.start(t); o.stop(t + dur + 0.02);
  }

  gun(id, pos) {
    const spec = [null, null, [0.16, 2600, 0.9], [0.09, 3200, 0.6], [0.32, 1400, 1.1], [0.13, 2200, 0.85], [0.6, 600, 1]][id] ?? [0.15, 2400, 0.8];
    this.noiseHit({ dur: spec[0], freq: spec[1], gain: spec[2], pos });
    this.tone({ freq: 160, to: 50, dur: spec[0] * 0.8, type: 'square', gain: 0.18 * this.atten(pos) });
  }

  explosion(pos) {
    this.noiseHit({ dur: 1.6, freq: 500, gain: 1.4, pos });
    this.tone({ freq: 90, to: 28, dur: 1.2, type: 'sine', gain: 0.7 * this.atten(pos) });
  }

  crash(impact) { this.noiseHit({ dur: 0.35, freq: 900, gain: Math.min(1, impact * 0.05) }); this.tone({ freq: 120, to: 60, dur: 0.25, type: 'square', gain: 0.15 }); }
  thud() { this.tone({ freq: 140, to: 60, dur: 0.18, type: 'sine', gain: 0.4 }); }
  punch() { this.noiseHit({ dur: 0.08, freq: 700, gain: 0.5 }); this.tone({ freq: 110, to: 70, dur: 0.1, type: 'sine', gain: 0.4 }); }
  swing() { this.noiseHit({ dur: 0.12, freq: 2200, type: 'bandpass', gain: 0.15 }); }
  door() { this.tone({ freq: 220, to: 120, dur: 0.12, type: 'square', gain: 0.1 }); }
  blip() { this.tone({ freq: 880, to: 1320, dur: 0.1, gain: 0.12 }); }
  pickup() { [660, 880, 1320].forEach((f, i) => this.tone({ freq: f, dur: 0.12, gain: 0.12, delay: i * 0.06 })); }
  deny() { this.tone({ freq: 200, dur: 0.18, type: 'square', gain: 0.1 }); }
  ability() { this.tone({ freq: 440, to: 1760, dur: 0.3, type: 'triangle', gain: 0.15 }); }
  wantedUp() { [520, 390].forEach((f, i) => this.tone({ freq: f, dur: 0.18, type: 'square', gain: 0.08, delay: i * 0.12 })); }
  jingle() { [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.22, type: 'triangle', gain: 0.14, delay: i * 0.11 })); }
  wasted() { this.tone({ freq: 300, to: 60, dur: 1.6, type: 'sawtooth', gain: 0.15 }); }

  update() {
    const c = this.ctx; if (!c) return;
    const g = this.game, v = g.player.vehicle, t = c.currentTime;
    if (v && g.mode === 'play') {
      const sp = Math.abs(v.speed), max = v.spec.maxSpeed;
      const gear = Math.min(4, Math.floor(sp / (max / 5)));
      const rpm = 0.25 + (sp / (max / 5) - gear) * 0.75;
      const f = 38 + gear * 6 + rpm * 70;
      this.eng1.frequency.setTargetAtTime(f, t, 0.05);
      this.eng2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
      this.engFilter.frequency.setTargetAtTime(300 + rpm * 900, t, 0.05);
      this.engGain.gain.setTargetAtTime(0.09, t, 0.1);
    } else this.engGain.gain.setTargetAtTime(0, t, 0.2);
    // nearest siren
    let nd = Infinity;
    if (g.wanted.stars > 0) for (const u of g.police.units) nd = Math.min(nd, u.v.pos.distanceTo(g.camera.position));
    if (nd < 160 && g.mode === 'play') {
      const wail = 650 + 350 * Math.sin(t * 2.6 * Math.PI / 2);
      this.sir.frequency.setTargetAtTime(wail, t, 0.03);
      this.sirGain.gain.setTargetAtTime(0.09 / (1 + nd / 25), t, 0.1);
    } else this.sirGain.gain.setTargetAtTime(0, t, 0.3);
  }
}
