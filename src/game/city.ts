import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PALETTE, TABLE } from './config';
import { makeRng } from './rng';

export type BlockKind = 'fragile' | 'solid' | 'bumper';

export interface Block {
  id: number;
  kind: BlockKind;
  instanceIndex: number;
  capIndex: number;
  min: THREE.Vector3;
  max: THREE.Vector3;
  center: THREE.Vector3;
  size: THREE.Vector3;
  health: number;
  maxHealth: number;
  active: boolean;
  color: THREE.Color;
  baseColor: THREE.Color;
  gx: number;
  gz: number;
  flash: number;
  bumperCooldown: number;
}

export interface BoostPad {
  position: THREE.Vector3;
  direction: THREE.Vector3;
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  radius: number;
  cooldown: number;
}

export interface Guide {
  a: THREE.Vector3;
  b: THREE.Vector3;
  radius: number;
  inside: THREE.Vector3;
}

const WHITE = new THREE.Color(0xffffff);
const MAX_INSTANCES = TABLE.columns * TABLE.rows;

export class City {
  readonly group = new THREE.Group();
  readonly blocks: Block[] = [];
  readonly pads: BoostPad[] = [];
  readonly guides: Guide[] = [];

  private readonly sideMaterial: THREE.MeshStandardMaterial;
  private readonly roofMaterial: THREE.MeshStandardMaterial;
  private readonly bottomMaterial: THREE.MeshStandardMaterial;
  private readonly capMaterial: THREE.MeshBasicMaterial;
  private readonly rimMaterial: THREE.MeshStandardMaterial;
  private readonly plinthMaterial: THREE.MeshStandardMaterial;

  private readonly waterTankGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.5, 12);
  private readonly waterRoofGeo = new THREE.ConeGeometry(0.36, 0.22, 12);
  private readonly waterLegGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6);
  private readonly antennaGeo = new THREE.CylinderGeometry(0.025, 0.025, 2.0, 6);
  private readonly antennaTipGeo = new THREE.SphereGeometry(0.08, 8, 6);
  private readonly waterTankMat = new THREE.MeshStandardMaterial({
    color: 0x7fa7a0,
    roughness: 0.58,
    metalness: 0.28,
  });
  private readonly waterRoofMat = new THREE.MeshStandardMaterial({
    color: 0xc9a86a,
    roughness: 0.48,
    metalness: 0.45,
  });
  private readonly waterLegMat = new THREE.MeshStandardMaterial({
    color: 0x5b4a52,
    roughness: 0.82,
  });
  private readonly antennaMat = new THREE.MeshStandardMaterial({
    color: 0x8b8494,
    roughness: 0.5,
    metalness: 0.55,
  });
  private readonly antennaLightMat = new THREE.MeshBasicMaterial({
    color: 0xff5a4a,
    transparent: true,
    opacity: 1,
  });

  private readonly streetTexture: THREE.CanvasTexture;
  private readonly padTexture: THREE.CanvasTexture;
  private readonly lampTexture: THREE.CanvasTexture;
  private readonly lampMaterial: THREE.PointsMaterial;
  private readonly lampGlowMaterial: THREE.PointsMaterial;

  private buildings: THREE.InstancedMesh | null = null;
  private caps: THREE.InstancedMesh | null = null;
  private capBlocks: Block[] = [];
  private grid = new Map<string, Block[]>();
  private facadeMap: THREE.CanvasTexture | null = null;
  private facadeEmissive: THREE.CanvasTexture | null = null;
  private lamps: THREE.Points | null = null;
  private lampGlow: THREE.Points | null = null;
  private roofGroup: THREE.Group | null = null;

  private rng: () => number = Math.random;
  private readonly dummy = new THREE.Object3D();
  private readonly tmpColor = new THREE.Color();

  constructor(scene: THREE.Scene) {
    scene.add(this.group);

    this.sideMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.82,
      metalness: 0.02,
      emissive: new THREE.Color(0xffc78a),
      emissiveIntensity: 0.85,
    });
    this.roofMaterial = new THREE.MeshStandardMaterial({
      color: 0x857c8f,
      roughness: 0.9,
      metalness: 0.02,
    });
    this.bottomMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a3f55,
      roughness: 0.95,
    });
    this.capMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false,
    });
    this.rimMaterial = new THREE.MeshStandardMaterial({
      color: 0xc9a86a,
      roughness: 0.32,
      metalness: 0.72,
    });
    this.plinthMaterial = new THREE.MeshStandardMaterial({
      color: 0x2b2238,
      roughness: 0.72,
      metalness: 0.06,
    });

    this.streetTexture = this.makeStreetTexture();
    this.padTexture = this.makePadTexture();
    this.lampTexture = this.makeGlowTexture();
    this.lampMaterial = new THREE.PointsMaterial({
      map: this.lampTexture,
      color: 0xffc857,
      size: 0.18,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      toneMapped: false,
    });
    this.lampGlowMaterial = new THREE.PointsMaterial({
      map: this.lampTexture,
      color: 0xff9a5e,
      size: 0.68,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      toneMapped: false,
    });

    this.buildTable();
    this.buildPads();
    this.buildGuides();
  }

  regenerate(seed: string): void {
    this.rng = makeRng(seed);
    this.clearGenerated();

    const { map, emissive } = this.makeFacadeTextures(seed);
    this.facadeMap = map;
    this.facadeEmissive = emissive;
    this.sideMaterial.map = map;
    this.sideMaterial.emissiveMap = emissive;
    this.sideMaterial.needsUpdate = true;

    const buildings = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      [
        this.sideMaterial,
        this.sideMaterial,
        this.roofMaterial,
        this.bottomMaterial,
        this.sideMaterial,
        this.sideMaterial,
      ],
      MAX_INSTANCES,
    );
    buildings.castShadow = true;
    buildings.receiveShadow = true;
    buildings.frustumCulled = false;

    const caps = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.5, 0.62, 0.28, 18),
      this.capMaterial,
      MAX_INSTANCES,
    );
    caps.castShadow = false;
    caps.receiveShadow = false;
    caps.frustumCulled = false;

    this.buildings = buildings;
    this.caps = caps;
    this.blocks.length = 0;
    this.capBlocks.length = 0;
    this.grid.clear();

    for (let row = 0; row < TABLE.rows; row++) {
      for (let column = 0; column < TABLE.columns; column++) {
        const baseX = TABLE.cityXStart + column * TABLE.cell;
        const baseZ = TABLE.cityZStart + row * TABLE.cell;

        if (baseZ > 10.4) continue;
        if (Math.abs(baseX) < 1.8 && baseZ < -13.2) continue;
        if (this.isNearPad(baseX, baseZ, 2.25)) continue;
        if (this.rng() > 0.72) continue;

        const x = baseX + (this.rng() - 0.5) * 0.14;
        const z = baseZ + (this.rng() - 0.5) * 0.14;

        const roll = this.rng();
        const kind: BlockKind = roll < 0.09 ? 'bumper' : roll < 0.36 ? 'solid' : 'fragile';

        let height: number;
        if (kind === 'bumper') {
          height = 1.0 + this.rng() * 1.1;
        } else if (kind === 'solid') {
          height = 0.9 + this.rng() * 1.9;
        } else if (this.rng() < 0.07) {
          height = 5.2 + this.rng() * 2.2;
        } else {
          height = 1.2 + this.rng() * 2.8;
        }

        const footprint = 1.34 + this.rng() * 0.26;
        const palette = PALETTE[kind];
        const color = new THREE.Color(palette[Math.floor(this.rng() * palette.length)]);
        color.offsetHSL(
          (this.rng() - 0.5) * 0.025,
          (this.rng() - 0.5) * 0.07,
          (this.rng() - 0.5) * 0.055,
        );

        const health = kind === 'fragile' ? 1 : kind === 'solid' ? 3 : 2;
        const instanceIndex = this.blocks.length;

        this.dummy.position.set(x, height / 2, z);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.set(footprint, height, footprint);
        this.dummy.updateMatrix();
        buildings.setMatrixAt(instanceIndex, this.dummy.matrix);
        buildings.setColorAt(instanceIndex, color);

        const block: Block = {
          id: instanceIndex,
          kind,
          instanceIndex,
          capIndex: -1,
          min: new THREE.Vector3(x - footprint / 2, 0, z - footprint / 2),
          max: new THREE.Vector3(x + footprint / 2, height, z + footprint / 2),
          center: new THREE.Vector3(x, height / 2, z),
          size: new THREE.Vector3(footprint, height, footprint),
          health,
          maxHealth: health,
          active: true,
          color: color.clone(),
          baseColor: color.clone(),
          gx: column,
          gz: row,
          flash: 0,
          bumperCooldown: 0,
        };

        if (kind === 'bumper') {
          block.capIndex = this.capBlocks.length;
          this.capBlocks.push(block);

          this.dummy.position.set(x, height + 0.14, z);
          this.dummy.rotation.set(0, 0, 0);
          this.dummy.scale.set(1, 1, 1);
          this.dummy.updateMatrix();
          caps.setMatrixAt(block.capIndex, this.dummy.matrix);

          const capColor = new THREE.Color(
            PALETTE.bumper[Math.floor(this.rng() * PALETTE.bumper.length)],
          );
          capColor.offsetHSL(0, 0.12, 0.02);
          caps.setColorAt(block.capIndex, capColor);
        }

        this.blocks.push(block);
        const key = `${column},${row}`;
        const list = this.grid.get(key);
        if (list) list.push(block);
        else this.grid.set(key, [block]);
      }
    }

    buildings.count = this.blocks.length;
    caps.count = this.capBlocks.length;
    buildings.instanceMatrix.needsUpdate = true;
    caps.instanceMatrix.needsUpdate = true;
    if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
    if (caps.instanceColor) caps.instanceColor.needsUpdate = true;

    this.group.add(buildings);
    this.group.add(caps);

    this.addRoofDetails();
    this.addLamps();
  }

  update(dt: number, time: number): void {
    if (this.buildings && this.caps) {
      let capsChanged = false;
      for (const block of this.capBlocks) {
        if (!block.active) continue;
        const pulse = 1 + Math.sin(time * 4 + block.id * 0.9) * 0.06;
        this.dummy.position.set(block.center.x, block.size.y + 0.14, block.center.z);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.set(pulse, 1, pulse);
        this.dummy.updateMatrix();
        this.caps.setMatrixAt(block.capIndex, this.dummy.matrix);
        capsChanged = true;
      }
      if (capsChanged) this.caps.instanceMatrix.needsUpdate = true;

      let colorsChanged = false;
      for (const block of this.blocks) {
        if (!block.active) continue;
        if (block.bumperCooldown > 0) block.bumperCooldown = Math.max(0, block.bumperCooldown - dt);

        if (block.flash <= 0) continue;
        block.flash = Math.max(0, block.flash - dt * 3.4);
        this.tmpColor.copy(block.baseColor).lerp(WHITE, Math.min(0.65, block.flash * 0.7));
        this.buildings.setColorAt(block.instanceIndex, this.tmpColor);
        colorsChanged = true;
      }
      if (colorsChanged && this.buildings.instanceColor) {
        this.buildings.instanceColor.needsUpdate = true;
      }
    }

    for (let i = 0; i < this.pads.length; i++) {
      const pad = this.pads[i];
      pad.material.opacity = 0.52 + 0.22 * Math.sin(time * 3 + i * 1.7);
      if (pad.cooldown > 0) pad.cooldown = Math.max(0, pad.cooldown - dt);
    }

    this.antennaLightMat.opacity = 0.32 + 0.68 * (0.5 + 0.5 * Math.sin(time * 4.2));
  }

  damageBlock(block: Block, amount: number): boolean {
    if (!block.active) return false;

    block.health -= amount;
    block.flash = Math.min(1, block.flash + 0.8);

    if (block.health <= 0) {
      this.destroyBlock(block);
      return true;
    }

    return false;
  }

  forEachNear(position: THREE.Vector3, radius: number, callback: (block: Block) => void): void {
    const cell = TABLE.cell;
    const minGx = Math.floor((position.x - radius - TABLE.cityXStart) / cell);
    const maxGx = Math.floor((position.x + radius - TABLE.cityXStart) / cell);
    const minGz = Math.floor((position.z - radius - TABLE.cityZStart) / cell);
    const maxGz = Math.floor((position.z + radius - TABLE.cityZStart) / cell);

    for (let gx = minGx; gx <= maxGx; gx++) {
      for (let gz = minGz; gz <= maxGz; gz++) {
        const list = this.grid.get(`${gx},${gz}`);
        if (!list) continue;
        for (const block of list) {
          if (block.active) callback(block);
        }
      }
    }
  }

  resetPads(): void {
    for (const pad of this.pads) pad.cooldown = 0;
  }

  private destroyBlock(block: Block): void {
    block.active = false;
    block.health = 0;

    if (this.buildings) {
      this.dummy.position.set(0, -100, 0);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.buildings.setMatrixAt(block.instanceIndex, this.dummy.matrix);
      this.buildings.instanceMatrix.needsUpdate = true;
    }

    if (this.caps && block.capIndex >= 0) {
      this.dummy.position.set(0, -100, 0);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.caps.setMatrixAt(block.capIndex, this.dummy.matrix);
      this.caps.instanceMatrix.needsUpdate = true;
    }
  }

  private buildTable(): void {
    const width = TABLE.halfWidth * 2;
    const depth = TABLE.bottomZ - TABLE.topZ;
    const centerZ = (TABLE.topZ + TABLE.bottomZ) / 2;

    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({
        map: this.streetTexture,
        roughness: 0.94,
        metalness: 0.01,
      }),
    );
    surface.rotation.x = -Math.PI / 2;
    surface.position.set(0, 0.012, centerZ);
    surface.receiveShadow = true;
    this.group.add(surface);

    const plinth = new THREE.Mesh(
      new RoundedBoxGeometry(width + 2.6, 2.8, depth + 2.6, 5, 0.7),
      this.plinthMaterial,
    );
    plinth.position.set(0, -1.55, centerZ);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    this.group.add(plinth);

    const underShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 16, depth + 18),
      new THREE.MeshBasicMaterial({
        map: this.lampTexture,
        color: 0x000000,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    underShadow.rotation.x = -Math.PI / 2;
    underShadow.position.set(0, -3.02, centerZ);
    this.group.add(underShadow);

    const rimHeight = 0.85;
    const rimThickness = 0.35;
    const rimLength = depth + rimThickness * 2;

    const leftRim = new THREE.Mesh(
      new RoundedBoxGeometry(rimThickness, rimHeight, rimLength, 4, 0.16),
      this.rimMaterial,
    );
    leftRim.position.set(-(TABLE.halfWidth + rimThickness / 2), rimHeight / 2, centerZ);
    leftRim.castShadow = true;
    leftRim.receiveShadow = true;
    this.group.add(leftRim);

    const rightRim = leftRim.clone();
    rightRim.position.x = TABLE.halfWidth + rimThickness / 2;
    this.group.add(rightRim);

    const topRim = new THREE.Mesh(
      new RoundedBoxGeometry(width + rimThickness * 2, rimHeight, rimThickness, 4, 0.16),
      this.rimMaterial,
    );
    topRim.position.set(0, rimHeight / 2, TABLE.topZ - rimThickness / 2);
    topRim.castShadow = true;
    topRim.receiveShadow = true;
    this.group.add(topRim);

    const postGeo = new THREE.CylinderGeometry(0.26, 0.3, 1.0, 16);
    for (const x of [-TABLE.halfWidth - 0.18, TABLE.halfWidth + 0.18]) {
      for (const z of [TABLE.topZ - 0.18, TABLE.bottomZ + 0.18]) {
        const post = new THREE.Mesh(postGeo, this.rimMaterial);
        post.position.set(x, 0.5, z);
        post.castShadow = true;
        this.group.add(post);
      }
    }
  }

  private buildPads(): void {
    const definitions = [
      { x: -6.6, z: 6.4, dx: 0.28, dz: -1 },
      { x: 6.6, z: 3.4, dx: -0.32, dz: -1 },
      { x: 0, z: 9.0, dx: 0, dz: -1 },
    ];

    for (const definition of definitions) {
      const direction = new THREE.Vector3(definition.dx, 0, definition.dz).normalize();
      const material = new THREE.MeshBasicMaterial({
        map: this.padTexture,
        color: 0xffc857,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });

      const plate = new THREE.Mesh(
        new RoundedBoxGeometry(3.1, 0.06, 1.95, 2, 0.12),
        new THREE.MeshStandardMaterial({
          color: 0x241d31,
          roughness: 0.68,
          metalness: 0.18,
        }),
      );
      plate.position.y = 0.045;
      plate.receiveShadow = true;

      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.08;

      const group = new THREE.Group();
      group.position.set(definition.x, 0, definition.z);
      group.rotation.y = Math.atan2(-direction.x, -direction.z);
      group.add(plate);
      group.add(mesh);
      this.group.add(group);

      this.pads.push({
        position: new THREE.Vector3(definition.x, 0.03, definition.z),
        direction,
        mesh,
        material,
        radius: 1.45,
        cooldown: 0,
      });
    }
  }

  private isNearPad(x: number, z: number, radius: number): boolean {
    const radiusSq = radius * radius;
    for (const pad of this.pads) {
      const dx = x - pad.position.x;
      const dz = z - pad.position.z;
      if (dx * dx + dz * dz < radiusSq) return true;
    }
    return false;
  }

  private buildGuides(): void {
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x5b3a46,
      roughness: 0.46,
      metalness: 0.22,
    });

    const definitions = [
      { ax: -TABLE.halfWidth, az: 9.0, bx: -6.2, bz: 12.8 },
      { ax: TABLE.halfWidth, az: 9.0, bx: 6.2, bz: 12.8 },
    ];

    for (const definition of definitions) {
      const a = new THREE.Vector3(definition.ax, 0, definition.az);
      const b = new THREE.Vector3(definition.bx, 0, definition.bz);
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const length = Math.hypot(dx, dz);
      const angle = Math.atan2(-dz, dx);
      const centerX = (a.x + b.x) / 2;
      const centerZ = (a.z + b.z) / 2;
      const inside = new THREE.Vector3(-centerX, 0, -centerZ).normalize();

      const body = new THREE.Mesh(new RoundedBoxGeometry(length, 0.7, 0.38, 4, 0.12), bodyMaterial);
      body.position.set(centerX, 0.35, centerZ);
      body.rotation.y = angle;
      body.castShadow = true;
      body.receiveShadow = true;
      this.group.add(body);

      const cap = new THREE.Mesh(
        new RoundedBoxGeometry(length, 0.08, 0.46, 3, 0.04),
        this.rimMaterial,
      );
      cap.position.set(centerX, 0.73, centerZ);
      cap.rotation.y = angle;
      cap.castShadow = true;
      this.group.add(cap);

      this.guides.push({ a, b, radius: 0.3, inside });
    }
  }

  private addRoofDetails(): void {
    if (this.roofGroup) {
      this.group.remove(this.roofGroup);
      this.roofGroup = null;
    }

    const group = new THREE.Group();
    const tall = [...this.blocks].sort((a, b) => b.size.y - a.size.y);

    const tower = tall[0];
    if (tower) {
      const mast = new THREE.Mesh(this.antennaGeo, this.antennaMat);
      mast.position.set(tower.center.x, tower.size.y + 1.0, tower.center.z);
      mast.castShadow = true;
      group.add(mast);

      const tip = new THREE.Mesh(this.antennaTipGeo, this.antennaLightMat);
      tip.position.set(tower.center.x, tower.size.y + 2.0, tower.center.z);
      group.add(tip);
    }

    for (let i = 1; i < Math.min(4, tall.length); i++) {
      const block = tall[i];
      if (block.size.y < 3.0) continue;

      const waterTower = new THREE.Group();
      waterTower.position.set(block.center.x, block.size.y, block.center.z);

      const legOffsets = [
        [-0.2, -0.2],
        [0.2, -0.2],
        [-0.2, 0.2],
        [0.2, 0.2],
      ];
      for (const [lx, lz] of legOffsets) {
        const leg = new THREE.Mesh(this.waterLegGeo, this.waterLegMat);
        leg.position.set(lx, 0.22, lz);
        leg.castShadow = true;
        waterTower.add(leg);
      }

      const tank = new THREE.Mesh(this.waterTankGeo, this.waterTankMat);
      tank.position.y = 0.68;
      tank.castShadow = true;
      waterTower.add(tank);

      const roof = new THREE.Mesh(this.waterRoofGeo, this.waterRoofMat);
      roof.position.y = 1.04;
      roof.castShadow = true;
      waterTower.add(roof);

      group.add(waterTower);
    }

    this.roofGroup = group;
    this.group.add(group);
  }

  private addLamps(): void {
    const positions: number[] = [];
    const cell = TABLE.cell;

    for (let column = 0; column <= TABLE.columns; column++) {
      for (let row = 0; row <= TABLE.rows; row++) {
        const x = TABLE.cityXStart + column * cell;
        const z = TABLE.cityZStart + row * cell;
        if (z > 10.6) continue;
        if (this.isNearPad(x, z, 1.9)) continue;
        if (this.rng() > 0.2) continue;
        positions.push(x, 0.9 + this.rng() * 0.5, z);
      }
    }

    if (positions.length === 0) return;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    const lamps = new THREE.Points(geometry, this.lampMaterial);
    const glow = new THREE.Points(geometry, this.lampGlowMaterial);
    lamps.frustumCulled = false;
    glow.frustumCulled = false;

    this.lamps = lamps;
    this.lampGlow = glow;
    this.group.add(lamps);
    this.group.add(glow);
  }

  private clearGenerated(): void {
    if (this.buildings) {
      this.group.remove(this.buildings);
      this.buildings.dispose();
      this.buildings = null;
    }
    if (this.caps) {
      this.group.remove(this.caps);
      this.caps.dispose();
      this.caps = null;
    }
    if (this.lamps) {
      this.group.remove(this.lamps);
      this.lamps.geometry.dispose();
      this.lamps = null;
    }
    if (this.lampGlow) {
      this.group.remove(this.lampGlow);
      this.lampGlow = null;
    }
    if (this.roofGroup) {
      this.group.remove(this.roofGroup);
      this.roofGroup = null;
    }
    if (this.facadeMap) {
      this.facadeMap.dispose();
      this.facadeMap = null;
    }
    if (this.facadeEmissive) {
      this.facadeEmissive.dispose();
      this.facadeEmissive = null;
    }
  }

  private makeFacadeTextures(seed: string): {
    map: THREE.CanvasTexture;
    emissive: THREE.CanvasTexture;
  } {
    const rng = makeRng(`${seed}-facade`);
    const width = 128;
    const height = 256;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create the facade texture.');

    const emissiveCanvas = document.createElement('canvas');
    emissiveCanvas.width = width;
    emissiveCanvas.height = height;
    const emissiveCtx = emissiveCanvas.getContext('2d');
    if (!emissiveCtx) throw new Error('Could not create the window texture.');

    ctx.fillStyle = '#f4ede2';
    ctx.fillRect(0, 0, width, height);

    const shade = ctx.createLinearGradient(0, 0, 0, height);
    shade.addColorStop(0, 'rgba(255,255,255,0.28)');
    shade.addColorStop(0.72, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, width, height);

    emissiveCtx.fillStyle = '#000000';
    emissiveCtx.fillRect(0, 0, width, height);

    const columns = 4;
    const rows = 8;
    const marginX = 14;
    const marginTop = 16;
    const groundFloor = 34;
    const gapX = 8;
    const gapY = 10;
    const windowWidth = (width - marginX * 2 - gapX * (columns - 1)) / columns;
    const windowHeight = (height - marginTop - groundFloor - gapY * (rows - 1)) / rows;

    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const x = marginX + column * (windowWidth + gapX);
        const y = marginTop + row * (windowHeight + gapY);
        const lit = rng() < 0.27;

        ctx.fillStyle = lit ? 'rgba(255,214,150,0.96)' : 'rgba(57,47,72,0.72)';
        ctx.fillRect(x, y, windowWidth, windowHeight);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, windowWidth - 1, windowHeight - 1);

        if (lit) {
          emissiveCtx.fillStyle = '#ffd08a';
          emissiveCtx.fillRect(x, y, windowWidth, windowHeight);
        }
      }
    }

    ctx.fillStyle = 'rgba(58,46,70,0.16)';
    ctx.fillRect(0, height - groundFloor, width, groundFloor);
    ctx.fillStyle = 'rgba(52,42,64,0.48)';
    ctx.fillRect(width / 2 - 10, height - 28, 20, 28);
    ctx.fillStyle = 'rgba(255,214,150,0.55)';
    ctx.fillRect(width / 2 - 4, height - 22, 8, 6);

    const edge = ctx.createLinearGradient(0, 0, width, 0);
    edge.addColorStop(0, 'rgba(0,0,0,0.2)');
    edge.addColorStop(0.12, 'rgba(0,0,0,0)');
    edge.addColorStop(0.88, 'rgba(0,0,0,0)');
    edge.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, width, height);

    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;

    const emissive = new THREE.CanvasTexture(emissiveCanvas);
    emissive.colorSpace = THREE.SRGBColorSpace;
    emissive.anisotropy = 4;

    return { map, emissive };
  }

  private makeStreetTexture(): THREE.CanvasTexture {
    const width = 512;
    const height = 768;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create the street texture.');

    ctx.fillStyle = '#9c8770';
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 4200; i++) {
      const alpha = 0.02 + Math.random() * 0.045;
      ctx.fillStyle = `rgba(62,50,74,${alpha})`;
      const size = 1 + Math.random() * 1.6;
      ctx.fillRect(Math.random() * width, Math.random() * height, size, size);
    }

    const tableWidth = TABLE.halfWidth * 2;
    const tableDepth = TABLE.bottomZ - TABLE.topZ;
    const cellX = (TABLE.cell / tableWidth) * width;
    const cellY = (TABLE.cell / tableDepth) * height;
    const startX = ((TABLE.cityXStart + TABLE.halfWidth) / tableWidth) * width;
    const startY = ((TABLE.cityZStart - TABLE.topZ) / tableDepth) * height;

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(52,40,64,0.22)';
    for (let column = 0; column <= TABLE.columns; column++) {
      const x = startX + column * cellX;
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, startY + TABLE.rows * cellY);
      ctx.stroke();
    }
    for (let row = 0; row <= TABLE.rows; row++) {
      const y = startY + row * cellY;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX + TABLE.columns * cellX, y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255,245,225,0.1)';
    ctx.lineWidth = 6;
    for (let column = 0; column <= TABLE.columns; column += 3) {
      const x = startX + column * cellX;
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, startY + TABLE.rows * cellY);
      ctx.stroke();
    }

    const vignette = ctx.createRadialGradient(
      width / 2,
      height / 2,
      width * 0.15,
      width / 2,
      height / 2,
      width * 0.72,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(44,32,54,0.18)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }

  private makePadTexture(): THREE.CanvasTexture {
    const width = 256;
    const height = 160;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create the boost pad texture.');

    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 9;
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = 18;

    for (let i = 0; i < 3; i++) {
      const y = 44 + i * 30;
      ctx.beginPath();
      ctx.moveTo(62, y + 20);
      ctx.lineTo(128, y - 14);
      ctx.lineTo(194, y + 20);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private makeGlowTexture(): THREE.CanvasTexture {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create the glow texture.');

    const gradient = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.25, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
}
