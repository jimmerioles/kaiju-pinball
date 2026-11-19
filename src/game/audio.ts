export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private windSource: AudioBufferSourceNode | null = null;
  private muted = false;

  get isMuted(): boolean {
    return this.muted;
  }

  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }

    const AudioCtor = window.AudioContext;
    if (!AudioCtor) return;

    const ctx = new AudioCtor();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.85;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 18;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    master.connect(compressor);
    compressor.connect(ctx.destination);
    this.master = master;

    this.noiseBuffer = this.createNoiseBuffer(ctx);
    this.startWind(ctx, master);

    void ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.85, this.ctx.currentTime, 0.03);
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  impact(strength = 1): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted) return;

    const t = ctx.currentTime;
    const s = Math.min(1.7, Math.max(0.2, strength));

    if (this.noiseBuffer) {
      const source = ctx.createBufferSource();
      source.buffer = this.noiseBuffer;

      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 420 + s * 780;
      band.Q.value = 0.85;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.07 + s * 0.13, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12 + s * 0.06);

      source.connect(band);
      band.connect(gain);
      gain.connect(master);
      source.start(t);
      source.stop(t + 0.24);
    }

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(105 + s * 48, t);
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.2);

    const body = ctx.createGain();
    body.gain.setValueAtTime(0.14 + s * 0.13, t);
    body.gain.exponentialRampToValueAtTime(0.0001, t + 0.27);

    osc.connect(body);
    body.connect(master);
    osc.start(t);
    osc.stop(t + 0.29);
  }

  bumper(pitch = 1): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(500 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(920 * pitch, t + 0.07);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.09, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);

    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + 0.22);

    const ping = ctx.createOscillator();
    ping.type = 'sine';
    ping.frequency.setValueAtTime(1400 * pitch, t);
    ping.frequency.exponentialRampToValueAtTime(2100 * pitch, t + 0.05);

    const pingGain = ctx.createGain();
    pingGain.gain.setValueAtTime(0.045, t);
    pingGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);

    ping.connect(pingGain);
    pingGain.connect(master);
    ping.start(t);
    ping.stop(t + 0.18);
  }

  combo(level: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted) return;

    const notes = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    const note = notes[Math.min(notes.length - 1, Math.floor(level / 2))];
    const frequency = 220 * Math.pow(2, note / 12);

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = frequency;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.055, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);

    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + 0.21);
  }

  launch(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted) return;

    const t = ctx.currentTime;

    if (this.noiseBuffer) {
      const source = ctx.createBufferSource();
      source.buffer = this.noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, t);
      filter.frequency.exponentialRampToValueAtTime(1900, t + 0.34);
      filter.Q.value = 1.1;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.46);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(t);
      source.stop(t + 0.5);
    }

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(380, t + 0.36);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.07, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);

    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + 0.44);
  }

  flipper(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.06);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.03, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);

    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  pad(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(980, t + 0.13);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.06, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);

    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  drain(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(230, t);
    osc.frequency.exponentialRampToValueAtTime(68, t + 0.62);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.11, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.68);

    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + 0.7);
  }

  gameOver(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted) return;

    const t = ctx.currentTime;
    const frequencies = [220, 261.63, 329.63, 110];

    frequencies.forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      osc.type = index === 3 ? 'sine' : 'triangle';
      osc.frequency.value = frequency;

      const gain = ctx.createGain();
      const start = t + index * 0.08;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(index === 3 ? 0.05 : 0.04, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.25);

      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + 1.3);
    });
  }

  dispose(): void {
    if (this.windSource) {
      try {
        this.windSource.stop();
      } catch {
        // The source may already be stopped.
      }
      this.windSource.disconnect();
      this.windSource = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.master = null;
    this.noiseBuffer = null;
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private startWind(ctx: AudioContext, master: GainNode): void {
    if (!this.noiseBuffer) return;

    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 230;
    filter.Q.value = 0.6;

    const gain = ctx.createGain();
    gain.gain.value = 0.012;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.08;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 70;

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    source.start();
    lfo.start();
    this.windSource = source;
  }
}
