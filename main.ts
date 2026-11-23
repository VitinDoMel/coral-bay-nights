// HEATWAVE: Coral Vista — hand-in program for the gta6-01 bounty (Node 22, standard library only).
// The game is game/: an original open-world crime game in three.js (vendored as
// game/vendor/three.module.min.js), plain static files that run offline in desktop Chrome.
// This program copies game/ and screenshots/ to /output and writes /output/dossier.json with
// the kit's buildDossier, unchanged, so both runs produce identical bytes.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Screenshots: `node tools/shoot.mjs` renders every entry of shots.json headless.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail loudly (instead of handing in a broken entry) if the game or screenshots are missing.
for (const required of ['game/index.html', 'game/vendor/three.module.min.js']) {
  if (!existsSync(join(here, required))) throw new Error(`missing ${required}`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
