// The five story missions of HEATWAVE: Rafa Sol owes Los Manta $50,000 for a getaway that
// went wrong; Nina Vega finds the jobs that pay it off. Each mission is data (title, giver,
// intro/outro dialogue, reward) plus steps with a setup, a per-frame check and a target.
import { POI, roadPoint, blockAt, ISLAND_HUB, NODES, BRIDGE, MARINA } from '../world/layout.js';
import { GangMember } from './gang.js';

const near = (g, x, z, r) => {
  const f = g.player.vehicle ? g.player.vehicle.pos : g.player.pos;
  return Math.hypot(f.x - x, f.z - z) < r;
};

export const STORY = [
  {
    id: 1, title: 'Candy Paint', start: POI.loft,
    intro: [
      ['nina', 'Rafa. You look like a man who owes Los Manta fifty grand.'],
      ['rafa', 'Forty-nine. I paid the interest in bruises.'],
      ['nina', 'Don Marlon wants a yellow Vortex GT. One just parked on Seabreeze Boulevard. Alarm is mine — the wheel is yours.'],
    ],
    outro: [['marlon', 'Pretty paint, Sol. Consider two grand off the tab. Don\'t get comfortable.']],
    reward: { money: 1500, rp: 60 },
    steps: [
      {
        text: 'Steal the yellow Vortex GT on Seabreeze Blvd',
        setup(ctx) {
          const g = ctx.game;
          ctx.m.car = g.vehicles.spawn(0, '#ffd23f', 'target', 228, -64, Math.PI);
          ctx.m.car.keep = true;
        },
        target: (ctx) => ctx.m.car.pos,
        update(ctx) {
          if (ctx.m.car.dead) return 'fail:The Vortex was wrecked';
          if (ctx.game.player.vehicle === ctx.m.car) { ctx.game.wanted.set(Math.max(1, ctx.game.wanted.stars)); return 'done'; }
          return null;
        },
      },
      {
        text: 'Deliver the Vortex GT to Manta Motors',
        target: () => POI.garage,
        update(ctx) {
          const g = ctx.game;
          if (ctx.m.car.dead) return 'fail:The Vortex was wrecked';
          if (g.player.vehicle === ctx.m.car && near(g, POI.garage.x + 5, POI.garage.z, 8)) {
            if (g.wanted.stars > 0) { g.hud.notify('Lose the cops before Manta Motors opens the door', '#ff6f91'); return null; }
            g.vehicles.exit();
            return 'done';
          }
          return null;
        },
      },
    ],
  },
  {
    id: 2, title: 'Ninety Seconds', start: POI.garage,
    intro: [
      ['marlon', 'A package waits at the Port Coquina gate. My buyer in Uptown has a short temper and a shorter clock.'],
      ['nina', 'Ninety seconds from pickup, Rafa. I\'ll hold the lights green where I can.'],
    ],
    outro: [['marlon', 'On time. I like a man who respects a clock.'], ['nina', 'Two jobs down. Keep the engine warm.']],
    reward: { money: 2000, rp: 80 },
    steps: [
      { text: 'Get a car and drive to the Port Coquina gate', target: () => roadPoint(4, 6, 'n', 0.5, 4), update(ctx) { const p = roadPoint(4, 6, 'n', 0.5, 4); return ctx.game.player.vehicle && near(ctx.game, p.x, p.z, 7) ? 'done' : null; } },
      {
        text: 'Deliver the package to Uptown before time runs out', timer: 90,
        target: () => roadPoint(1, 0, 'n', 0.5, 4),
        update(ctx) { const p = roadPoint(1, 0, 'n', 0.5, 4); return near(ctx.game, p.x, p.z, 7) ? 'done' : null; },
      },
    ],
  },
  {
    id: 3, title: 'Bumper Kiss', start: POI.loft,
    intro: [
      ['nina', 'A Barracuda courier is driving our ledger around in a purple Tarpon. They know the cameras are mine.'],
      ['rafa', 'So we do this the old-fashioned way.'],
      ['nina', 'Ram it until it quits. Gently. Ish.'],
    ],
    outro: [['nina', 'Ledger recovered. And you only took out four mailboxes.'], ['marlon', 'The Barracudas will remember this. Good.']],
    reward: { money: 2500, rp: 100 },
    steps: [
      { text: 'Get a car', update: (ctx) => (ctx.game.player.vehicle ? 'done' : null), target: () => null },
      {
        text: 'Catch the purple Tarpon and ram it until it stops',
        setup(ctx) {
          const g = ctx.game;
          const f = g.player.vehicle.pos;
          const cands = NODES.filter((n) => { const d = Math.hypot(n.x - f.x, n.z - f.z); return d > 60 && d < 120 && Math.abs(n.x) < 200 && Math.abs(n.z) < 200; });
          const n = cands[0] ?? NODES[20];
          const i = Math.round((n.x + 224) / 64), j = Math.round((n.z + 224) / 64);
          const v = g.traffic.spawnCar(Math.min(6, Math.max(0, i)), Math.min(6, Math.max(0, j)), [1, 0], 2, '#8a2be2', 'target');
          v.kind = 'target';
          v.ai.cruise = 19;
          v.ai.panic = 999;
          v.keep = true;
          v.health = 100;
          ctx.m.target = v;
        },
        target: (ctx) => ctx.m.target.pos,
        update(ctx) {
          const v = ctx.m.target;
          if (v.health <= 25 || v.dead) {
            v.ai = null; v.driver = null; ctx.game.traffic.release(v);
            v.vx *= 0.3; v.vz *= 0.3;
            return 'done';
          }
          if (Math.hypot(v.pos.x - ctx.game.player.pos.x, v.pos.z - ctx.game.player.pos.z) > 220) return 'fail:The courier got away';
          return null;
        },
        onRam(ctx, other, impact) { if (other === ctx.m.target) { other.damage(impact * 1.6); ctx.game.hud.notify(`Courier hit · ${Math.ceil(other.health)}%`, '#ff9d2e'); } },
      },
      { text: 'Grab the ledger from the Tarpon', target: (ctx) => ctx.m.target.pos, update(ctx) { const v = ctx.m.target.pos; return !ctx.game.player.vehicle && near(ctx.game, v.x, v.z, 4) ? 'done' : null; } },
    ],
  },
  {
    id: 4, title: 'Dockside Fireworks', start: POI.garage,
    intro: [
      ['marlon', 'The Barracudas keep a cash case in a container at Port Coquina. They will not hand it over.'],
      ['rafa', 'They never do.'],
      ['nina', 'Seven shooters behind the boxes. Take the Ripcurl from Marlon\'s trunk — it\'s already in your rack.'],
    ],
    outro: [['marlon', 'Thirty thousand. Sol, you might live to see the bridge.'], ['nina', 'One more job and you\'re free. I\'ll call you at the loft.']],
    reward: { money: 4000, rp: 140 },
    steps: [
      {
        text: 'Go to the container yard at Port Coquina',
        setup(ctx) { ctx.game.arsenal.give(3, 120); ctx.game.arsenal.select(3); },
        target: () => roadPoint(5, 6, 'n', 0.5, 2),
        update(ctx) { const b = blockAt(5, 6); return near(ctx.game, (b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, 40) ? 'done' : null; },
      },
      {
        text: 'Take out the Barracuda crew (0/7)',
        setup(ctx) {
          const g = ctx.game;
          const spots = [[4, 6, 0.2, 0.3], [4, 6, 0.7, 0.6], [5, 6, 0.3, 0.4], [5, 6, 0.6, 0.8], [5, 6, 0.85, 0.3], [6, 6, 0.3, 0.5], [6, 6, 0.6, 0.7]];
          ctx.m.enemies = spots.map(([bx, bz, tx, tz], i) => {
            const b = blockAt(bx, bz);
            const e = new GangMember(g, b.minX + (b.maxX - b.minX) * tx, b.minZ + (b.maxZ - b.minZ) * tz, i, i % 3 === 0 ? 4 : 3);
            g.colliders.resolveCircle(e, 0.5);
            return e;
          });
          ctx.engine.enemies = ctx.m.enemies;
        },
        target: (ctx) => ctx.m.enemies.find((e) => e.alive) ?? null,
        update(ctx) {
          const dead = ctx.m.enemies.filter((e) => !e.alive).length;
          ctx.step.text = `Take out the Barracuda crew (${dead}/7)`;
          return dead === 7 ? 'done' : null;
        },
      },
      {
        text: 'Grab the cash case',
        target: () => { const b = blockAt(5, 6); return { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 }; },
        update(ctx) { const b = blockAt(5, 6); if (near(ctx.game, (b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, 3)) { ctx.game.wanted.set(2); return 'done'; } return null; },
      },
      { text: 'The CVPD heard the fireworks — lose them', target: () => null, update: (ctx) => (ctx.game.wanted.stars === 0 ? 'done' : null) },
    ],
  },
  {
    id: 5, title: 'Last Bridge Out', start: POI.loft,
    intro: [
      ['nina', 'Bad news first: somebody sold your name to the CVPD. Every cruiser in Coral Vista has your plate.'],
      ['marlon', 'Good news: your debt is paid if you deliver the last case to my boat on Heron Key.'],
      ['rafa', 'Across the only bridge. With half the police force behind me.'],
      ['nina', 'I\'ll talk you through it. Drive, Rafa. Don\'t stop.'],
    ],
    outro: [
      ['marlon', 'Debt clear. Los Manta forgets your name, Rafa Sol.'],
      ['nina', 'Sunset, an island and nobody chasing you. Want to stay retired?'],
      ['rafa', 'Ask me tomorrow.'],
    ],
    reward: { money: 10000, rp: 300 },
    steps: [
      { text: 'Get a fast car', update: (ctx) => (ctx.game.player.vehicle ? 'done' : null), target: () => null },
      {
        text: "Escape across Heron Bridge to Don Marlon's yacht at Heron Key Marina",
        setup(ctx) { ctx.game.wanted.set(4); ctx.game.wanted.minLock = 4; },
        target: (ctx) => (ctx.game.player.pos.x > BRIDGE.x1 - 40 ? { x: MARINA.yacht.x, z: MARINA.z } : NODES[ISLAND_HUB]),
        update(ctx) {
          const f = ctx.game.player.vehicle ? ctx.game.player.vehicle.pos : ctx.game.player.pos;
          if (Math.hypot(f.x - MARINA.yacht.x, f.z - MARINA.z) < 20) { ctx.game.wanted.minLock = 0; ctx.game.wanted.clear(); ctx.game.police.reset(); return 'done'; }
          return null;
        },
      },
    ],
  },
];
