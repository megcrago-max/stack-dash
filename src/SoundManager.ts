export class SoundManager {
  private ctx: AudioContext | null = null;
  private _muted = false;

  get muted() { return this._muted; }

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  toggle() { this._muted = !this._muted; }

  private play(freq: number, type: OscillatorType, duration: number, volume = 0.15) {
    if (this._muted) return;
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  place() { this.play(440, 'sine', 0.1, 0.12); }

  perfect() {
    if (this._muted) return;
    const ctx = this.getCtx();
    [523, 659, 784].forEach((f, i) => {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }, i * 80);
    });
  }

  slice() { this.play(220, 'sawtooth', 0.08, 0.08); }
  gameOver() { this.play(180, 'square', 0.4, 0.1); }
  combo() { this.play(880, 'sine', 0.2, 0.15); }
}
