// Seeded PRNG

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Seed per day and shift block
export function shiftSeed(startedAt) {
  const d = new Date(startedAt);
  const block = Math.floor(d.getHours() / 8);
  return hashString(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${block}`);
}

export function pick(rand, items) {
  return items[Math.floor(rand() * items.length) % items.length];
}

// Integer in [min, max].
export function between(rand, min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}
