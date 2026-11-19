import { describe, expect, it } from 'vitest';
import {
  MAX_RECENT_SEEDS,
  RECENT_SEEDS_KEY,
  readRecentSeeds,
  rememberRecentSeed,
} from './seed-history';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));

  return {
    getItem: (key: string): string | null => values.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      values.set(key, value);
    },
  };
}

describe('recent seed history', () => {
  it('keeps the newest seed first', () => {
    const storage = memoryStorage();

    expect(readRecentSeeds(storage)).toEqual([]);
    expect(rememberRecentSeed('peach-harbor-42', storage)).toEqual(['peach-harbor-42']);
    expect(rememberRecentSeed('mint-basin-10', storage)).toEqual([
      'mint-basin-10',
      'peach-harbor-42',
    ]);
  });

  it('moves a replayed seed to the front without duplicating it', () => {
    const storage = memoryStorage();

    rememberRecentSeed('peach-harbor-42', storage);
    rememberRecentSeed('mint-basin-10', storage);
    rememberRecentSeed('peach-harbor-42', storage);

    expect(readRecentSeeds(storage)).toEqual(['peach-harbor-42', 'mint-basin-10']);
  });

  it('caps the history at the maximum length', () => {
    const storage = memoryStorage();

    for (let index = 0; index < MAX_RECENT_SEEDS + 3; index++) {
      rememberRecentSeed(`quiet-row-${index}`, storage);
    }

    const recent = readRecentSeeds(storage);
    expect(recent).toHaveLength(MAX_RECENT_SEEDS);
    expect(recent[0]).toBe(`quiet-row-${MAX_RECENT_SEEDS + 2}`);
  });

  it('drops malformed entries and preserves valid seeds', () => {
    const storage = memoryStorage({
      [RECENT_SEEDS_KEY]: JSON.stringify(['alpha-row-10', 42, '', 'alpha-row-10', 'beta-row-20']),
    });

    expect(readRecentSeeds(storage)).toEqual(['alpha-row-10', 'beta-row-20']);
  });

  it('falls back to an empty history for invalid storage data', () => {
    expect(readRecentSeeds(memoryStorage({ [RECENT_SEEDS_KEY]: 'not json' }))).toEqual([]);
    expect(readRecentSeeds(memoryStorage({ [RECENT_SEEDS_KEY]: '{"seed":"alpha"}' }))).toEqual([]);
  });

  it('ignores blank seeds', () => {
    const storage = memoryStorage();

    expect(rememberRecentSeed('   ', storage)).toEqual([]);
    expect(readRecentSeeds(storage)).toEqual([]);
  });

  it('survives storage failures', () => {
    const storage = {
      getItem: (): string | null => {
        throw new Error('Storage blocked');
      },
      setItem: (): void => {
        throw new Error('Storage blocked');
      },
    };

    expect(readRecentSeeds(storage)).toEqual([]);
    expect(rememberRecentSeed('quiet-row-33', storage)).toEqual(['quiet-row-33']);
  });
});
