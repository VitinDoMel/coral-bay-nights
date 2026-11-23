// Deterministic screenshot staging for `?shot=<name>&seed=N`: each stage builds a real game
// situation with the game's own systems (fixed time steps, seeded randomness), frames the
// camera, renders once and flags window.__shotReady for tools/shoot.mjs.
import * as THREE from 'three';
import { STORY } from './missions/story-missions.js';
import { saveGame } from './state/save.js';

const DT = 1 / 30;

function run(game, frames, keys = []) {
  for (let i = 0; i < frames; i++) {
    for (const k of keys) game.input.keys.add(k);
    game.step(DT);
    game.input.endFrame();
  }
  game.input.keys.clear();
}

/** Put the game into play with a story mission running at a given step. */
function startMission(game, id, step) {
  game.progress.story = id - 1;
  game.enterPlay();
  const m = game.missions;
  m.startMarker?.dispose(); m.startMarker = null;
  m.active = { def: STORY[id - 1], stepIndex: step - 2, m: {}, timer: null };
  m.advance();
}

function kit(game) {
  const a = game.arsenal;
  a.give(1); a.give(3, 90); a.give(4, 12); a.give(5, 60);
  game.progress.money = 18450;
  game.progress.respect = 520;
  game.progress.stashes = new Set([0, 3, 5, 8, 10]);
  game.progress.bestRace = 71.4;
  game.player.armor = 45;
}

const STAGES = {
  chase(game) {
    game.world.lockedDusk = 0.8;
    game.populate(150, -40);
    kit(game);
    game.arsenal.select(5);
    startMission(game, 5, 2);
    const v = game.vehicles.spawn(0, '#ff2f6d', 'civ', 227.6, 20, Math.PI);
    game.vehicles.enter(v);
    game.wanted.minLock = 3; game.wanted.set(3);
    game.police.spawnUnit(226.5, 34, Math.PI);
    game.police.spawnUnit(230.5, 40, Math.PI);
    game.police.spawnUnit(226, 49, Math.PI);
    game.police.spawnUnit(229, 60, Math.PI);
    // accelerate, then a handbrake swerve that lays real tyre marks, then straighten out
    run(game, 26, ['KeyW']);
    run(game, 7, ['KeyW', 'KeyD', 'Space']);
    run(game, 9, ['KeyW', 'KeyA', 'Space']);
    run(game, 6, ['KeyW', 'KeyD']);
    v.heading = Math.PI; v.pos.x = 227.6;
    const sp = Math.hypot(v.vx, v.vz); v.vx = 0; v.vz = -sp;
    run(game, 10, ['KeyW']);
    v.health = 74;
    const c = v.pos;
    // car-local frame: f = forward, r = screen-right of the driver
    const f = { x: Math.sin(v.heading), z: Math.cos(v.heading) }, r = { x: -Math.cos(v.heading), z: Math.sin(v.heading) };
    const at = (ox, back, y = 0) => new THREE.Vector3(c.x + r.x * ox - f.x * back, y, c.z + r.z * ox - f.z * back);
    // close the formation: the lead cruiser is ramming the bumper, the rest fan out behind
    const offsets = [[0.6, 4.9, 0.06, 4], [-2.6, 12, -0.08, 0], [1.6, 19, 0.04, 0], [-2.2, 28, 0, 0]];
    game.police.units.forEach((u, i) => {
      const [ox, back, rot, extra] = offsets[i] ?? [0, 40, 0, 0];
      const p = at(ox, back);
      u.v.place(p.x, p.z, v.heading + rot);
      u.v.vx = v.vx + f.x * extra; u.v.vz = v.vz + f.z * extra;
      u.deployed = false;
    });
    for (const cop of game.police.cops) cop.remove = true;
    // a wreck the pursuit already caused, burning on the shoulder
    const wp = at(-7.5, 17);
    const wreck = game.vehicles.spawn(2, '#2b59c3', 'civ', wp.x, wp.z, Math.PI * 0.8);
    wreck.health = 10; wreck.keep = true;
    for (let i = 0; i < 45; i++) { wreck.updateDamageFx(DT, game.fx); game.fx.update(DT); }
    wreck.burnT = 0;
    run(game, 4, ['KeyW']);
    // frame: ahead and to the left of the car, looking back at the pursuit and the helicopter
    const h = game.police.heli;
    if (h) {
      h.pos.copy(at(3.5, 31, 14.5));
      h.aim.copy(at(0.3, 2));
      h.angle = 0;
      h.update(0, c, 3);
    }
    game.cam.setPose(at(-4.8, -13, 6.2), at(0.6, 13, 2.6));
    game.camera.fov = 60; game.camera.updateProjectionMatrix();
    game.hud.update(0);
  },

  foot(game) {
    game.world.lockedDusk = 0.3;
    game.populate(-40, -40);
    kit(game);
    game.arsenal.select(5);
    startMission(game, 4, 4);
    const p = game.player;
    p.place(-10, -40, Math.PI / 2 + 0.25);
    game.wanted.set(2);
    game.police.spawnUnit(12, -28.5, -Math.PI / 2 - 0.5);
    game.police.spawnUnit(15, -41, -Math.PI / 2 + 0.7);
    const u = game.police.units;
    for (const unit of u) unit.deployed = true;
    game.police.spawnCop(2.5, -31.5, u[0]);
    game.police.spawnCop(1, -36.5, u[0]);
    game.police.spawnCop(4.5, -42.5, u[1]);
    game.cam.yaw = Math.PI / 2 + 0.1;
    game.cam.pitch = 0.1;
    game.input.rightDown = true;
    run(game, 14);
    game.dialogue.say('nina', 'Their radios are mine for sixty seconds. Break the line of sight and they\'ll lose you!', 60);
    run(game, 8);
    game.input.mouseDown = true;
    for (let i = 0; i < 3; i++) { game.input.clicked = true; run(game, 3); }
    game.input.mouseDown = false;
    // pull the camera back to a wider three-quarter view while Rafa keeps the pistol up
    game.input.rightDown = false;
    game.cam.yaw = p.heading - 0.5;
    game.cam.pitch = 0.16;
    run(game, 23);
    for (const cop of game.police.cops) cop.cool = 0; // everyone pulls the trigger on the last frame
    run(game, 1);
    p.aiming = true; p.hitFlash = 0;
    p.syncModel(5, 0.05, game.time);
    game.hud.update(0);
  },

  map(game) {
    game.world.lockedDusk = 0.3;
    game.populate(0, 0);
    kit(game);
    game.progress.story = 2;
    game.enterPlay();
    game.missions.refreshStartMarker();
    game.player.place(150, -30, Math.PI / 2);
    run(game, 3);
    game.missions.routeT = 0;
    run(game, 2);
    game.openMap();
    game.bigmap.view = { cx: 230, cz: -35, scale: 1.0 };
    game.bigmap.renderSide();
    game.bigmap.draw();
  },

  /** Development check: play the real loop for a while and log what happened. */
  smoke(game) {
    game.populate(0, 0);
    game.newGame();
    const log = (...a) => console.log('[smoke]', ...a);
    run(game, 60, ['KeyW']);
    log('walked to', game.player.pos.x.toFixed(1), game.player.pos.z.toFixed(1), 'dialogue', game.dialogue.busy);
    const v = game.vehicles.list.find((c) => c.driver === 'ai') ?? game.vehicles.list[0];
    game.player.place(v.pos.x + 2.5, v.pos.z, 0);
    game.input.tapped.add('KeyF'); run(game, 1);
    log('in car', !!game.player.vehicle, game.player.vehicle?.spec.name);
    run(game, 90, ['KeyW']); run(game, 30, ['KeyW', 'KeyD']); run(game, 20, ['Space', 'KeyA', 'KeyW']);
    log('car at', game.player.pos.x.toFixed(1), game.player.pos.z.toFixed(1), 'speed', game.player.vehicle?.speed.toFixed(1), 'health', game.player.vehicle?.health.toFixed(0));
    game.input.tapped.add('KeyQ'); run(game, 1);
    log('radio', game.radio.current.name);
    for (let i = 0; i < 40 && Math.abs(game.player.vehicle?.speed ?? 0) > 1; i++) run(game, 1, ['KeyS']);
    game.input.tapped.add('KeyF'); run(game, 1);
    log('on foot', !game.player.vehicle);
    game.arsenal.select(2);
    for (let i = 0; i < 6; i++) { game.input.clicked = true; game.input.mouseDown = true; run(game, 9); }
    game.input.mouseDown = false;
    log('stars', game.wanted.stars, 'units', game.police.units.length, 'clip', game.arsenal.clip[2]);
    run(game, 300);
    log('after 10s: stars', game.wanted.stars, 'units', game.police.units.length, 'cops', game.police.cops.length, 'heli', !!game.police.heli, 'health', game.player.health.toFixed(0), 'dead', game.player.dead);
    game.wanted.set(4);
    for (let s = 0; s < 4; s++) {
      run(game, 150);
      const near = Math.min(...game.police.units.map((u) => u.v.pos.distanceTo(game.player.pos)));
      log(`4 stars ${(s + 1) * 5}s: units`, game.police.units.length, 'nearest', near.toFixed(0), 'cops', game.police.cops.length, 'heli', !!game.police.heli, 'health', game.player.health.toFixed(0), 'dead', game.player.dead);
    }
    // walk into mission 1
    game.wanted.clear(); game.police.reset();
    game.player.dead = false; game.player.health = 100;
    const s = game.missions.next.start;
    game.player.place(s.x, s.z, 0);
    run(game, 5);
    log('mission active', game.missions.active?.def.title, 'intro', game.missions.introPlaying);
    for (let i = 0; i < 6; i++) { game.input.tapped.add('Enter'); run(game, 2); }
    log('objective', game.missions.hudInfo().objective, 'target', JSON.stringify(game.missions.target()));
    game.openMap(); game.bigmap.draw(); game.closeMap();
    game.shop.open(); game.shop.close();
    log('done, fps-free run ok');
  },

  title(game) {
    game.world.lockedDusk = 0.72;
    game.populate(60, 0);
    // a real save so CONTINUE shows progress
    game.progress.story = 3; game.progress.money = 12840;
    saveGame(game);
    game.mode = 'title';
    game.menu.title();
    game.titleAngle = 0.55;
    run(game, 20);
  },
};

export function stageShot(game, name) {
  (STAGES[name] ?? STAGES.title)(game);
  const hide = new URLSearchParams(location.search).get('hide'); // debugging: hide=neon|props|signs
  if (hide) game.scene.traverse((o) => {
    if (!o.isMesh) return;
    if (hide === 'neon' && o.material.isMeshBasicMaterial && o.material.vertexColors) o.visible = false;
    if (hide === 'props' && o.isInstancedMesh) o.visible = false;
    if (hide === 'signs' && o.geometry.type === 'PlaneGeometry') o.visible = false;
  });
  game.render();
  requestAnimationFrame(() => {
    game.render();
    requestAnimationFrame(() => { window.__shotReady = true; });
  });
}
