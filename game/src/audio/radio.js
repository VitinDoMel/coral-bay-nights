// In-car radio: four original stations with procedurally sequenced music (WebAudio synths
// on a look-ahead scheduler): chord pads, bass, arpeggios and drums, each station with its
// own tempo, scale, groove and track list. Q switches station while driving.

export const STATIONS = [
  { name: 'OFF' },
  { name: 'CORAL FM', freq: '101.3 FM', genre: 'Synthwave', dj: 'DJ Marea', color: '#ff3fa4', bpm: 100, root: 45, prog: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], arp: true, wave: 'sawtooth', kick: [0, 8], snare: [4, 12], hat: 2,
    tracks: ['Night Shift on Seabreeze', 'Neon Undertow', 'Coral Heart (Extended)', 'Last Bridge Out'] },
  { name: 'BAHÍA', freq: '94.7 FM', genre: 'Latin House', dj: 'Sol Naciente', color: '#ffb02e', bpm: 122, root: 50, prog: [[0, 3, 7], [5, 8, 12], [7, 10, 14], [3, 7, 10]], clave: true, wave: 'square', kick: [0, 4, 8, 12], snare: [4, 12], hat: 2, offHat: true,
    tracks: ['Calle Caliente', 'Marea Alta', 'Fuego Lento', 'Tres de la Mañana'] },
  { name: 'KTIDE', freq: '88.1 FM', genre: 'Surf Lo-Fi', dj: 'Lula Waves', color: '#2ef2ff', bpm: 82, root: 52, prog: [[0, 4, 7, 11], [-3, 0, 4, 7], [2, 5, 9, 12], [-5, -1, 2, 5]], wave: 'triangle', kick: [0, 10], snare: [4, 12], hat: 4, swing: 0.12, crackle: true,
    tracks: ['Low Tide Tapes', 'Pelican Drift', 'Saltwater Static', 'Sunburn Nap'] },
  { name: 'PULSO', freq: '99.5 FM', genre: 'Electro', dj: 'Voltaje', color: '#59e3a0', bpm: 128, root: 43, prog: [[0, 3, 7], [0, 3, 7], [-2, 2, 5], [-4, 0, 3]], arp: true, wave: 'square', kick: [0, 4, 8, 12], snare: [4, 12], hat: 1, acid: true,
    tracks: ['Grid Runner', 'Precinct Lights', 'Heat Signature', 'Chrome Palms'] },
];

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Radio {
  constructor(game) {
    this.game = game;
    this.station = 1;
    this.ctx = null;
    this.step = 0;
    this.nextT = 0;
    this.trackIdx = 0;
    this.bars = 0;
  }

  get current() { return STATIONS[this.station]; }
  get track() { const s = this.current; return s.tracks ? s.tracks[this.trackIdx % s.tracks.length] : ''; }

  attach(ctx, out) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(out);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    setInterval(() => this.schedule(), 60);
  }

  next() {
    this.station = (this.station + 1) % STATIONS.length;
    this.trackIdx = Math.floor(Math.random() * 4);
    this.step = 0;
    this.game.hud?.notify(this.station ? `📻 ${this.current.name} ${this.current.freq} · ${this.current.genre}` : '📻 Radio off', this.current.color ?? '#fff');
  }

  voice(freq, t, dur, type, gain, filter = 2400) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(f); f.connect(g); g.connect(this.out);
    o.start(t); o.stop(t + dur + 0.05);
  }

  drum(kind, t) {
    const c = this.ctx;
    if (kind === 'kick') {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.32);
      return;
    }
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter();
    const g = c.createGain();
    const dur = kind === 'snare' ? 0.18 : kind === 'clave' ? 0.05 : 0.04;
    f.type = kind === 'snare' ? 'bandpass' : 'highpass'; f.frequency.value = kind === 'snare' ? 1800 : kind === 'clave' ? 2500 : 7000;
    g.gain.setValueAtTime(kind === 'snare' ? 0.45 : kind === 'clave' ? 0.35 : 0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.out);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  schedule() {
    const c = this.ctx, g = this.game;
    if (!c) return;
    const on = this.station > 0 && g.player.vehicle && g.mode === 'play';
    const vol = g.menu?.settings.music ?? 0.6;
    this.out.gain.setTargetAtTime(on ? 0.5 : 0, c.currentTime, 0.2);
    if (!on) { this.nextT = c.currentTime + 0.05; return; }
    const s = this.current;
    const stepDur = 60 / s.bpm / 4;
    if (this.nextT < c.currentTime) this.nextT = c.currentTime + 0.05;
    while (this.nextT < c.currentTime + 0.25) {
      const st = this.step % 16, bar = Math.floor(this.step / 16);
      const t = this.nextT + (s.swing && st % 2 ? stepDur * s.swing : 0);
      const chord = s.prog[bar % s.prog.length];
      if (s.kick.includes(st)) this.drum('kick', t);
      if (s.snare.includes(st)) this.drum('snare', t);
      if (st % s.hat === 0 && (!s.offHat || st % 4 === 2)) this.drum('hat', t);
      if (s.clave && [0, 3, 6, 10, 12].includes(st)) this.drum('clave', t);
      if (st === 0) for (const n of chord) this.voice(midi(s.root + 12 + n), t, stepDur * 15, s.wave === 'triangle' ? 'triangle' : 'sawtooth', 0.045, s.crackle ? 1400 : 2200);
      if (st % 4 === 0 || (s.acid && st % 2 === 0)) this.voice(midi(s.root - 12 + chord[0] + (s.acid && st % 8 === 6 ? 12 : 0)), t, stepDur * 1.8, s.acid ? 'sawtooth' : 'square', 0.16, s.acid ? 600 + 500 * Math.sin(this.step * 0.2) : 500);
      if (s.arp) this.voice(midi(s.root + 24 + chord[st % chord.length]), t, stepDur * 0.9, s.wave, 0.05, 3000);
      else if (st % 4 === 2) this.voice(midi(s.root + 24 + chord[(st >> 2) % chord.length]), t, stepDur * 3, 'triangle', 0.06, 2600);
      if (s.crackle && Math.random() < 0.4) this.drum('hat', t + Math.random() * stepDur);
      this.nextT += stepDur;
      this.step++;
      if (this.step % (16 * 32) === 0) this.trackIdx++;
    }
    void vol;
  }

  update() {
    const g = this.game;
    if (g.player.vehicle && g.mode === 'play' && g.input.pressed('KeyQ')) this.next();
  }
}
