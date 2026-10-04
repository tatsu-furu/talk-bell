/** 繰り返しの鳴らし始めの時刻（秒）。2鈴・3鈴は同じ音を少し間を空けて繰り返す。 */
export function ringOffsets(count: number, gapSec = 0.35): number[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => i * gapSec);
}

/** Web Audio で卓上ベルに近い音を合成する（録音は使わない）。 */
export class BellPlayer {
  private ctx: AudioContext | null = null;
  volume = 0.7;
  muted = false;

  /** iPhone などは、ユーザー操作のあとでないと音が出せない。開始ボタンのときに呼ぶ。 */
  prepare(): void {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    if (!this.ctx) this.ctx = new Ctor();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  ring(count: number): void {
    if (this.muted || !this.ctx) return;
    const ctx = this.ctx;
    const base = ctx.currentTime + 0.02;
    for (const offset of ringOffsets(count)) this.strike(ctx, base + offset);
  }

  private strike(ctx: AudioContext, t: number): void {
    const master = ctx.createGain();
    master.gain.value = 0.55 * this.volume;
    master.connect(ctx.destination);
    // 基音と、金属らしい非整数倍の倍音。高いほど早く消える。
    const partials: Array<[number, number, number]> = [
      [2093, 1.0, 1.6],
      [2093 * 2.76, 0.4, 0.9],
      [2093 * 5.4, 0.18, 0.5],
      [2093 * 8.93, 0.08, 0.3],
    ];
    for (const [freq, level, decay] of partials) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(level, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + decay + 0.05);
    }
  }
}
