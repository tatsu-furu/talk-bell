/**
 * ストップウォッチ。setInterval の回数では数えず、開始時刻との差から毎回計算する。
 * now を差し替えられるようにしてあるので、テストでは偽の時計を使う。
 */
export class Stopwatch {
  private accumulated = 0;
  private startedAt: number | null = null;

  constructor(private readonly now: () => number = () => performance.now()) {}

  get running(): boolean {
    return this.startedAt !== null;
  }

  start(): void {
    if (this.startedAt === null) this.startedAt = this.now();
  }

  /** 一時停止。止まっていた時間は数えない。 */
  pause(): void {
    if (this.startedAt === null) return;
    this.accumulated += this.now() - this.startedAt;
    this.startedAt = null;
  }

  reset(): void {
    this.accumulated = 0;
    this.startedAt = null;
  }

  elapsedMs(): number {
    return this.accumulated + (this.startedAt === null ? 0 : this.now() - this.startedAt);
  }

  /** 経過時間を deltaMs だけ動かす。0 未満にはならない。 */
  adjust(deltaMs: number): void {
    const current = this.elapsedMs();
    const target = Math.max(0, current + deltaMs);
    this.accumulated += target - current;
  }
}
