import { describe, expect, it } from 'vitest';
import { hashString, makeSeed, mulberry32 } from './rng';

describe('seeded random generation', () => {
  it('replays the same sequence for the same seed', () => {
    const first = mulberry32(hashString('peach-harbor-42'));
    const second = mulberry32(hashString('peach-harbor-42'));

    const firstSequence = Array.from({ length: 12 }, () => first());
    const secondSequence = Array.from({ length: 12 }, () => second());

    expect(firstSequence).toEqual(secondSequence);
  });

  it('diverges for different seeds', () => {
    const first = mulberry32(hashString('peach-harbor-42'));
    const second = mulberry32(hashString('chrome-heights-77'));

    expect(first()).not.toBe(second());
  });

  it('produces values inside the unit interval', () => {
    const random = mulberry32(hashString('mint-basin-10'));

    for (let index = 0; index < 100; index++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('builds readable seeds', () => {
    expect(makeSeed()).toMatch(/^[a-z]+-[a-z]+-\d{2}$/);
  });
});
