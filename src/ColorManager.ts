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

  static getBgColor(level: number): number {
    // Subtle but visible background shift: dark navy → deep purple → dark teal
    const t = Math.min(level / 30, 1);
    const r = Math.round(15 + t * 25);
    const g = Math.round(15 + t * 10);
    const b = Math.round(35 + t * 40);
    return (r << 16) | (g << 8) | b;
  }
}
