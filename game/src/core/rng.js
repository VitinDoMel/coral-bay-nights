// Seeded random numbers: every random choice in the game goes through here so that
// `?seed=N` (and the screenshot staging) reproduces the same city and the same scene.

let state = 1;

export function setSeed(seed) {
  state = (seed >>> 0) || 1;
}

export function rand() {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const range = (a, b) => a + (b - a) * rand();
export const irange = (a, b) => Math.floor(range(a, b + 1));
export const pick = (arr) => arr[Math.floor(rand() * arr.length)];
export const chance = (p) => rand() < p;

/** Independent generator for layout work that must not shift with gameplay randomness. */
export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => Math.floor(a + (b - a + 1) * next()),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}
