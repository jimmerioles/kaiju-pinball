import * as THREE from 'three';

const WHITE = new THREE.Color(0xffffff);

const PARTICLE_VERTEX = `
uniform float uPixelRatio;
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPixelRatio * (620.0 / max(1.0, -mv.z));
  gl_Position = projectionMatrix * mv;
}
`;

const PARTICLE_FRAGMENT = `
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float distanceToCenter = length(uv);
  float mask = smoothstep(0.5, 0.06, distanceToCenter);
  if (mask <= 0.001) discard;
  gl_FragColor = vec4(vColor, vAlpha * mask);
}
`;

type ParticleMode = 'spark' | 'dust';

class ParticlePool {
  readonly points: THREE.Points;

  private readonly count: number;
  private readonly mode: ParticleMode;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly sizes: Float32Array;
  private readonly alphas: Float32Array;
  private readonly velocities: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly baseSize: Float32Array;
  private readonly baseAlpha: Float32Array;
  private readonly positionAttr: THREE.BufferAttribute;
  private readonly colorAttr: THREE.BufferAttribute;
  private readonly sizeAttr: THREE.BufferAttribute;
  private readonly alphaAttr: THREE.BufferAttribute;
  private cursor = 0;

  constructor(scene: THREE.Scene, count: number, mode: ParticleMode, pixelRatio: number) {
    this.count = count;
    this.mode = mode;

    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.sizes = new Float32Array(count);
    this.alphas = new Float32Array(count);
    this.velocities = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.baseSize = new Float32Array(count);
    this.baseAlpha = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      this.positions[i * 3 + 1] = -100;
    }

    const geometry = new THREE.BufferGeometry();
    this.positionAttr = new THREE.BufferAttribute(this.positions, 3).setUsage(
      THREE.DynamicDrawUsage,
    );
    this.colorAttr = new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage);
    this.alphaAttr = new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage);

    geometry.setAttribute('position', this.positionAttr);
    geometry.setAttribute('aColor', this.colorAttr);
    geometry.setAttribute('aSize', this.sizeAttr);
    geometry.setAttribute('aAlpha', this.alphaAttr);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: pixelRatio },
      },
      vertexShader: PARTICLE_VERTEX,
      fragmentShader: PARTICLE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: mode === 'spark' ? THREE.AdditiveBlending : THREE.NormalBlending,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  spawn(
    position: THREE.Vector3,
    color: THREE.Color,
    amount: number,
    strength: number,
    spread: number,
  ): void {
    const isSpark = this.mode === 'spark';

    for (let i = 0; i < amount; i++) {
      const index = this.cursor;
      this.cursor = (this.cursor + 1) % this.count;

      const px = position.x + (Math.random() - 0.5) * spread * 2;
      const py = position.y + (Math.random() - 0.5) * spread * 2;
      const pz = position.z + (Math.random() - 0.5) * spread * 2;

      this.positions[index * 3] = px;
      this.positions[index * 3 + 1] = py;
      this.positions[index * 3 + 2] = pz;

      const angle = Math.random() * Math.PI * 2;
      const horizontal = isSpark
        ? (2 + Math.random() * 6.5) * strength
        : (0.4 + Math.random() * 1.9) * strength;

      this.velocities[index * 3] = Math.cos(angle) * horizontal;
      this.velocities[index * 3 + 1] = isSpark
        ? (2.2 + Math.random() * 5.5) * strength
        : (0.35 + Math.random() * 1.2) * strength;
      this.velocities[index * 3 + 2] = Math.sin(angle) * horizontal;

      const tint = 0.75 + Math.random() * 0.45;
      this.colors[index * 3] = color.r * tint;
      this.colors[index * 3 + 1] = color.g * tint;
      this.colors[index * 3 + 2] = color.b * tint;

      const size = isSpark ? 0.09 + Math.random() * 0.14 : 0.5 + Math.random() * 0.85;
      const life = isSpark ? 0.35 + Math.random() * 0.55 : 0.8 + Math.random() * 0.9;

      this.sizes[index] = size;
      this.baseSize[index] = size;
      this.alphas[index] = isSpark ? 0.9 : 0.3;
      this.baseAlpha[index] = this.alphas[index];
      this.life[index] = life;
      this.maxLife[index] = life;
    }

    this.colorAttr.needsUpdate = true;
    this.positionAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
  }

  update(dt: number): void {
    const isSpark = this.mode === 'spark';
    const gravity = isSpark ? 22 : 2.4;
    const drag = isSpark ? 0.55 : 1.5;

    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;

      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.alphas[i] = 0;
        this.positions[i * 3 + 1] = -100;
        continue;
      }

      const dragFactor = Math.max(0, 1 - drag * dt);
      this.velocities[i * 3] *= dragFactor;
      this.velocities[i * 3 + 1] -= gravity * dt;
      this.velocities[i * 3 + 2] *= dragFactor;

      const x = this.positions[i * 3] + this.velocities[i * 3] * dt;
      let y = this.positions[i * 3 + 1] + this.velocities[i * 3 + 1] * dt;
      const z = this.positions[i * 3 + 2] + this.velocities[i * 3 + 2] * dt;

      if (y < 0.04) {
        y = 0.04;
        this.velocities[i * 3 + 1] = Math.abs(this.velocities[i * 3 + 1]) * 0.3;
        this.velocities[i * 3] *= 0.7;
        this.velocities[i * 3 + 2] *= 0.7;
      }

      this.positions[i * 3] = x;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = z;

      const remaining = this.life[i] / this.maxLife[i];
      this.alphas[i] = this.baseAlpha[i] * Math.pow(remaining, 1.25);
      this.sizes[i] = isSpark
        ? this.baseSize[i] * (0.3 + 0.7 * remaining)
        : this.baseSize[i] * (1 + (1 - remaining) * 0.85);
    }

    this.positionAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
  }

  reset(): void {
    this.life.fill(0);
    this.alphas.fill(0);
    for (let i = 0; i < this.count; i++) {
      this.positions[i * 3 + 1] = -100;
    }
    this.positionAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
  }
}

interface Shard {
  active: boolean;
  visible: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  quaternion: THREE.Quaternion;
  spin: THREE.Vector3;
  size: THREE.Vector3;
  life: number;
  maxLife: number;
}

class ShardPool {
  readonly mesh: THREE.InstancedMesh;

  private readonly count = 420;
  private readonly shards: Shard[] = [];
  private readonly dummy = new THREE.Object3D();
  private readonly spinQuat = new THREE.Quaternion();
  private readonly spinAxis = new THREE.Vector3();
  private cursor = 0;

  constructor(scene: THREE.Scene) {
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.72,
      metalness: 0.08,
    });

    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, this.count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    scene.add(this.mesh);

    this.dummy.scale.set(0, 0, 0);
    this.dummy.updateMatrix();

    for (let i = 0; i < this.count; i++) {
      this.shards.push({
        active: false,
        visible: false,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        quaternion: new THREE.Quaternion(),
        spin: new THREE.Vector3(),
        size: new THREE.Vector3(1, 1, 1),
        life: 0,
        maxLife: 0,
      });
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  spawn(
    position: THREE.Vector3,
    color: THREE.Color,
    amount: number,
    strength: number,
    blockSize: THREE.Vector3,
  ): void {
    for (let i = 0; i < amount; i++) {
      const index = this.cursor;
      this.cursor = (this.cursor + 1) % this.count;
      const shard = this.shards[index];

      shard.active = true;
      shard.visible = true;
      shard.position.set(
        position.x + (Math.random() - 0.5) * blockSize.x * 0.7,
        position.y + (Math.random() - 0.5) * blockSize.y * 0.7,
        position.z + (Math.random() - 0.5) * blockSize.z * 0.7,
      );

      const angle = Math.random() * Math.PI * 2;
      const horizontal = (1.5 + Math.random() * 5.5) * Math.min(1.8, strength);
      shard.velocity.set(
        Math.cos(angle) * horizontal,
        2.5 + Math.random() * 6,
        Math.sin(angle) * horizontal,
      );

      shard.quaternion.setFromEuler(
        new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
      );
      shard.spin.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
      );

      shard.size.set(
        0.24 + Math.random() * 0.36,
        0.16 + Math.random() * 0.3,
        0.24 + Math.random() * 0.36,
      );

      shard.maxLife = 1.2 + Math.random() * 1.0;
      shard.life = shard.maxLife;

      const tint = color.clone();
      tint.offsetHSL(0, -0.03, 0.02 + Math.random() * 0.05);
      this.mesh.setColorAt(index, tint);
    }

    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    let changed = false;

    for (let i = 0; i < this.count; i++) {
      const shard = this.shards[i];

      if (!shard.active) {
        if (shard.visible) {
          this.dummy.position.set(0, -100, 0);
          this.dummy.quaternion.identity();
          this.dummy.scale.set(0, 0, 0);
          this.dummy.updateMatrix();
          this.mesh.setMatrixAt(i, this.dummy.matrix);
          shard.visible = false;
          changed = true;
        }
        continue;
      }

      shard.life -= dt;
      if (shard.life <= 0) {
        shard.active = false;
        continue;
      }

      shard.velocity.y -= 32 * dt;
      shard.position.addScaledVector(shard.velocity, dt);

      const halfHeight = shard.size.y * 0.5;
      if (shard.position.y < halfHeight) {
        shard.position.y = halfHeight;
        shard.velocity.y = Math.abs(shard.velocity.y) * 0.34;
        shard.velocity.x *= 0.72;
        shard.velocity.z *= 0.72;
      }

      const spinLength = shard.spin.length();
      if (spinLength > 0.001) {
        this.spinAxis.copy(shard.spin).normalize();
        this.spinQuat.setFromAxisAngle(this.spinAxis, spinLength * dt);
        shard.quaternion.premultiply(this.spinQuat);
      }

      const fade = Math.min(1, shard.life / 0.35);
      this.dummy.position.copy(shard.position);
      this.dummy.quaternion.copy(shard.quaternion);
      this.dummy.scale.copy(shard.size).multiplyScalar(fade);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      changed = true;
    }

    if (changed) this.mesh.instanceMatrix.needsUpdate = true;
  }

  reset(): void {
    for (let i = 0; i < this.count; i++) {
      this.shards[i].active = false;
      this.shards[i].visible = false;
      this.dummy.position.set(0, -100, 0);
      this.dummy.quaternion.identity();
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

interface Ring {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  maxScale: number;
}

class RingPool {
  private readonly rings: Ring[] = [];
  private cursor = 0;

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.RingGeometry(0.78, 1.0, 48);
    geometry.rotateX(-Math.PI / 2);

    for (let i = 0; i < 20; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      scene.add(mesh);
      this.rings.push({ mesh, material, life: 0, maxLife: 0, maxScale: 3 });
    }
  }

  spawn(position: THREE.Vector3, color: THREE.Color, maxScale: number, duration: number): void {
    const ring = this.rings[this.cursor];
    this.cursor = (this.cursor + 1) % this.rings.length;

    ring.mesh.position.copy(position);
    ring.mesh.scale.setScalar(0.55);
    ring.material.color.copy(color);
    ring.material.opacity = 0.9;
    ring.mesh.visible = true;
    ring.life = duration;
    ring.maxLife = duration;
    ring.maxScale = maxScale;
  }

  update(dt: number): void {
    for (const ring of this.rings) {
      if (!ring.mesh.visible) continue;

      ring.life -= dt;
      if (ring.life <= 0) {
        ring.mesh.visible = false;
        ring.material.opacity = 0;
        continue;
      }

      const progress = 1 - ring.life / ring.maxLife;
      ring.mesh.scale.setScalar(0.55 + progress * ring.maxScale);
      ring.material.opacity = Math.pow(1 - progress, 1.5) * 0.85;
    }
  }

  reset(): void {
    for (const ring of this.rings) {
      ring.mesh.visible = false;
      ring.material.opacity = 0;
      ring.life = 0;
    }
  }
}

export class Effects {
  private readonly sparks: ParticlePool;
  private readonly dust: ParticlePool;
  private readonly shards: ShardPool;
  private readonly rings: RingPool;

  private readonly sparkColor = new THREE.Color();
  private readonly dustColor = new THREE.Color();
  private readonly goldColor = new THREE.Color(0xffd166);
  private readonly padColor = new THREE.Color(0xffc857);
  private readonly drainColor = new THREE.Color(0x9a8fae);

  constructor(scene: THREE.Scene, pixelRatio: number) {
    this.sparks = new ParticlePool(scene, 900, 'spark', pixelRatio);
    this.dust = new ParticlePool(scene, 320, 'dust', pixelRatio);
    this.shards = new ShardPool(scene);
    this.rings = new RingPool(scene);
  }

  impact(
    position: THREE.Vector3,
    color: THREE.Color,
    strength: number,
    blockSize: THREE.Vector3,
    big = false,
  ): void {
    this.shards.spawn(position, color, big ? 10 : 6, strength, blockSize);

    this.sparkColor.copy(color).lerp(WHITE, 0.3).offsetHSL(0, 0.16, 0.06);
    this.sparks.spawn(position, this.sparkColor, big ? 26 : 14, strength, 0.35);

    this.dustColor.copy(color).lerp(WHITE, 0.45);
    this.dust.spawn(position, this.dustColor, big ? 14 : 8, strength, 0.55);

    this.rings.spawn(new THREE.Vector3(position.x, 0.07, position.z), color, big ? 4.4 : 3.0, 0.55);
  }

  hit(position: THREE.Vector3, color: THREE.Color, strength: number): void {
    this.sparkColor.copy(color).lerp(WHITE, 0.34).offsetHSL(0, 0.16, 0.08);
    this.sparks.spawn(position, this.sparkColor, 10, strength, 0.28);
    this.dustColor.copy(color).lerp(WHITE, 0.5);
    this.dust.spawn(position, this.dustColor, 4, strength, 0.4);
  }

  bumper(position: THREE.Vector3, color: THREE.Color): void {
    this.sparks.spawn(position, this.goldColor, 34, 1.3, 0.3);
    this.rings.spawn(position, color, 5.2, 0.52);
    this.rings.spawn(new THREE.Vector3(position.x, 0.07, position.z), color, 3.6, 0.45);
  }

  pad(position: THREE.Vector3): void {
    this.rings.spawn(new THREE.Vector3(position.x, 0.07, position.z), this.padColor, 3.4, 0.45);
    this.sparks.spawn(position, this.padColor, 18, 1.0, 0.35);
  }

  drain(position: THREE.Vector3): void {
    this.dust.spawn(position, this.drainColor, 16, 0.7, 0.5);
  }

  update(dt: number): void {
    this.sparks.update(dt);
    this.dust.update(dt);
    this.shards.update(dt);
    this.rings.update(dt);
  }

  reset(): void {
    this.sparks.reset();
    this.dust.reset();
    this.shards.reset();
    this.rings.reset();
  }
}
