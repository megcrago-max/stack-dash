import Phaser from 'phaser';
import { SoundManager } from './SoundManager';
import { ColorManager } from './ColorManager';

const GAME_W = 400;
const GAME_H = 600;
const BLOCK_H = 25;
const BASE_SPEED = 3;
const PERFECT_THRESHOLD = 4;

interface Block {
  x: number;
  y: number;
  w: number;
  color: number;
}

export class GameScene extends Phaser.Scene {
  private stack: Block[] = [];
  private movingBlock!: { x: number; w: number; dir: number; speed: number };
  private level = 0;
  private score = 0;
  private combo = 0;
  private bestScore = 0;
  private cameraY = 0;
  private targetCameraY = 0;
  private gameOver = false;
  private started = false;
  private waitingToStart = true;
  private sound_mgr = new SoundManager();
  private graphics!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private muteBtn!: Phaser.GameObjects.Text;
  private particles: { x: number; y: number; vx: number; vy: number; life: number; color: number; size: number }[] = [];
  private fallingPieces: { x: number; y: number; w: number; h: number; vy: number; color: number; alpha: number }[] = [];

  constructor() {
    super('game');
  }

  private muteTapped = false;

  create() {
    this.graphics = this.add.graphics();
    this.bestScore = parseInt(localStorage.getItem('stackdash_best') || '0');

    // Fullscreen interactive hit zone — most reliable click target in Phaser
    const hitZone = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0)
      .setScrollFactor(0).setDepth(0).setInteractive();
    hitZone.on('pointerdown', () => {
      if (this.muteTapped) { this.muteTapped = false; return; }
      if (this.gameOver) {
        this.restartGame();
        return;
      }
      if (this.waitingToStart) {
        this.startGame();
        return;
      }
      if (this.started) {
        this.dropBlock();
      }
    });

    // UI texts — fixed to camera via setScrollFactor(0)
    this.scoreText = this.add.text(GAME_W / 2, 40, '0', {
      fontSize: '48px', fontFamily: 'Arial, sans-serif', color: '#ffffff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10);

    this.comboText = this.add.text(GAME_W / 2, 90, '', {
      fontSize: '24px', fontFamily: 'Arial, sans-serif', color: '#ffdd57',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10);

    this.infoText = this.add.text(GAME_W / 2, GAME_H / 2 - 40, 'STACK DASH\n\nTap to Start', {
      fontSize: '36px', fontFamily: 'Arial, sans-serif', color: '#ffffff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10);

    this.muteBtn = this.add.text(GAME_W - 15, 15, '🔊', {
      fontSize: '24px',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(11).setInteractive();
    this.muteBtn.on('pointerdown', () => {
      this.muteTapped = true;
      this.sound_mgr.toggle();
      this.muteBtn.setText(this.sound_mgr.muted ? '🔇' : '🔊');
    });

    // Also bind directly to canvas DOM as fallback
    this.game.canvas.addEventListener('pointerdown', () => {
      // This fires after Phaser processes — only used as fallback
    });
    this.game.canvas.addEventListener('click', () => {
      if (this.muteTapped) { this.muteTapped = false; return; }
      if (this.gameOver) {
        this.restartGame();
        return;
      }
      if (this.waitingToStart) {
        this.startGame();
        return;
      }
      if (this.started) {
        this.dropBlock();
      }
    });

    this.waitingToStart = true;
  }

  private startGame() {
    this.waitingToStart = false;
    this.started = true;
    this.gameOver = false;
    this.level = 0;
    this.score = 0;
    this.combo = 0;
    this.cameraY = 0;
    this.targetCameraY = 0;
    this.stack = [];
    this.particles = [];
    this.fallingPieces = [];
    this.infoText.setVisible(false);
    this.scoreText.setText('0');
    this.comboText.setText('');

    // Base block
    const baseW = 160;
    this.stack.push({
      x: (GAME_W - baseW) / 2,
      y: GAME_H - BLOCK_H - 20,
      w: baseW,
      color: ColorManager.getBlockColor(0),
    });

    this.spawnMovingBlock();
  }

  private spawnMovingBlock() {
    const top = this.stack[this.stack.length - 1];
    const speed = BASE_SPEED + Math.floor(this.level / 10) * 0.8;
    this.movingBlock = {
      x: -top.w,
      w: top.w,
      dir: 1,
      speed,
    };
    this.level++;
  }

  private dropBlock() {
    if (!this.movingBlock || this.gameOver) return;

    const top = this.stack[this.stack.length - 1];
    const mx = this.movingBlock.x;
    const mw = this.movingBlock.w;
    const dropY = top.y - BLOCK_H;
    const color = ColorManager.getBlockColor(this.level);

    // Calculate overlap
    const overlapLeft = Math.max(mx, top.x);
    const overlapRight = Math.min(mx + mw, top.x + top.w);
    const overlapW = overlapRight - overlapLeft;

    if (overlapW <= 0) {
      // Complete miss — game over
      this.sound_mgr.gameOver();
      this.triggerGameOver();
      // Add the missed block as a falling piece
      this.fallingPieces.push({
        x: mx, y: dropY, w: mw, h: BLOCK_H,
        vy: 0, color, alpha: 1,
      });
      return;
    }

    // Check for perfect
    const diff = Math.abs(overlapW - top.w);
    if (diff <= PERFECT_THRESHOLD) {
      // Perfect placement — keep same width as previous block
      this.stack.push({ x: top.x, y: dropY, w: top.w, color });
      this.combo++;
      this.score += 10 + this.combo * 2;
      this.sound_mgr.perfect();
      if (this.combo % 5 === 0) this.sound_mgr.combo();
      this.comboText.setText(`PERFECT x${this.combo}!`);
      this.comboText.setScale(1.3);
      this.tweens.add({ targets: this.comboText, scaleX: 1, scaleY: 1, duration: 300, ease: 'Back.easeOut' });
      // Particles
      this.spawnParticles(top.x + top.w / 2, dropY, color);
    } else {
      // Partial overlap
      this.combo = 0;
      this.comboText.setText('');
      this.score += 10;
      this.sound_mgr.slice();
      this.stack.push({ x: overlapLeft, y: dropY, w: overlapW, color });

      // Falling sliced piece
      if (mx < top.x) {
        // Overhang on left
        this.fallingPieces.push({
          x: mx, y: dropY, w: top.x - mx, h: BLOCK_H,
          vy: 0, color, alpha: 1,
        });
      }
      if (mx + mw > top.x + top.w) {
        // Overhang on right
        const cutX = top.x + top.w;
        this.fallingPieces.push({
          x: cutX, y: dropY, w: (mx + mw) - cutX, h: BLOCK_H,
          vy: 0, color, alpha: 1,
        });
      }
      this.sound_mgr.place();
    }

    this.scoreText.setText(String(this.score));

    // Scroll camera up
    if (dropY < GAME_H / 2) {
      this.targetCameraY += BLOCK_H;
    }

    this.spawnMovingBlock();
  }

  private spawnParticles(cx: number, cy: number, color: number) {
    for (let i = 0; i < 12; i++) {
      this.particles.push({
        x: cx + (Math.random() - 0.5) * 40,
        y: cy,
        vx: (Math.random() - 0.5) * 6,
        vy: -Math.random() * 5 - 2,
        life: 1,
        color,
        size: 2 + Math.random() * 4,
      });
    }
  }

  private triggerGameOver() {
    this.gameOver = true;
    this.started = false;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      localStorage.setItem('stackdash_best', String(this.bestScore));
    }
    this.infoText.setText(`GAME OVER\n\nScore: ${this.score}\nBest: ${this.bestScore}\n\nTap to Restart`);
    this.infoText.setFontSize(30);
    this.infoText.setVisible(true);
  }

  private restartGame() {
    this.startGame();
  }

  update(_time: number, delta: number) {
    const dt = delta / 16.67; // normalize to ~60fps

    // Smooth camera
    this.cameraY += (this.targetCameraY - this.cameraY) * 0.08;

    // Move block
    if (this.started && this.movingBlock && !this.gameOver) {
      this.movingBlock.x += this.movingBlock.dir * this.movingBlock.speed * dt;
      if (this.movingBlock.x + this.movingBlock.w > GAME_W) {
        this.movingBlock.dir = -1;
      } else if (this.movingBlock.x < 0) {
        this.movingBlock.dir = 1;
      }
    }

    // Update particles
    this.particles = this.particles.filter(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.15 * dt;
      p.life -= 0.02 * dt;
      return p.life > 0;
    });

    // Update falling pieces
    this.fallingPieces = this.fallingPieces.filter(f => {
      f.vy += 0.3 * dt;
      f.y += f.vy * dt;
      f.alpha -= 0.015 * dt;
      return f.alpha > 0 && f.y < GAME_H + this.cameraY + 100;
    });

    this.draw();
  }

  private draw() {
    const g = this.graphics;
    g.clear();

    // Background gradient
    const bg = ColorManager.getBgGradient(this.level);
    g.fillStyle(Phaser.Display.Color.HexStringToColor(bg.bottom).color);
    g.fillRect(0, -this.cameraY - 1000, GAME_W, GAME_H + 2000);

    // Draw stack
    for (const block of this.stack) {
      const drawY = block.y - this.cameraY;
      g.fillStyle(block.color);
      g.fillRect(block.x, drawY, block.w, BLOCK_H);
      // Subtle highlight on top
      g.fillStyle(0xffffff, 0.15);
      g.fillRect(block.x, drawY, block.w, 3);
      // Border
      g.lineStyle(1, 0x000000, 0.2);
      g.strokeRect(block.x, drawY, block.w, BLOCK_H);
    }

    // Draw moving block
    if (this.started && this.movingBlock && !this.gameOver) {
      const top = this.stack[this.stack.length - 1];
      const drawY = top.y - BLOCK_H - this.cameraY;
      const color = ColorManager.getBlockColor(this.level);
      g.fillStyle(color);
      g.fillRect(this.movingBlock.x, drawY, this.movingBlock.w, BLOCK_H);
      g.fillStyle(0xffffff, 0.15);
      g.fillRect(this.movingBlock.x, drawY, this.movingBlock.w, 3);
      g.lineStyle(1, 0x000000, 0.2);
      g.strokeRect(this.movingBlock.x, drawY, this.movingBlock.w, BLOCK_H);
    }

    // Draw falling pieces
    for (const f of this.fallingPieces) {
      const drawY = f.y - this.cameraY;
      g.fillStyle(f.color, f.alpha);
      g.fillRect(f.x, drawY, f.w, f.h);
    }

    // Draw particles
    for (const p of this.particles) {
      const drawY = p.y - this.cameraY;
      g.fillStyle(p.color, p.life);
      g.fillCircle(p.x, drawY, p.size);
    }
  }
}
