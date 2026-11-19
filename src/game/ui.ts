import { Vector3 } from 'three';
import type { Camera } from 'three';

export interface UICallbacks {
  onLaunch: () => void;
  onReplay: () => void;
  onSameCity: () => void;
  onMute: () => void;
  onCopySeed: () => void;
}

export interface EndStats {
  score: number;
  blocks: number;
  bestCombo: number;
  rank: string;
  seed: string;
  title: string;
  best: number;
  isBest: boolean;
}

export type CalloutTone = 'gold' | 'coral' | 'mint' | 'lilac';

export class UI {
  private readonly callbacks: UICallbacks;

  private readonly hud: HTMLElement;
  private readonly startScreen: HTMLElement;
  private readonly endScreen: HTMLElement;
  private readonly loading: HTMLElement;

  private readonly scoreEl: HTMLElement;
  private readonly timerEl: HTMLElement;
  private readonly comboEl: HTMLElement;
  private readonly comboFillEl: HTMLElement;
  private readonly comboBlockEl: HTMLElement;
  private readonly ballsEl: HTMLElement;
  private readonly seedLabelEl: HTMLElement;
  private readonly startSeedEl: HTMLElement;
  private readonly endSeedEl: HTMLElement;

  private readonly endTitleEl: HTMLElement;
  private readonly endScoreEl: HTMLElement;
  private readonly endBestEl: HTMLElement;
  private readonly statBlocksEl: HTMLElement;
  private readonly statComboEl: HTMLElement;
  private readonly statRankEl: HTMLElement;

  private readonly launchButton: HTMLButtonElement;
  private readonly replayButton: HTMLButtonElement;
  private readonly sameCityButton: HTMLButtonElement;
  private readonly muteButton: HTMLButtonElement;
  private readonly copySeedButton: HTMLButtonElement;

  private readonly calloutsEl: HTMLElement;
  private readonly popupsEl: HTMLElement;

  private copyResetTimer = 0;

  constructor(callbacks: UICallbacks) {
    this.callbacks = callbacks;

    this.hud = this.byId('hud');
    this.startScreen = this.byId('start-screen');
    this.endScreen = this.byId('end-screen');
    this.loading = this.byId('loading');

    this.scoreEl = this.byId('score');
    this.timerEl = this.byId('timer');
    this.comboEl = this.byId('combo');
    this.comboFillEl = this.byId('combo-fill');
    this.comboBlockEl = this.byId('combo').closest('.combo-block') ?? this.byId('combo');
    this.ballsEl = this.byId('balls');
    this.seedLabelEl = this.byId('seed-label');
    this.startSeedEl = this.byId('start-seed');
    this.endSeedEl = this.byId('end-seed');

    this.endTitleEl = this.byId('end-title');
    this.endScoreEl = this.byId('end-score');
    this.endBestEl = this.byId('end-best');
    this.statBlocksEl = this.byId('stat-blocks');
    this.statComboEl = this.byId('stat-combo');
    this.statRankEl = this.byId('stat-rank');

    this.launchButton = this.byId<HTMLButtonElement>('launch');
    this.replayButton = this.byId<HTMLButtonElement>('replay');
    this.sameCityButton = this.byId<HTMLButtonElement>('same-city');
    this.muteButton = this.byId<HTMLButtonElement>('mute');
    this.copySeedButton = this.byId<HTMLButtonElement>('copy-seed');

    this.calloutsEl = this.byId('callouts');
    this.popupsEl = this.byId('popups');

    this.launchButton.addEventListener('click', () => this.callbacks.onLaunch());
    this.replayButton.addEventListener('click', () => this.callbacks.onReplay());
    this.sameCityButton.addEventListener('click', () => this.callbacks.onSameCity());
    this.muteButton.addEventListener('click', () => this.callbacks.onMute());
    this.copySeedButton.addEventListener('click', () => this.callbacks.onCopySeed());
  }

  setScore(score: number): void {
    this.scoreEl.textContent = Math.round(score).toLocaleString('en-US');
  }

  setTimer(seconds: number): void {
    const total = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(total / 60);
    const remainder = total % 60;
    this.timerEl.textContent = `${minutes}:${remainder.toString().padStart(2, '0')}`;
    this.timerEl.classList.toggle('is-low', seconds <= 10);
  }

  setCombo(multiplier: number, fraction: number, hot: boolean): void {
    this.comboEl.textContent = `x${multiplier.toFixed(1)}`;
    this.comboFillEl.style.width = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
    this.comboBlockEl.classList.toggle('is-hot', hot);
  }

  setBalls(count: number): void {
    const pips = this.ballsEl.querySelectorAll('.ball-pip');
    pips.forEach((pip, index) => {
      pip.classList.toggle('is-empty', index >= count);
    });
  }

  setSeed(seed: string): void {
    const label = `City: ${seed}`;
    this.seedLabelEl.textContent = label;
    this.startSeedEl.textContent = label;
    this.endSeedEl.textContent = label;
  }

  showStart(): void {
    this.startScreen.classList.remove('is-hidden');
    this.endScreen.classList.add('is-hidden');
    this.hud.classList.add('is-hidden');
    this.setLoading(false);
  }

  showHud(): void {
    this.hud.classList.remove('is-hidden');
    this.startScreen.classList.add('is-hidden');
    this.endScreen.classList.add('is-hidden');
  }

  hideHud(): void {
    this.hud.classList.add('is-hidden');
  }

  showEnd(stats: EndStats): void {
    this.endTitleEl.textContent = stats.title;
    this.endScoreEl.textContent = Math.round(stats.score).toLocaleString('en-US');
    this.endBestEl.textContent = stats.isBest
      ? 'New best score'
      : `Best ${Math.round(stats.best).toLocaleString('en-US')}`;
    this.endBestEl.classList.toggle('is-best', stats.isBest);
    this.statBlocksEl.textContent = Math.round(stats.blocks).toLocaleString('en-US');
    this.statComboEl.textContent = `x${stats.bestCombo.toFixed(1)}`;
    this.statRankEl.textContent = stats.rank;
    this.endSeedEl.textContent = `City: ${stats.seed}`;
    this.copySeedButton.textContent = 'Copy city link';

    this.endScreen.classList.remove('is-hidden');
    this.hud.classList.add('is-hidden');
    this.startScreen.classList.add('is-hidden');
  }

  hideEnd(): void {
    this.endScreen.classList.add('is-hidden');
  }

  setLoading(visible: boolean): void {
    this.loading.classList.toggle('is-hidden', !visible);
  }

  setMuted(muted: boolean): void {
    this.muteButton.classList.toggle('is-muted', muted);
    this.muteButton.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    this.muteButton.title = muted ? 'Unmute sound' : 'Mute sound';
  }

  copyFeedback(success: boolean): void {
    window.clearTimeout(this.copyResetTimer);
    this.copySeedButton.textContent = success ? 'Copied' : 'Copy failed';
    this.copyResetTimer = window.setTimeout(() => {
      this.copySeedButton.textContent = 'Copy city link';
    }, 1500);
  }

  showCallout(text: string, tone: CalloutTone = 'gold'): void {
    const element = document.createElement('div');
    element.className = 'callout';
    if (tone !== 'gold') element.classList.add(`tone-${tone}`);
    element.textContent = text;

    this.calloutsEl.appendChild(element);
    while (this.calloutsEl.children.length > 3) {
      this.calloutsEl.firstElementChild?.remove();
    }

    window.setTimeout(() => element.remove(), 1150);
  }

  showPopup(worldPosition: Vector3, text: string, camera: Camera, chain = false): void {
    const projected = worldPosition.clone().project(camera);
    if (projected.z < -1 || projected.z > 1) return;

    const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;

    const element = document.createElement('div');
    element.className = chain ? 'popup is-chain' : 'popup';
    element.textContent = text;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;

    this.popupsEl.appendChild(element);
    while (this.popupsEl.children.length > 28) {
      this.popupsEl.firstElementChild?.remove();
    }

    window.setTimeout(() => element.remove(), 950);
  }

  private byId<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Missing element #${id}`);
    }
    return element as T;
  }
}
