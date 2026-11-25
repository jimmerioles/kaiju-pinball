import * as THREE from 'three';

export interface CollisionResult {
  hit: boolean;
  normal: THREE.Vector3;
  depth: number;
}

export function resolveSphereAABB(
  position: THREE.Vector3,
  radius: number,
  min: THREE.Vector3,
  max: THREE.Vector3,
  out: CollisionResult,
): boolean {
  const closestX = Math.max(min.x, Math.min(position.x, max.x));
  const closestY = Math.max(min.y, Math.min(position.y, max.y));
  const closestZ = Math.max(min.z, Math.min(position.z, max.z));

  const dx = position.x - closestX;
  const dy = position.y - closestY;
  const dz = position.z - closestZ;
  const distanceSq = dx * dx + dy * dy + dz * dz;

  if (distanceSq > radius * radius) {
    out.hit = false;
    return false;
  }

  out.hit = true;

  if (distanceSq > 1e-8) {
    const distance = Math.sqrt(distanceSq);
    out.normal.set(dx / distance, dy / distance, dz / distance);
    out.depth = radius - distance;
    return true;
  }

  const dxMin = position.x - min.x;
  const dxMax = max.x - position.x;
  const dyMin = position.y - min.y;
  const dyMax = max.y - position.y;
  const dzMin = position.z - min.z;
  const dzMax = max.z - position.z;
  const nearest = Math.min(dxMin, dxMax, dyMin, dyMax, dzMin, dzMax);

  if (nearest === dxMin) {
    out.normal.set(-1, 0, 0);
    out.depth = radius + dxMin;
  } else if (nearest === dxMax) {
    out.normal.set(1, 0, 0);
    out.depth = radius + dxMax;
  } else if (nearest === dyMin) {
    out.normal.set(0, -1, 0);
    out.depth = radius + dyMin;
  } else if (nearest === dyMax) {
    out.normal.set(0, 1, 0);
    out.depth = radius + dyMax;
  } else if (nearest === dzMin) {
    out.normal.set(0, 0, -1);
    out.depth = radius + dzMin;
  } else {
    out.normal.set(0, 0, 1);
    out.depth = radius + dzMax;
  }

  return true;
}

export function collideWithSegment(
  position: THREE.Vector3,
  velocity: THREE.Vector3,
  a: THREE.Vector3,
  b: THREE.Vector3,
  inside: THREE.Vector3,
  wallRadius: number,
  ballRadius: number,
): number {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const lengthSq = abx * abx + abz * abz;
  if (lengthSq < 1e-6) return 0;

  const t = Math.max(
    0,
    Math.min(1, ((position.x - a.x) * abx + (position.z - a.z) * abz) / lengthSq),
  );
  const closestX = a.x + abx * t;
  const closestZ = a.z + abz * t;

  const dx = position.x - closestX;
  const dz = position.z - closestZ;
  const distanceSq = dx * dx + dz * dz;
  const radius = wallRadius + ballRadius;

  if (distanceSq >= radius * radius) return 0;

  const distance = Math.sqrt(distanceSq);
  let normalX = 0;
  let normalZ = -1;
  if (distance > 1e-6) {
    normalX = dx / distance;
    normalZ = dz / distance;
  }

  if (normalX * inside.x + normalZ * inside.z < 0) {
    normalX = -normalX;
    normalZ = -normalZ;
  }

  position.x += normalX * (radius - distance);
  position.z += normalZ * (radius - distance);

  const normalVelocity = velocity.x * normalX + velocity.z * normalZ;
  if (normalVelocity >= 0) return 0;

  const impact = -normalVelocity;
  velocity.x -= normalX * normalVelocity * 1.55;
  velocity.z -= normalZ * normalVelocity * 1.55;
  return impact;
}
