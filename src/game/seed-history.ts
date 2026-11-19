import { normalizeSeed } from './rng';

export const RECENT_SEEDS_KEY = 'kaiju-pinball-recent-seeds';
export const MAX_RECENT_SEEDS = 5;

interface SeedStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): SeedStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function parseRecentSeeds(raw: string | null): string[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const seeds: string[] = [];
    for (const value of parsed) {
      if (typeof value !== 'string') continue;
      const seed = normalizeSeed(value);
      if (!seed || seeds.includes(seed)) continue;
      seeds.push(seed);
      if (seeds.length >= MAX_RECENT_SEEDS) break;
    }
    return seeds;
  } catch {
    return [];
  }
}

export function readRecentSeeds(storage: SeedStorage | null = browserStorage()): string[] {
  if (!storage) return [];

  try {
    return parseRecentSeeds(storage.getItem(RECENT_SEEDS_KEY));
  } catch {
    return [];
  }
}

export function rememberRecentSeed(
  seed: string,
  storage: SeedStorage | null = browserStorage(),
): string[] {
  const value = normalizeSeed(seed);
  if (!value) return readRecentSeeds(storage);

  const next = [value, ...readRecentSeeds(storage).filter((item) => item !== value)].slice(
    0,
    MAX_RECENT_SEEDS,
  );

  if (storage) {
    try {
      storage.setItem(RECENT_SEEDS_KEY, JSON.stringify(next));
    } catch {
      // Storage can be unavailable in private or restricted contexts.
    }
  }

  return next;
}
