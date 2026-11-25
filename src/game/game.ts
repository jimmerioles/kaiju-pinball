import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { AudioEngine } from './audio';
import { Ball } from './ball';
import { City } from './city';
import type { Block } from './city';
import { collideWithSegment, resolveSphereAABB } from './collision';
import type { CollisionResult } from './collision';
import { BALL, GAME, TABLE } from './config';
import { Effects } from './effects';
import { FlipperPair } from './flippers';
import type { FlipperSide } from './input';
import { Input } from './input';
import { dailySeed, makeSeed, normalizeSeed } from './rng';
import { readRecentSeeds, rememberRecentSeed } from './seed-history';
import { UI } from './ui';
import type { CalloutTone } from './ui';

const FIXED_STEP = 1 / 120;

const COMBO_MILESTONES = [5, 10, 20, 30, 45, 60];
const COMBO_CALLOUTS = ['Nice', 'Great', 'Mega combo', 'Kaiju', 'Unstoppable', 'City erased'];
const COMBO_TONES: CalloutTone[] = ['gold', 'coral', 'mint', 'lilac', 'gold', 'coral'];

const VIGNETTE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uStrength: { value: 0.42 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uStrength;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec2 centered = vUv - 0.5;
      float vignette = smoothstep(0.92, 0.28, length(centered) * 1.3);
      color.rgb *= mix(1.0, vignette, uStrength);
      float grain = (hash(vUv * vec2(1920.0, 1080.0) + uTime * 0.7) - 0.5) * 0.022;
      color.rgb += grain;
      gl_FragColor = color;
    }
  `,
};

type GameState = 'attract' | 'playing' | 'gameover';

export class Game {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly vignette: ShaderPass;
  private readonly clock = new THREE.Clock();

  private readonly city: City;
  private readonly ball: Ball;
  private readonly flippers: FlipperPair;
  private readonly effects: Effects;
  private readonly audio = new AudioEngine();
  private readonly ui: UI;
  private readonly input: Input;

  private state: GameState = 'attract';
  private seed: string;
  private score = 0;
  private bestScore = this.readBestScore();
  private combo = 0;
  private comboTimer = 0;
  private comboMilestoneIndex = 0;
  private multiplier = 1;
  private bestMultiplier = 1;
  private blocksDestroyed = 0;
  private ballsLeft: number = GAME.balls;
  private timeLeft: number = GAME.duration;
  private timeScale = 1;
  private respawnTimer = 0;
  private ballSaveTimer = 0;
  private ballSaveAvailable = true;
  private nextLaunchSave = true;
  private elapsed = 0;
  private accumulator = 0;
  private trauma = 0;
  private orbitAngle = 0;
  private cameraFit = 1;
  private readonly baseFov = 38;
  private readonly baseCameraPos = new THREE.Vector3(0, 31, 31);
  private readonly baseLookAt = new THREE.Vector3(0, 0, 1.4);
  private readonly cameraTarget = new THREE.Vector3();
  private readonly cameraLook = new THREE.Vector3();
  private readonly collision: CollisionResult = {
    hit: false,
    normal: new THREE.Vector3(),
    depth: 0,
  };
  private readonly tempTip = new THREE.Vector3();
  private readonly tempColor = new THREE.Color(0xffc857);

  private chainQueue: Array<{ block: Block; delay: number; amount: number; depth: number }> = [];
  private chainWindow = 0;
  private chainCount = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.seed = this.readSeed();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene.background = this.makeBackgroundTexture();
    this.scene.fog = new THREE.Fog(0x3a2d4a, 58, 128);

    this.camera = new THREE.PerspectiveCamera(
      this.baseFov,
      window.innerWidth / window.innerHeight,
      0.1,
      220,
    );
    this.camera.position.copy(this.baseCameraPos);
    this.camera.lookAt(this.baseLookAt);

    this.setupLights();
    this.setupEnvironment();

    this.city = new City(this.scene);
    this.ball = new Ball(this.scene);
    this.flippers = new FlipperPair(this.scene);
    this.effects = new Effects(this.scene, Math.min(window.devicePixelRatio, 1.75));

    this.ui = new UI({
      onLaunch: () => this.handleLaunch(),
      onReplay: () => this.startRun(makeSeed(), true),
      onSameCity: () => this.startRun(this.seed, true),
      onDaily: () => this.startRun(dailySeed(), true),
      onRecentSeed: (seed) => this.startRun(seed, true),
      onMute: () => {
        this.audio.unlock();
        this.ui.setMuted(this.audio.toggleMuted());
      },
      onCopySeed: () => this.copySeed(),
    });

    this.input = new Input(container, {
      onFlipper: (side: FlipperSide) => {
        if (this.state !== 'playing') return;
        this.flippers.fire(side);
        this.audio.flipper();
      },
      onLaunch: () => this.handleLaunch(),
    });

    this.city.regenerate(this.seed);
    this.ui.setSeed(this.seed);
    this.ui.setRecentSeeds(readRecentSeeds());
    this.ui.setScore(0);
    this.ui.setTimer(GAME.duration);
    this.ui.setBalls(GAME.balls);
    this.ui.setCombo(1, 0, false);
    this.ui.showStart();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.35,
      0.45,
      0.9,
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.vignette = new ShaderPass(VIGNETTE_SHADER);
    this.composer.addPass(this.vignette);

    this.fitCamera();
    this.onResize();
    window.addEventListener('resize', this.onResize);

    this.clock.start();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private frame(): void {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;
    this.update(dt);
    this.vignette.uniforms.uTime.value = this.elapsed;
    this.composer.render();
  }

  private update(dt: number): void {
    if (this.state === 'playing') {
      if (this.respawnTimer > 0) {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) {
          if (this.ballsLeft > 0) this.launchBall(this.nextLaunchSave);
          else this.endRun();
        }
      } else {
        this.ballSaveTimer = Math.max(0, this.ballSaveTimer - dt);
        this.timeLeft = Math.max(0, this.timeLeft - dt);
        if (this.timeLeft <= 0) {
          this.ui.setTimer(0);
          this.endRun();
          return;
        }

        if (this.comboTimer > 0) {
          this.comboTimer = Math.max(0, this.comboTimer - dt);
          if (this.comboTimer <= 0) this.resetCombo();
        }

        this.ui.setTimer(this.timeLeft);
        this.ui.setCombo(this.multiplier, this.comboTimer / GAME.comboWindow, this.multiplier >= 3);

        this.flippers.update(dt);
        this.accumulator += dt;
        let steps = 0;
        while (this.accumulator >= FIXED_STEP && steps < 8) {
          this.stepBall(FIXED_STEP);
          this.accumulator -= FIXED_STEP;
          steps += 1;
          if (this.state !== 'playing') break;
        }
        if (steps >= 8) this.accumulator = 0;

        if (this.state === 'playing') {
          this.processChain(dt);
          this.ball.updateVisual(dt);
        }
      }

      this.city.update(dt, this.elapsed);
      this.effects.update(dt);
      this.updateCamera(dt);
      return;
    }

    if (this.state === 'attract') {
      this.city.update(dt, this.elapsed);
      this.effects.update(dt);
      this.updateCamera(dt);
      return;
    }

    this.timeScale = THREE.MathUtils.damp(this.timeScale, 0.18, 2.4, dt);
    const scaled = dt * this.timeScale;
    this.city.update(scaled, this.elapsed);
    this.effects.update(scaled);
    this.updateCamera(dt);
  }

  private stepBall(dt: number): void {
    const ball = this.ball;
    if (!ball.active || this.state !== 'playing') return;

    ball.velocity.y += BALL.gravityY * dt;
    ball.velocity.z += BALL.gravityZ * dt;

    const steer = this.input.steer;
    if (steer !== 0) {
      ball.velocity.x += steer * BALL.steerForce * dt;
    }

    ball.position.addScaledVector(ball.velocity, dt);

    if (ball.position.y < ball.radius) {
      ball.position.y = ball.radius;
      if (ball.velocity.y < 0) {
        const bounce = -ball.velocity.y * BALL.restitution;
        ball.velocity.y = bounce > 1.2 ? bounce : 0;
      }
      ball.velocity.x *= 0.9988;
      ball.velocity.z *= 0.9988;
    }

    const limitX = TABLE.halfWidth - ball.radius;
    if (ball.position.x < -limitX) {
      ball.position.x = -limitX;
      if (ball.velocity.x < 0) {
        ball.velocity.x = -ball.velocity.x * BALL.wallRestitution;
        this.addTrauma(0.02);
      }
    } else if (ball.position.x > limitX) {
      ball.position.x = limitX;
      if (ball.velocity.x > 0) {
        ball.velocity.x = -ball.velocity.x * BALL.wallRestitution;
        this.addTrauma(0.02);
      }
    }

    const topLimit = TABLE.topZ + ball.radius;
    if (ball.position.z < topLimit) {
      ball.position.z = topLimit;
      if (ball.velocity.z < 0) {
        ball.velocity.z = -ball.velocity.z * BALL.wallRestitution;
        this.addTrauma(0.02);
      }
    }

    if (ball.position.z > TABLE.drainZ || ball.position.y < -2) {
      this.drain();
      return;
    }

    this.city.forEachNear(ball.position, ball.radius + 0.25, (block) => {
      this.collideWithBlock(block);
    });

    for (const guide of this.city.guides) {
      const impact = collideWithSegment(
        ball.position,
        ball.velocity,
        guide.a,
        guide.b,
        guide.inside,
        guide.radius,
        ball.radius,
      );
      if (impact > 4) {
        this.audio.impact(0.25 + impact * 0.03);
        this.addTrauma(0.02);
      }
    }

    const flipper = this.flippers.collide(ball.position, ball.velocity, ball.radius);
    if (flipper) {
      this.audio.flipper();
      const source = flipper === 'left' ? this.flippers.left : this.flippers.right;
      source.getTip(this.tempTip);
      this.effects.hit(this.tempTip, this.tempColor, 1.0);
      this.addTrauma(0.04);
    }

    for (const pad of this.city.pads) {
      if (pad.cooldown > 0) continue;
      if (ball.position.y > 1.25) continue;
      const dx = ball.position.x - pad.position.x;
      const dz = ball.position.z - pad.position.z;
      if (dx * dx + dz * dz > pad.radius * pad.radius) continue;

      pad.cooldown = 0.8;
      ball.velocity.x += pad.direction.x * 16;
      ball.velocity.z += pad.direction.z * 16;
      ball.velocity.y = Math.max(ball.velocity.y, 5.5);
      this.effects.pad(pad.position);
      this.audio.pad();
      this.addTrauma(0.07);
      this.addScore(50, pad.position);
    }

    const speed = ball.velocity.length();
    if (speed > BALL.maxSpeed) {
      ball.velocity.multiplyScalar(BALL.maxSpeed / speed);
    }
  }

  private collideWithBlock(block: Block): void {
    if (
      !resolveSphereAABB(this.ball.position, this.ball.radius, block.min, block.max, this.collision)
    ) {
      return;
    }

    this.ball.position.addScaledVector(this.collision.normal, this.collision.depth + 0.001);

    const normalVelocity = this.ball.velocity.dot(this.collision.normal);
    if (normalVelocity >= 0) return;

    const impactSpeed = -normalVelocity;
    const restitution = block.kind === 'bumper' ? 0.92 : 0.48;
    this.ball.velocity.addScaledVector(this.collision.normal, -(1 + restitution) * normalVelocity);
    this.ball.velocity.x += (Math.random() - 0.5) * 0.6;
    this.ball.velocity.z += (Math.random() - 0.5) * 0.6;

    if (block.kind === 'bumper' && block.bumperCooldown <= 0) {
      block.bumperCooldown = 0.2;
      this.ball.velocity.addScaledVector(this.collision.normal, 7);
      this.ball.velocity.z -= 4.5;
      this.ball.velocity.y += 2.2;

      const capPosition = new THREE.Vector3(block.center.x, block.size.y + 0.2, block.center.z);
      this.effects.bumper(capPosition, block.color);
      this.audio.bumper(0.9 + Math.random() * 0.5);
      this.addScore(250, capPosition);
      this.addTrauma(0.16);
    }

    if (impactSpeed <= 2) return;

    const damage = Math.max(0.35, (impactSpeed - 1) * 0.38);
    const destroyed = this.city.damageBlock(block, damage);
    this.registerCombo();

    if (destroyed) {
      this.blocksDestroyed += 1;
      this.addScore(120, block.center);
      this.effects.impact(block.center, block.color, impactSpeed, block.size, true);
      this.audio.impact(Math.min(1.6, 0.4 + impactSpeed * 0.08));
      this.addTrauma(Math.min(0.42, 0.06 + impactSpeed * 0.015));
      this.scheduleChain(block, 0);
    } else {
      this.addScore(20, block.center);
      this.effects.hit(block.center, block.color, impactSpeed);
      this.audio.impact(0.35 + impactSpeed * 0.04);
      this.addTrauma(0.03);
    }
  }

  private registerCombo(): void {
    this.combo += 1;
    this.comboTimer = GAME.comboWindow;
    this.multiplier = Math.min(GAME.maxMultiplier, 1 + this.combo * 0.25);
    this.bestMultiplier = Math.max(this.bestMultiplier, this.multiplier);

    if (this.combo % 3 === 0) this.audio.combo(this.combo);

    while (
      this.comboMilestoneIndex < COMBO_MILESTONES.length &&
      this.combo >= COMBO_MILESTONES[this.comboMilestoneIndex]
    ) {
      const index = this.comboMilestoneIndex;
      this.ui.showCallout(COMBO_CALLOUTS[index], COMBO_TONES[index]);
      this.comboMilestoneIndex += 1;
    }
  }

  private resetCombo(): void {
    this.combo = 0;
    this.comboTimer = 0;
    this.multiplier = 1;
    this.comboMilestoneIndex = 0;
    this.ui.setCombo(1, 0, false);
  }

  private scheduleChain(source: Block, depth: number): void {
    if (depth >= 2) return;

    const targets = new Set<Block>();
    this.city.forEachNear(source.center, 3.0, (block) => {
      if (block !== source && block.active) targets.add(block);
    });

    let added = 0;
    for (const block of targets) {
      if (this.chainQueue.length >= 60 || added >= 8) break;
      this.chainQueue.push({
        block,
        delay: 0.04 + Math.random() * 0.1,
        amount: 1.05,
        depth: depth + 1,
      });
      added += 1;
    }
  }

  private processChain(dt: number): void {
    this.chainWindow = Math.max(0, this.chainWindow - dt);
    if (this.chainWindow <= 0) this.chainCount = 0;

    for (let i = this.chainQueue.length - 1; i >= 0; i--) {
      const item = this.chainQueue[i];
      item.delay -= dt;
      if (item.delay > 0) continue;
      this.chainQueue.splice(i, 1);

      if (!item.block.active) continue;
      const destroyed = this.city.damageBlock(item.block, item.amount);
      if (!destroyed) continue;

      this.blocksDestroyed += 1;
      this.chainCount += 1;
      this.chainWindow = 0.8;

      this.addScore(70 + this.chainCount * 25, item.block.center, true);
      this.effects.impact(item.block.center, item.block.color, 5.5, item.block.size, false);
      this.audio.impact(0.6);
      this.addTrauma(0.05);
      this.scheduleChain(item.block, item.depth);

      if (this.chainCount === 3 || this.chainCount === 6 || this.chainCount === 10) {
        this.ui.showCallout(`Chain x${this.chainCount}`, 'coral');
        this.audio.combo(8 + this.chainCount);
      }
    }
  }

  private addScore(base: number, position: THREE.Vector3, chain = false): number {
    const points = Math.max(1, Math.round(base * this.multiplier));
    this.score += points;
    this.ui.setScore(this.score);
    this.ui.showPopup(position, `+${points.toLocaleString('en-US')}`, this.camera, chain);
    return points;
  }

  private addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  private drain(): void {
    if (this.state !== 'playing' || !this.ball.active) return;

    const saved = this.ballSaveAvailable && this.ballSaveTimer > 0;

    this.ball.hide();
    this.resetCombo();
    this.chainQueue.length = 0;
    this.chainCount = 0;
    this.audio.drain();
    this.effects.drain(new THREE.Vector3(this.ball.position.x, 0.2, TABLE.drainZ));

    if (saved) {
      this.ballSaveAvailable = false;
      this.ballSaveTimer = 0;
      this.nextLaunchSave = false;
      this.ui.showCallout('Ball saved', 'mint');
      this.audio.combo(5);
      this.respawnTimer = 0.8;
      return;
    }

    this.ballsLeft -= 1;
    this.ui.setBalls(this.ballsLeft);
    this.nextLaunchSave = true;
    this.ui.showCallout('Ball lost', 'coral');

    if (this.ballsLeft <= 0) {
      this.endRun();
    } else {
      this.respawnTimer = GAME.respawnDelay;
    }
  }

  private launchBall(allowSave = true): void {
    this.ballSaveAvailable = allowSave;
    this.ballSaveTimer = allowSave ? GAME.ballSaveDuration : 0;

    const startX = (Math.random() - 0.5) * 0.6;
    this.ball.reset(
      new THREE.Vector3(startX, GAME.launchHeight, TABLE.topZ + 1.8),
      new THREE.Vector3((Math.random() - 0.5) * 1.4, -2.5, GAME.launchZ),
    );
    this.accumulator = 0;
    this.audio.launch();
    this.effects.pad(new THREE.Vector3(startX, 0.1, TABLE.topZ + 1.8));
  }

  private startRun(seed: string, regenerate: boolean): void {
    if (this.state === 'playing') return;

    this.audio.unlock();

    if (regenerate) {
      this.city.regenerate(seed);
    }

    this.seed = seed;
    this.updateUrlSeed();
    this.ui.setSeed(seed);
    this.ui.setRecentSeeds(rememberRecentSeed(seed));

    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.comboMilestoneIndex = 0;
    this.multiplier = 1;
    this.bestMultiplier = 1;
    this.blocksDestroyed = 0;
    this.ballsLeft = GAME.balls;
    this.timeLeft = GAME.duration;
    this.timeScale = 1;
    this.respawnTimer = 0;
    this.ballSaveTimer = 0;
    this.ballSaveAvailable = true;
    this.nextLaunchSave = true;
    this.accumulator = 0;
    this.trauma = 0;
    this.chainQueue = [];
    this.chainWindow = 0;
    this.chainCount = 0;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();

    this.city.resetPads();
    this.effects.reset();
    this.ball.hide();
    this.flippers.reset();

    this.ui.hideEnd();
    this.ui.showHud();
    this.ui.setScore(0);
    this.ui.setTimer(GAME.duration);
    this.ui.setBalls(GAME.balls);
    this.ui.setCombo(1, 0, false);

    this.state = 'playing';
    this.input.setEnabled(true);
    this.launchBall();
  }

  private endRun(): void {
    if (this.state === 'gameover') return;

    this.state = 'gameover';
    this.input.setEnabled(false);
    this.ball.active = false;
    this.audio.gameOver();
    this.ui.hideHud();
    this.orbitAngle = Math.atan2(this.camera.position.x, this.camera.position.z);
    this.trauma = 0;

    const stats = {
      score: this.score,
      blocks: this.blocksDestroyed,
      bestCombo: this.bestMultiplier,
      rank: this.rankFor(this.score),
      seed: this.seed,
      title: this.timeLeft <= 0 ? "Time's up" : 'City demolished',
      best: this.bestScore,
      isBest: this.score > this.bestScore,
    };

    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      this.writeBestScore();
    }

    window.setTimeout(() => {
      if (this.state === 'gameover') this.ui.showEnd(stats);
    }, 900);
  }

  private handleLaunch(): void {
    if (this.state === 'attract') {
      this.startRun(this.seed, false);
    } else if (this.state === 'gameover') {
      this.startRun(makeSeed(), true);
    }
  }

  private updateCamera(dt: number): void {
    this.trauma = Math.max(0, this.trauma - dt * 1.7);

    if (this.state === 'gameover') {
      this.orbitAngle += dt * 0.2;
      const radius = 31 * this.cameraFit;
      this.cameraTarget.set(
        Math.sin(this.orbitAngle) * radius,
        25,
        Math.cos(this.orbitAngle) * radius - 1,
      );
      this.camera.position.lerp(this.cameraTarget, 1 - Math.exp(-dt * 1.4));
      this.camera.lookAt(0, 1, 0.6);
      this.restoreFov(dt);
      return;
    }

    if (this.state === 'attract') {
      const sway = this.elapsed * 0.13;
      this.cameraTarget.set(
        Math.sin(sway) * 1.8,
        31 * this.cameraFit,
        31 * this.cameraFit + Math.cos(sway) * 1.2,
      );
      this.camera.position.lerp(this.cameraTarget, 1 - Math.exp(-dt * 1.5));
      this.camera.lookAt(this.baseLookAt);
      this.restoreFov(dt);
      return;
    }

    const followX = this.ball.active ? this.ball.position.x * 0.055 : 0;
    const followZ = this.ball.active ? this.ball.position.z * 0.035 : 0;

    this.cameraTarget.set(followX, 31 * this.cameraFit, 31 * this.cameraFit + followZ);
    this.camera.position.lerp(this.cameraTarget, 1 - Math.exp(-dt * 3.2));

    const shake = this.trauma * this.trauma;
    if (shake > 0.0001) {
      this.camera.position.x += (Math.random() - 0.5) * shake * 1.6;
      this.camera.position.y += (Math.random() - 0.5) * shake * 1.0;
      this.camera.position.z += (Math.random() - 0.5) * shake * 1.2;
    }

    this.cameraLook.set(followX * 0.7, 0, 1.4 + followZ * 0.7);
    this.camera.lookAt(this.cameraLook);
    this.camera.rotation.z += (Math.random() - 0.5) * shake * 0.022;

    const targetFov = this.baseFov - this.trauma * 2.2;
    if (Math.abs(this.camera.fov - targetFov) > 0.01) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 10, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  private restoreFov(dt: number): void {
    if (Math.abs(this.camera.fov - this.baseFov) <= 0.01) return;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, this.baseFov, 8, dt);
    this.camera.updateProjectionMatrix();
  }

  private fitCamera(): void {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    this.cameraFit = aspect < 1 ? Math.min(2.1, 0.94 / Math.max(0.4, aspect)) : 1;
    this.baseCameraPos.set(0, 31 * this.cameraFit, 31 * this.cameraFit);
    this.camera.position.copy(this.baseCameraPos);
  }

  private setupLights(): void {
    const hemisphere = new THREE.HemisphereLight(0xffd9b0, 0x2a2138, 0.58);
    this.scene.add(hemisphere);

    const sun = new THREE.DirectionalLight(0xffd2a1, 1.9);
    sun.position.set(14, 26, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -22;
    sun.shadow.camera.right = 22;
    sun.shadow.camera.top = 26;
    sun.shadow.camera.bottom = -26;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 72;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.target.position.set(0, 0, -2);
    this.scene.add(sun.target);
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0x8aa4ff, 0.4);
    fill.position.set(-14, 18, -16);
    this.scene.add(fill);
  }

  private setupEnvironment(): void {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(room, 0.04).texture;
    this.scene.environmentIntensity = 0.72;
    room.dispose();
    pmrem.dispose();
  }

  private makeBackgroundTexture(): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create the background texture.');

    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, '#141020');
    gradient.addColorStop(0.44, '#3b2b4f');
    gradient.addColorStop(0.72, '#7a4a5e');
    gradient.addColorStop(1, '#e09a72');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const glow = ctx.createRadialGradient(
      size * 0.5,
      size * 0.88,
      10,
      size * 0.5,
      size * 0.88,
      size * 0.55,
    );
    glow.addColorStop(0, 'rgba(255,190,130,0.32)');
    glow.addColorStop(0.55, 'rgba(255,150,100,0.08)');
    glow.addColorStop(1, 'rgba(255,150,100,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private onResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    this.camera.aspect = width / Math.max(1, height);
    this.fitCamera();
    this.camera.updateProjectionMatrix();
  };

  private readSeed(): string {
    const value = new URL(window.location.href).searchParams.get('seed');
    if (!value) return makeSeed();
    const seed = normalizeSeed(value);
    return seed.length > 0 ? seed : makeSeed();
  }

  private updateUrlSeed(): void {
    const url = new URL(window.location.href);
    url.searchParams.set('seed', this.seed);
    window.history.replaceState(null, '', url);
  }

  private copySeed(): void {
    const url = new URL(window.location.href);
    url.searchParams.set('seed', this.seed);
    const text = url.toString();

    if (!navigator.clipboard) {
      this.ui.copyFeedback(false);
      return;
    }

    navigator.clipboard
      .writeText(text)
      .then(() => this.ui.copyFeedback(true))
      .catch(() => this.ui.copyFeedback(false));
  }

  private rankFor(score: number): string {
    if (score < 6000) return 'Concerned neighbor';
    if (score < 16000) return 'Rowdy tenant';
    if (score < 30000) return 'Property developer';
    if (score < 50000) return 'Act of God';
    return 'Kaiju';
  }

  private readBestScore(): number {
    try {
      const value = window.localStorage.getItem('kaiju-pinball-best');
      const parsed = value ? Number.parseInt(value, 10) : 0;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  private writeBestScore(): void {
    try {
      window.localStorage.setItem('kaiju-pinball-best', String(this.bestScore));
    } catch {
      // Storage may be unavailable in private or restricted contexts.
    }
  }
}
