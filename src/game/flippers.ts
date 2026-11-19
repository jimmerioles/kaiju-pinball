import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { FlipperSide } from './input';

const LENGTH = 3.1;
const THICKNESS = 0.34;

export class Flipper {
  readonly side: FlipperSide;
  readonly group = new THREE.Group();
  readonly length = LENGTH;

  private readonly restAngle: number;
  private readonly activeAngle: number;
  private readonly tipLight: THREE.Mesh;
  private angle: number;
  private prevAngle: number;
  private activeTimer = 0;
  private hitCooldown = 0;
  private angularSpeed = 0;

  private readonly pivot = new THREE.Vector3();
  private readonly tip = new THREE.Vector3();
  private readonly closest = new THREE.Vector3();

  constructor(parent: THREE.Object3D, side: FlipperSide, pivotX: number, pivotZ: number) {
    this.side = side;
    this.restAngle = side === 'left' ? -0.36 : 0.36;
    this.activeAngle = side === 'left' ? 0.46 : -0.46;
    this.angle = this.restAngle;
    this.prevAngle = this.restAngle;

    this.group.position.set(pivotX, 0.35, pivotZ);
    this.group.rotation.y = this.angle;

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xff7a66,
      roughness: 0.32,
      metalness: 0.25,
      emissive: new THREE.Color(0x5a160f),
      emissiveIntensity: 0.55,
    });
    const body = new THREE.Mesh(new RoundedBoxGeometry(LENGTH, 0.42, 0.62, 4, 0.18), bodyMaterial);
    body.position.x = side === 'left' ? LENGTH / 2 : -LENGTH / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);

    const capMaterial = new THREE.MeshStandardMaterial({
      color: 0xc9a86a,
      roughness: 0.34,
      metalness: 0.72,
    });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 18), capMaterial);
    cap.castShadow = true;
    this.group.add(cap);

    const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xffd166, toneMapped: false });
    this.tipLight = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), lightMaterial);
    this.tipLight.position.set(side === 'left' ? LENGTH - 0.2 : -(LENGTH - 0.2), 0.2, 0);
    this.group.add(this.tipLight);

    parent.add(this.group);
  }

  fire(): void {
    this.activeTimer = 0.16;
    this.hitCooldown = 0;
  }

  update(dt: number): void {
    this.prevAngle = this.angle;
    this.activeTimer = Math.max(0, this.activeTimer - dt);

    const target = this.activeTimer > 0 ? this.activeAngle : this.restAngle;
    this.angle = THREE.MathUtils.damp(this.angle, target, 28, dt);
    this.group.rotation.y = this.angle;
    this.angularSpeed = (this.angle - this.prevAngle) / Math.max(dt, 0.0001);
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
  }

  collide(position: THREE.Vector3, velocity: THREE.Vector3, radius: number): boolean {
    if (position.y > 1.45) return false;

    const direction = this.side === 'left' ? 1 : -1;
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);

    this.pivot.copy(this.group.position);
    this.tip.set(
      this.group.position.x + direction * cos * this.length,
      this.group.position.y,
      this.group.position.z - direction * sin * this.length,
    );

    const segmentX = this.tip.x - this.pivot.x;
    const segmentZ = this.tip.z - this.pivot.z;
    const lengthSq = segmentX * segmentX + segmentZ * segmentZ;
    if (lengthSq < 1e-6) return false;

    const t = Math.max(
      0,
      Math.min(
        1,
        ((position.x - this.pivot.x) * segmentX + (position.z - this.pivot.z) * segmentZ) /
          lengthSq,
      ),
    );

    this.closest.set(
      this.pivot.x + segmentX * t,
      this.group.position.y,
      this.pivot.z + segmentZ * t,
    );

    const dx = position.x - this.closest.x;
    const dz = position.z - this.closest.z;
    const distanceSq = dx * dx + dz * dz;
    const collisionRadius = radius + THICKNESS;

    if (distanceSq >= collisionRadius * collisionRadius) return false;

    let normalX = 0;
    let normalZ = -1;
    if (distanceSq > 1e-8) {
      const distance = Math.sqrt(distanceSq);
      normalX = dx / distance;
      normalZ = dz / distance;
    }

    const penetration = collisionRadius - Math.sqrt(distanceSq);
    position.x += normalX * penetration;
    position.z += normalZ * penetration;

    if (this.hitCooldown > 0) return false;

    const boost = Math.max(0, Math.min(18, this.angularSpeed * 0.65));
    velocity.x += normalX * 6 + direction * 2.2;
    velocity.z += normalZ * 6 - 9 - boost;
    velocity.y = Math.max(velocity.y, 4.2 + boost * 0.3);

    this.hitCooldown = 0.12;
    return true;
  }

  getTip(out: THREE.Vector3): THREE.Vector3 {
    const direction = this.side === 'left' ? 1 : -1;
    return out.set(
      this.group.position.x + direction * Math.cos(this.angle) * this.length,
      this.group.position.y + 0.1,
      this.group.position.z - direction * Math.sin(this.angle) * this.length,
    );
  }

  reset(): void {
    this.angle = this.restAngle;
    this.prevAngle = this.restAngle;
    this.activeTimer = 0;
    this.hitCooldown = 0;
    this.angularSpeed = 0;
    this.group.rotation.y = this.angle;
  }
}

export class FlipperPair {
  readonly left: Flipper;
  readonly right: Flipper;

  constructor(parent: THREE.Object3D) {
    this.left = new Flipper(parent, 'left', -3.3, 13.2);
    this.right = new Flipper(parent, 'right', 3.3, 13.2);
  }

  fire(side: FlipperSide): void {
    if (side === 'left') this.left.fire();
    else this.right.fire();
  }

  update(dt: number): void {
    this.left.update(dt);
    this.right.update(dt);
  }

  collide(position: THREE.Vector3, velocity: THREE.Vector3, radius: number): FlipperSide | null {
    if (this.left.collide(position, velocity, radius)) return 'left';
    if (this.right.collide(position, velocity, radius)) return 'right';
    return null;
  }

  reset(): void {
    this.left.reset();
    this.right.reset();
  }
}
