const ADJECTIVES = [
  'peach',
  'mint',
  'velvet',
  'sunset',
  'chrome',
  'paper',
  'lunar',
  'coral',
  'quiet',
  'glass',
  'amber',
  'soft',
  'neon',
  'dusty',
  'little',
  'brave',
  'lucky',
  'golden',
];

const NOUNS = [
  'harbor',
  'heights',
  'gardens',
  'district',
  'junction',
  'promenade',
  'quarter',
  'terrace',
  'basin',
  'arcade',
  'meadow',
  'landing',
  'row',
  'court',
  'exchange',
  'works',
  'point',
  'square',
];

export function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed: string): () => number {
  return mulberry32(hashString(seed));
}

export const MAX_SEED_LENGTH = 40;

export function normalizeSeed(value: string): string {
  return value.trim().slice(0, MAX_SEED_LENGTH);
}

export function makeSeed(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const number = Math.floor(Math.random() * 90) + 10;
  return `${adjective}-${noun}-${number}`;
}

export function dailySeed(
  date: Pick<Date, 'getFullYear' | 'getMonth' | 'getDate'> = new Date(),
): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `daily-${year}-${month}-${day}`;
}
