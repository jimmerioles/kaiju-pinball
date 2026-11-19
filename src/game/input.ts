export type FlipperSide = 'left' | 'right';

export interface InputCallbacks {
  onFlipper: (side: FlipperSide) => void;
  onLaunch: () => void;
}

export class Input {
  private readonly element: HTMLElement;
  private readonly callbacks: InputCallbacks;
  private keys = new Set<'left' | 'right'>();
  private pointerX = window.innerWidth / 2;
  private pointerInside = false;
  private pointerType = 'mouse';
  private dragging = false;
  private dragStartX = 0;
  private dragSteer = 0;
  private touchMoved = false;
  private enabled = false;

  constructor(element: HTMLElement, callbacks: InputCallbacks) {
    this.element = element;
    this.callbacks = callbacks;

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('contextmenu', this.onContextMenu);
    element.addEventListener('pointerenter', this.onPointerEnter);
    element.addEventListener('pointerleave', this.onPointerLeave);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.keys.clear();
      this.dragging = false;
      this.dragSteer = 0;
      this.touchMoved = false;
    }
  }

  get steer(): number {
    if (!this.enabled) return 0;

    let value = 0;
    if (this.keys.has('left')) value -= 1;
    if (this.keys.has('right')) value += 1;

    if (this.dragging) {
      value += this.dragSteer;
    } else if (this.pointerInside && this.pointerType !== 'touch') {
      const raw = (this.pointerX / window.innerWidth - 0.5) * 2;
      const deadZone = 0.12;
      const magnitude = Math.max(0, Math.abs(raw) - deadZone) / (1 - deadZone);
      value += Math.sign(raw) * magnitude;
    }

    return Math.max(-1, Math.min(1, value));
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('contextmenu', this.onContextMenu);
    this.element.removeEventListener('pointerenter', this.onPointerEnter);
    this.element.removeEventListener('pointerleave', this.onPointerLeave);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Space') {
      // Let focused buttons activate natively so Daily run and recent chips launch their own seed.
      if (this.isInteractiveTarget(event.target)) return;
      event.preventDefault();
      if (!event.repeat) this.callbacks.onLaunch();
      return;
    }

    if (!this.enabled) return;

    switch (event.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.keys.add('left');
        event.preventDefault();
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.keys.add('right');
        event.preventDefault();
        break;
      case 'KeyZ':
      case 'ShiftLeft':
        if (!event.repeat) this.callbacks.onFlipper('left');
        event.preventDefault();
        break;
      case 'KeyM':
      case 'Slash':
      case 'ShiftRight':
        if (!event.repeat) this.callbacks.onFlipper('right');
        event.preventDefault();
        break;
      default:
        break;
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    switch (event.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.keys.delete('left');
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.keys.delete('right');
        break;
      default:
        break;
    }
  };

  private onPointerMove = (event: PointerEvent): void => {
    this.pointerX = event.clientX;
    this.pointerType = event.pointerType || 'mouse';
    this.pointerInside = true;

    if (!this.dragging || this.pointerType !== 'touch') return;

    const dx = event.clientX - this.dragStartX;
    if (Math.abs(dx) > 8) this.touchMoved = true;
    const span = Math.max(120, window.innerWidth * 0.22);
    this.dragSteer = Math.max(-1, Math.min(1, dx / span));
  };

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.enabled) return;
    if (this.isInteractiveTarget(event.target)) return;

    this.pointerX = event.clientX;
    this.pointerType = event.pointerType || 'mouse';

    if (this.pointerType === 'touch') {
      this.dragging = true;
      this.dragStartX = event.clientX;
      this.dragSteer = 0;
      this.touchMoved = false;
      event.preventDefault();
      return;
    }

    if (event.button === 0 || event.button === 2) {
      const side = event.clientX < window.innerWidth / 2 ? 'left' : 'right';
      this.callbacks.onFlipper(side);
      event.preventDefault();
    }
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.dragging) return;

    const wasTouch = this.pointerType === 'touch';
    const shouldFlip = wasTouch && !this.touchMoved;
    const x = event.clientX;

    this.dragging = false;
    this.dragSteer = 0;
    this.touchMoved = false;

    if (shouldFlip) {
      this.callbacks.onFlipper(x < window.innerWidth / 2 ? 'left' : 'right');
    }
  };

  private onPointerEnter = (event: PointerEvent): void => {
    this.pointerInside = true;
    this.pointerType = event.pointerType || 'mouse';
  };

  private onPointerLeave = (event: PointerEvent): void => {
    if ((event.pointerType || 'mouse') === 'touch') return;
    this.pointerInside = false;
  };

  private onContextMenu = (event: MouseEvent): void => {
    if (!this.enabled) return;
    if (this.isInteractiveTarget(event.target)) return;
    event.preventDefault();
  };

  private isInteractiveTarget(target: EventTarget | null): boolean {
    return target instanceof Element && !!target.closest('button, a, input, .screen');
  }
}
