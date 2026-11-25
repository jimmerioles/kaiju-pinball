import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { collideWithSegment, resolveSphereAABB } from './collision';
import type { CollisionResult } from './collision';

const MIN = new THREE.Vector3(-1, -1, -1);
const MAX = new THREE.Vector3(1, 1, 1);
const GUIDE_A = new THREE.Vector3(-5, 0, 0);
const GUIDE_B = new THREE.Vector3(5, 0, 0);

function makeResult(): CollisionResult {
  return { hit: false, normal: new THREE.Vector3(), depth: 0 };
}

describe('sphere against an axis aligned box', () => {
  it('reports no hit when the sphere is clear of the box', () => {
    const result = makeResult();
    const position = new THREE.Vector3(2, 0.5, 0);

    expect(resolveSphereAABB(position, 0.4, MIN, MAX, result)).toBe(false);
    expect(result.hit).toBe(false);
  });

  it('pushes out through the nearest face', () => {
    const result = makeResult();
    const position = new THREE.Vector3(1.3, 0, 0);

    expect(resolveSphereAABB(position, 0.5, MIN, MAX, result)).toBe(true);
    expect(result.normal.toArray()).toEqual([1, 0, 0]);
    expect(result.depth).toBeCloseTo(0.2);
  });

  it('uses a normalized diagonal normal at a corner', () => {
    const result = makeResult();
    const position = new THREE.Vector3(1.2, 1.2, 0);

    expect(resolveSphereAABB(position, 0.5, MIN, MAX, result)).toBe(true);
    expect(result.normal.x).toBeCloseTo(Math.SQRT1_2);
    expect(result.normal.y).toBeCloseTo(Math.SQRT1_2);
    expect(result.normal.length()).toBeCloseTo(1);
    expect(result.depth).toBeCloseTo(0.5 - Math.hypot(0.2, 0.2));
  });

  it('pushes a sphere centered inside the box out the nearest face', () => {
    const result = makeResult();
    const position = new THREE.Vector3(0, 0.9, 0);

    expect(resolveSphereAABB(position, 0.5, MIN, MAX, result)).toBe(true);
    expect(result.normal.toArray()).toEqual([0, 1, 0]);
    expect(result.depth).toBeCloseTo(0.6);
  });
});

describe('ball against a guide segment', () => {
  it('ignores a zero length segment', () => {
    const position = new THREE.Vector3(0, 0, 0.5);
    const velocity = new THREE.Vector3(0, 0, -1);
    const point = new THREE.Vector3(0, 0, 0);
    const inside = new THREE.Vector3(0, 0, -1);

    expect(collideWithSegment(position, velocity, point, point.clone(), inside, 0.3, 0.5)).toBe(0);
    expect(position.toArray()).toEqual([0, 0, 0.5]);
    expect(velocity.toArray()).toEqual([0, 0, -1]);
  });

  it('ignores a ball that is clear of the guide', () => {
    const position = new THREE.Vector3(0, 0, 2);
    const velocity = new THREE.Vector3(0, 0, -1);
    const inside = new THREE.Vector3(0, 0, -1);

    expect(collideWithSegment(position, velocity, GUIDE_A, GUIDE_B, inside, 0.3, 0.5)).toBe(0);
    expect(position.toArray()).toEqual([0, 0, 2]);
    expect(velocity.toArray()).toEqual([0, 0, -1]);
  });

  it('bounces a ball moving from the playfield into the guide', () => {
    const position = new THREE.Vector3(0, 0, -0.6);
    const velocity = new THREE.Vector3(0, 0, 1);
    const inside = new THREE.Vector3(0, 0, -1);

    const impact = collideWithSegment(position, velocity, GUIDE_A, GUIDE_B, inside, 0.3, 0.5);

    expect(impact).toBeCloseTo(1);
    expect(position.z).toBeCloseTo(-0.8);
    expect(velocity.z).toBeCloseTo(-0.55);
  });

  it('nudges an outlane ball toward play without bouncing it', () => {
    const position = new THREE.Vector3(0, 0, 0.6);
    const velocity = new THREE.Vector3(0, 0, -1);
    const inside = new THREE.Vector3(0, 0, -1);

    const impact = collideWithSegment(position, velocity, GUIDE_A, GUIDE_B, inside, 0.3, 0.5);

    expect(impact).toBe(0);
    expect(position.z).toBeCloseTo(0.4);
    expect(velocity.z).toBe(-1);
  });

  it('leaves tangential motion alone while separating the ball', () => {
    const position = new THREE.Vector3(0, 0, -0.6);
    const velocity = new THREE.Vector3(1, 0, 0);
    const inside = new THREE.Vector3(0, 0, -1);

    const impact = collideWithSegment(position, velocity, GUIDE_A, GUIDE_B, inside, 0.3, 0.5);

    expect(impact).toBe(0);
    expect(position.z).toBeCloseTo(-0.8);
    expect(velocity.toArray()).toEqual([1, 0, 0]);
  });

  it('clamps to the nearest endpoint when the ball is past the end of the guide', () => {
    const position = new THREE.Vector3(5.4, 0, -0.4);
    const velocity = new THREE.Vector3(-1, 0, 1);
    const inside = new THREE.Vector3(0, 0, -1);

    const impact = collideWithSegment(position, velocity, GUIDE_A, GUIDE_B, inside, 0.3, 0.5);

    expect(impact).toBeCloseTo(Math.SQRT2);
    expect(position.distanceTo(GUIDE_B)).toBeCloseTo(0.8);
    expect(position.x).toBeGreaterThan(5.4);
  });
});
