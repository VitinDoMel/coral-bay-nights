// Save / load in localStorage: position, cash, respect, weapons, story progress, stashes,
// crew cooldowns and settings. One slot, written at Nina's Loft and after each mission.

const KEY = 'heatwave-coral-vista-save-v1';

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function saveInfo() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    return s ? { story: s.progress.story, money: s.progress.money, when: s.when } : null;
  } catch { return null; }
}

export function saveGame(game) {
  const p = game.player;
  const data = {
    when: Date.now(),
    pos: { x: p.pos.x, z: p.pos.z, h: p.heading },
    health: p.health, armor: p.armor,
    progress: game.progress.serialize(),
    arsenal: game.arsenal.serialize(),
    radio: game.radio?.station ?? 0,
  };
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
}

export function loadGame(game) {
  let s;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch { return false; }
  if (!s) return false;
  game.progress.load(s.progress);
  game.arsenal.load(s.arsenal);
  game.player.health = s.health ?? 100;
  game.player.armor = s.armor ?? 0;
  game.player.place(s.pos.x, s.pos.z, s.pos.h);
  game.cam.yaw = s.pos.h;
  if (game.radio && s.radio != null) game.radio.station = s.radio;
  return true;
}
