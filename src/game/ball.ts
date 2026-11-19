import * as THREE from 'three';
import { BALL } from './config';

export class Ball {
  readonly mesh: THREE.Mesh;
  readonly radius = BALL.radius;
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  active = false;

  private readonly shadow: THREE.Mesh;
  private readonly shadowMaterial: THREE.MeshBasicMaterial;
  private readonly halo: THREE.Sprite;
  private readonly haloMaterial: THREE.SpriteMaterial;
  private readonly spinAxis = new THREE.Vector3();
  private readonly spinQuat = new THREE.Quaternion();

  constructor(scene: THREE.Scene) {
    const glowTexture = makeRadialTexture();
    const chromeEnvironment = makeChromeEnvironment();

    const geometry = new THREE.SphereGeometry(this.radius, 48, 32);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 1,
      roughness: 0.16,
      envMap: chromeEnvironment,
      envMapIntensity: 1.1,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.visible = false;
    scene.add(this.mesh);

    this.shadowMaterial = new THREE.MeshBasicMaterial({
      map: glowTexture,
      color: 0x000000,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), this.shadowMaterial);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.025;
    this.shadow.renderOrder = 1;
    this.shadow.visible = false;
    scene.add(this.shadow);

    this.haloMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffe0b0,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    this.halo = new THREE.Sprite(this.haloMaterial);
    this.halo.scale.setScalar(1.9);
    this.halo.renderOrder = 3;
    this.halo.visible = false;
    scene.add(this.halo);
  }

  reset(position: THREE.Vector3, velocity: THREE.Vector3): void {
    this.position.copy(position);
    this.velocity.copy(velocity);
    this.active = true;
    this.mesh.visible = true;
    this.mesh.position.copy(position);
    this.shadow.visible = true;
    this.halo.visible = true;
    this.halo.position.copy(position);
  }

  hide(): void {
    this.active = false;
    this.mesh.visible = false;
    this.shadow.visible = false;
    this.halo.visible = false;
  }

  updateVisual(dt: number): void {
    if (!this.active) return;

    this.mesh.position.copy(this.position);
    this.halo.position.set(this.position.x, this.position.y + 0.05, this.position.z);

    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (horizontalSpeed > 0.01) {
      this.spinAxis.set(this.velocity.z, 0, -this.velocity.x).normalize();
      const angle = (horizontalSpeed * dt) / this.radius;
      this.spinQuat.setFromAxisAngle(this.spinAxis, angle);
      this.mesh.quaternion.premultiply(this.spinQuat);
    }

    const height = Math.max(0, this.position.y - this.radius);
    const lift = Math.min(1, height / 5);
    this.shadow.position.set(this.position.x, 0.025, this.position.z);
    this.shadow.scale.setScalar(1 + lift * 1.5);
    this.shadowMaterial.opacity = 0.42 * (1 - lift * 0.72);
  }
}

function makeRadialTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create the ball shadow texture.');

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.65)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeChromeEnvironment(): THREE.CanvasTexture {
  const width = 512;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create the chrome environment.');

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#0b0911');
  sky.addColorStop(0.32, '#241d33');
  sky.addColorStop(0.46, '#7f6a8f');
  sky.addColorStop(0.51, '#f4dcc2');
  sky.addColorStop(0.56, '#b98477');
  sky.addColorStop(0.68, '#3a2b42');
  sky.addColorStop(1, '#0d0a13');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const sun = ctx.createRadialGradient(
    width * 0.27,
    height * 0.4,
    2,
    width * 0.27,
    height * 0.4,
    width * 0.16,
  );
  sun.addColorStop(0, 'rgba(255,255,255,1)');
  sun.addColorStop(0.12, 'rgba(255,244,214,0.95)');
  sun.addColorStop(0.35, 'rgba(255,196,130,0.35)');
  sun.addColorStop(1, 'rgba(255,180,110,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, width, height);

  const cool = ctx.createRadialGradient(
    width * 0.72,
    height * 0.6,
    2,
    width * 0.72,
    height * 0.6,
    width * 0.22,
  );
  cool.addColorStop(0, 'rgba(170,205,255,0.75)');
  cool.addColorStop(0.4, 'rgba(120,150,220,0.18)');
  cool.addColorStop(1, 'rgba(80,100,160,0)');
  ctx.fillStyle = cool;
  ctx.fillRect(0, 0, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
