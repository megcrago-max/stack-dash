export class ColorManager {
  // Warm → cool gradient as you climb
  private static palettes = [
    [0xe74c3c, 0xc0392b], // red
    [0xe67e22, 0xd35400], // orange
    [0xf1c40f, 0xf39c12], // yellow
    [0x2ecc71, 0x27ae60], // green
    [0x1abc9c, 0x16a085], // teal
    [0x3498db, 0x2980b9], // blue
    [0x9b59b6, 0x8e44ad], // purple
    [0xe91e63, 0xc2185b], // pink
  ];

  static getBlockColor(level: number): number {
    const idx = level % this.palettes.length;
    const sub = Math.floor(level / this.palettes.length) % 2;
    return this.palettes[idx][sub];
  }

  static getBgGradient(level: number): { top: string; bottom: string } {
    const t = Math.min(level / 50, 1);
    const r1 = Math.round(26 + t * (10 - 26));
    const g1 = Math.round(26 + t * (10 - 26));
    const b1 = Math.round(46 + t * (60 - 46));
    const r2 = Math.round(40 + t * (20 - 40));
    const g2 = Math.round(40 + t * (15 - 40));
    const b2 = Math.round(60 + t * (80 - 60));
    return {
      top: `rgb(${r1},${g1},${b1})`,
      bottom: `rgb(${r2},${g2},${b2})`,
    };
  }
}
