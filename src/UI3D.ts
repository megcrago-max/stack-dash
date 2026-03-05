export class UI3D {
  private container: HTMLDivElement;
  private scoreEl: HTMLDivElement;
  private comboEl: HTMLDivElement;
  private overlayEl: HTMLDivElement;
  private muteEl: HTMLDivElement;
  private comboTimeout: number | null = null;

  constructor() {
    this.container = document.createElement('div');
    Object.assign(this.container.style, {
      position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
      pointerEvents: 'none', fontFamily: "'Segoe UI', Arial, sans-serif",
      zIndex: '10', overflow: 'hidden',
    });

    this.scoreEl = this.createEl({
      position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
      fontSize: '56px', fontWeight: '900', color: '#fff',
      textShadow: '0 2px 10px rgba(0,0,0,0.5), 0 0 40px rgba(255,255,255,0.1)',
      letterSpacing: '2px',
    });

    this.comboEl = this.createEl({
      position: 'absolute', top: '85px', left: '50%', transform: 'translateX(-50%)',
      fontSize: '22px', fontWeight: '700', color: '#ffdd57',
      textShadow: '0 0 20px rgba(255,221,87,0.6)', opacity: '0',
      transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
    });

    this.overlayEl = this.createEl({
      position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      opacity: '0', transition: 'opacity 0.3s ease',
    });

    this.muteEl = this.createEl({
      position: 'absolute', top: '18px', right: '18px',
      fontSize: '28px', cursor: 'pointer', pointerEvents: 'auto',
      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
    });
    this.muteEl.textContent = '🔊';

    this.container.append(this.scoreEl, this.comboEl, this.overlayEl, this.muteEl);
  }

  private createEl(styles: Record<string, string>): HTMLDivElement {
    const el = document.createElement('div');
    Object.assign(el.style, styles);
    return el;
  }

  mount(parent: HTMLElement) { parent.appendChild(this.container); }

  setScore(score: number) { this.scoreEl.textContent = String(score); }

  showCombo(count: number) {
    this.comboEl.textContent = `✨ PERFECT x${count}!`;
    this.comboEl.style.opacity = '1';
    this.comboEl.style.transform = 'translateX(-50%) scale(1.3)';
    setTimeout(() => {
      this.comboEl.style.transform = 'translateX(-50%) scale(1)';
    }, 100);
    if (this.comboTimeout) clearTimeout(this.comboTimeout);
    this.comboTimeout = window.setTimeout(() => {
      this.comboEl.style.opacity = '0';
    }, 1500);
  }

  hideCombo() {
    this.comboEl.style.opacity = '0';
  }

  showStart() {
    this.overlayEl.style.opacity = '1';
    this.overlayEl.style.pointerEvents = 'none';
    this.overlayEl.innerHTML = `
      <div style="font-size:52px;font-weight:900;color:#fff;letter-spacing:4px;text-shadow:0 0 40px rgba(255,255,255,0.3);">STACK DASH</div>
      <div style="font-size:18px;color:rgba(255,255,255,0.7);margin-top:20px;font-weight:500;">Tap to Start</div>
    `;
  }

  showGameOver(score: number, best: number) {
    this.overlayEl.style.opacity = '1';
    this.overlayEl.style.pointerEvents = 'none';
    this.overlayEl.innerHTML = `
      <div style="font-size:36px;font-weight:900;color:#fff;letter-spacing:3px;">GAME OVER</div>
      <div style="margin-top:24px;font-size:24px;color:rgba(255,255,255,0.9);">Score: <span style="font-weight:700;color:#ffdd57;">${score}</span></div>
      <div style="margin-top:8px;font-size:18px;color:rgba(255,255,255,0.6);">Best: ${best}</div>
      <div style="margin-top:30px;font-size:16px;color:rgba(255,255,255,0.5);">Tap to Restart</div>
    `;
  }

  hideOverlay() {
    this.overlayEl.style.opacity = '0';
    this.overlayEl.style.pointerEvents = 'none';
  }

  onMuteClick(cb: () => void) {
    this.muteEl.addEventListener('mousedown', (e) => { e.stopPropagation(); cb(); });
    this.muteEl.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); cb(); });
  }

  setMuted(muted: boolean) { this.muteEl.textContent = muted ? '🔇' : '🔊'; }
}
