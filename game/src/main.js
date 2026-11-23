// Entry point: reads ?seed= and ?shot=, seeds the random generator, builds the Game and
// either starts the interactive loop or stages a deterministic screenshot scene.
import { setSeed } from './core/rng.js';
import { Game } from './game.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed')) || 1;
const shot = params.get('shot');
setSeed(seed);

const game = new Game(document.getElementById('view'), { seed, shot });
window.__game = game;

if (shot) {
  import('./shots.js').then((m) => m.stageShot(game, shot));
} else {
  game.populate(60, 0);
  game.mode = 'title';
  game.menu.title();
  game.start();
}
