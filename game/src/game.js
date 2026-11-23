// The Game: owns the renderer, scene and every system, and runs one simulation step per
// frame in a fixed order (input -> player/vehicles -> AI -> police -> missions -> fx -> HUD).
import * as THREE from 'three';
import { Input } from './core/input.js';
import { World } from './world/world.js';
import { Player } from './player/player.js';
import { CameraRig } from './player/camera.js';
import { Effects } from './fx/particles.js';
import { SkidMarks } from './fx/skidmarks.js';
import { Vehicles } from './vehicles/vehicles.js';
import { Traffic } from './traffic/traffic.js';
import { Peds } from './peds/peds.js';
import { Arsenal, playerFire } from './player/weapons.js';
import { Combat } from './combat/combat.js';
import { Wanted } from './police/wanted.js';
import { Police } from './police/police.js';
import { Progress } from './state/progress.js';
import { POI } from './world/layout.js';
import { Hud } from './ui/hud.js';
import { Dialogue } from './story/dialogue.js';
import { Missions } from './missions/missions.js';
import { Crew } from './crew/crew.js';
import { Shop } from './ui/shop.js';
import { BigMap } from './ui/bigmap.js';
import { Menu } from './ui/menu.js';
import { Audio } from './audio/audio.js';
import { Radio } from './audio/radio.js';
import { loadGame } from './state/save.js';

export class Game {
  constructor(container, { seed = 1, shot = null } = {}) {
    this.seed = seed;
    this.shot = shot;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!shot, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(shot ? 1 : Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 4000);
    this.input = new Input(this.renderer.domElement);
    this.world = new World(this.scene, seed);
    this.colliders = this.world.colliders;
    this.fx = new Effects(this.scene);
    this.fx.setViewport(innerHeight);
    this.skids = new SkidMarks(this.scene);
    this.player = new Player(this.scene);
    this.cam = new CameraRig(this.camera);
    this.vehicles = new Vehicles(this);
    this.traffic = new Traffic(this);
    this.peds = new Peds(this);
    this.arsenal = new Arsenal();
    this.combat = new Combat(this);
    this.wanted = new Wanted(this);
    this.police = new Police(this);
    this.progress = new Progress(this);
    this.hud = new Hud(this);
    this.dialogue = new Dialogue(this);
    this.crew = new Crew(this);
    this.missions = new Missions(this);
    this.shop = new Shop(this);
    this.bigmap = new BigMap(this);
    this.radio = new Radio(this);
    this.audio = new Audio(this);
    this.menu = new Menu(this);
    this.time = 0;
    this.mode = 'title'; // title | play | pause | map | shop
    this.timeScale = 1;
    this.respawnT = 0;
    this.titleAngle = 0.6;

    addEventListener('resize', () => this.resize());
    addEventListener('keydown', (e) => this.onKey(e));
    // Esc while the pointer is locked only releases the lock: treat that as pause
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.mode === 'play' && !this.shot) this.pause();
    });
  }

  onKey(e) {
    if (e.code === 'Escape') {
      if (this.mode === 'play') this.pause();
      else if (this.mode === 'pause' && this.menu.page === 'pause') this.resume();
      else if (this.mode === 'map') this.closeMap();
    }
    if (e.code === 'KeyM') {
      if (this.mode === 'play') this.openMap();
      else if (this.mode === 'map') this.closeMap();
    }
  }

  /** Start the session: markers, HUD and the player at Nina's Loft. */
  enterPlay() {
    this.menu.hide();
    this.hud.show(true);
    this.missions.activities.init();
    this.missions.refreshStartMarker();
    this.mode = 'play';
    this.renderer.shadowMap.enabled = this.menu.settings.shadows;
    this.audio.setVolume(this.menu.settings.volume, this.menu.settings.music);
    this.input.lock();
  }

  newGame() {
    this.audio.unlock();
    this.player.place(POI.loft.x - 8, POI.loft.z + 3, -Math.PI / 2);
    this.cam.yaw = -Math.PI / 2;
    this.enterPlay();
    this.hud.banner('HEATWAVE', 'Coral Vista · 6:40 PM', '#ff6f91', 3);
    this.dialogue.scene([
      ['nina', 'Rafa Sol, back in Coral Vista. Don Marlon knows you\'re here — and he wants his money.'],
      ['rafa', 'Fifty thousand for one bad getaway. Fine. Where do I start?'],
      ['nina', 'My loft. The yellow marker. Steal a ride on the way if you like — I won\'t tell.'],
    ]);
  }

  continueGame() {
    this.audio.unlock();
    if (!loadGame(this)) return;
    this.enterPlay();
    this.missions.activities.resetStashes();
    this.hud.banner('WELCOME BACK', `Story ${this.progress.story}/5 · Rank ${this.progress.rankIndex + 1}`, '#b08cff', 2.5);
  }

  pause() {
    this.mode = 'pause';
    this.input.unlock();
    this.menu.pause();
  }

  resume() {
    this.menu.hide();
    this.mode = 'play';
    this.input.lock();
  }

  openMap() {
    this.mode = 'map';
    this.bigmap.open();
  }

  closeMap() {
    this.bigmap.close();
    this.mode = 'play';
    this.input.lock();
  }

  /** Slow aerial orbit for the title screen. */
  titleCamera(dt) {
    this.titleAngle += dt * 0.03;
    const r = 330, cx = 60, cz = 0;
    this.camera.position.set(cx + Math.cos(this.titleAngle) * r, 120, cz + Math.sin(this.titleAngle) * r);
    this.camera.lookAt(cx + 40, 0, cz);
  }

  /** Populate the streets; called once for a new or loaded game. */
  populate(fx = 0, fz = 0) {
    this.vehicles.spawnParked(34);
    this.traffic.populate(38, fx, fz);
    this.peds.populate(56);
  }

  resize() {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.fx.setViewport(innerHeight);
  }

  /** Read driving controls from the keyboard. */
  driveControls() {
    const i = this.input;
    return {
      throttle: i.axis('KeyS', 'KeyW') || i.axis('ArrowDown', 'ArrowUp'),
      steer: i.axis('KeyA', 'KeyD') || i.axis('ArrowLeft', 'ArrowRight'),
      handbrake: i.down('Space'),
    };
  }

  handleInteract() {
    const p = this.player;
    if (!this.input.pressed('KeyF') || p.dead) return;
    if (p.vehicle) this.vehicles.exit();
    else {
      const v = this.vehicles.nearestEnterable(p.pos.x, p.pos.z);
      if (v) this.vehicles.enter(v);
    }
  }

  get weaponId() { return this.arsenal.current; }

  handleWeapons() {
    const i = this.input, a = this.arsenal;
    for (let k = 1; k <= 7; k++) if (i.pressed('Digit' + k)) a.select(k - 1);
    if (i.wheel) a.cycle(i.wheel > 0 ? 1 : -1);
    if (i.pressed('KeyR')) a.startReload();
    if (this.player.vehicle || this.player.dead) return;
    const w = a.trigger(i.mouseDown && i.locked !== false, i.clicked);
    if (w) playerFire(this, w);
  }

  onPlayerDeath() {
    if (this.player.dead) return;
    this.player.dead = true;
    if (this.player.vehicle) this.vehicles.exit();
    this.respawnT = 4;
    this.respawnAt = POI.hospital;
    this.hud?.banner('WASTED', 'Patched up at Vista General · -$500', '#ff3b5c');
    this.missions?.fail('You were wasted');
    this.audio?.wasted();
  }

  onBusted() {
    if (this.player.dead) return;
    this.player.dead = true;
    this.player.busted = true;
    this.respawnT = 4;
    this.respawnAt = POI.precinct;
    this.hud?.banner('BUSTED', 'Released from the CVPD Precinct · -$500', '#4f8dff');
    this.missions?.fail('You got busted');
    this.audio?.wasted();
  }

  respawn() {
    const p = this.player, at = this.respawnAt;
    if (p.vehicle) this.vehicles.exit();
    p.dead = false; p.busted = false;
    p.health = 100; p.armor = 0;
    p.place(at.x, at.z, 0);
    this.progress.addMoney(-500);
    this.wanted.minLock = 0;
    this.wanted.clear();
    this.police.reset();
    if (this.player.vehicle) this.player.vehicle = null;
  }

  step(dt) {
    if (this.mode === 'pause') return;
    if (this.mode === 'map') { this.bigmap.update(); return; }
    if (this.mode === 'shop') { this.shop.update(); return; }
    this.time += dt;
    const p = this.player;
    if (this.mode === 'play') {
      if (p.dead) {
        this.respawnT -= dt;
        if (this.respawnT <= 0) this.respawn();
      } else {
        this.handleInteract();
        this.handleWeapons();
      }
      if (p.vehicle) {
        p.vehicle.drive(dt, p.dead ? { throttle: 0, steer: 0, handbrake: true } : this.driveControls(), this.colliders, this.fx, this.skids);
        p.pos.copy(p.vehicle.pos);
        p.heading = p.vehicle.heading;
      } else if (!p.dead) {
        p.updateOnFoot(dt, this.input, this.cam, this.colliders, this.weaponId);
      }
      this.arsenal.update(dt);
    }
    // parked / abandoned cars still coast and get pushed around
    for (const v of this.vehicles.list) if (!v.driver && !v.ai && !v.dead && (Math.abs(v.vx) + Math.abs(v.vz) > 0.05)) v.drive(dt, { throttle: 0, steer: 0, handbrake: true }, this.colliders, this.fx, null);
    this.traffic.update(dt);
    this.peds.update(dt);
    this.police.update(dt);
    this.combat.update(dt);
    this.vehicles.update(dt);
    if (this.mode === 'play') {
      this.missions.update(dt);
      this.crew.update(dt);
      this.dialogue.update(dt);
      this.radio.update();
      this.cam.update(dt, this.input, p, this.colliders, this.menu.settings.sens);
      this.hud.update(dt);
    } else if (this.mode === 'title') this.titleCamera(dt);
    p.syncModel(this.weaponId, this.cam.pitch, this.time);
    this.fx.update(dt);
    this.audio.update();
    this.world.update(dt, this.camera, this.mode === 'title' ? { x: 60, z: 0 } : p.vehicle ? p.vehicle.pos : p.pos);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  start() {
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000) * this.timeScale;
      last = now;
      this.step(dt);
      this.render();
      this.input.endFrame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
