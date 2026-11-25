import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { City } from './city';
import type { Block } from './city';
import { TABLE } from './config';

// City paints its CanvasTextures in the constructor, but the layout is pure math.
// A no-op 2D context lets the real generator run under Node without a browser.
function makeFakeContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => {} };

  return new Proxy({} as CanvasRenderingContext2D, {
    get(target, property) {
      if (property === 'createLinearGradient' || property === 'createRadialGradient') {
        return () => gradient;
      }
      if (property === 'measureText') {
        return () => ({ width: 0 });
      }
      if (property in target) {
        return Reflect.get(target, property);
      }
      return () => undefined;
    },
    set(target, property, value) {
      return Reflect.set(target, property, value);
    },
  });
}

function makeFakeCanvas(): HTMLCanvasElement {
  const context = makeFakeContext();

  return {
    width: 0,
    height: 0,
    getContext: () => context,
  } as unknown as HTMLCanvasElement;
}

beforeAll(() => {
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      if (tag !== 'canvas') throw new Error(`Unexpected element: ${tag}`);
      return makeFakeCanvas();
    },
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function layoutKey(blocks: Block[]): string {
  return blocks
    .map((block) =>
      [
        block.kind,
        block.gx,
        block.gz,
        round(block.center.x),
        round(block.center.z),
        round(block.size.x),
        round(block.size.y),
        block.maxHealth,
      ].join(':'),
    )
    .join('|');
}

function hash(value: string): string {
  let result = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index++) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, '0');
}

describe('seeded city layout', () => {
  // Update these hashes only when a layout change is intentional. An unexpected
  // change means an rng() call moved, which rewrites every shared seed.
  it('pins the layout contract for known seeds', () => {
    const city = new City(new THREE.Scene());

    city.regenerate('peach-harbor-42');
    expect(city.blocks.length).toBeGreaterThan(0);
    expect(hash(layoutKey(city.blocks))).toBe('30cf3099');

    city.regenerate('mint-basin-10');
    expect(city.blocks.length).toBeGreaterThan(0);
    expect(hash(layoutKey(city.blocks))).toBe('d551c278');
  });

  it('rebuilds the same layout for the same seed', () => {
    const first = new City(new THREE.Scene());
    const second = new City(new THREE.Scene());

    first.regenerate('chrome-heights-77');
    const firstLayout = layoutKey(first.blocks);
    second.regenerate('chrome-heights-77');

    expect(layoutKey(second.blocks)).toBe(firstLayout);
    expect(layoutKey(first.blocks)).toBe(firstLayout);

    first.regenerate('chrome-heights-77');
    expect(layoutKey(first.blocks)).toBe(firstLayout);
  });

  it('keeps every generated block inside the table walls', () => {
    const city = new City(new THREE.Scene());

    for (const seed of [
      'quiet-row-33',
      'peach-harbor-42',
      'mint-basin-10',
      'chrome-heights-77',
      'daily-2026-11-26',
    ]) {
      city.regenerate(seed);

      expect(city.blocks.length, seed).toBeGreaterThan(0);
      for (const block of city.blocks) {
        expect(block.active, seed).toBe(true);
        expect(block.health, seed).toBe(block.maxHealth);
        expect(block.min.x, seed).toBeGreaterThan(-TABLE.halfWidth);
        expect(block.max.x, seed).toBeLessThan(TABLE.halfWidth);
        expect(block.min.z, seed).toBeGreaterThan(TABLE.topZ);
        expect(block.max.z, seed).toBeLessThan(TABLE.bottomZ);
        expect(block.min.y, seed).toBe(0);
        expect(block.max.y, seed).toBeCloseTo(block.size.y);
      }
    }
  });
});
