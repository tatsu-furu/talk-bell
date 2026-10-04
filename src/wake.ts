/** 計測中は画面が消えないようにする（Screen Wake Lock API）。 */
export class WakeKeeper {
  private lock: WakeLockSentinel | null = null;
  private wanted = false;

  get supported(): boolean {
    return 'wakeLock' in navigator;
  }

  async acquire(): Promise<void> {
    this.wanted = true;
    if (!this.supported || this.lock) return;
    try {
      this.lock = await navigator.wakeLock.request('screen');
      this.lock.addEventListener('release', () => {
        this.lock = null;
      });
    } catch {
      this.lock = null;
    }
  }

  async release(): Promise<void> {
    this.wanted = false;
    try {
      await this.lock?.release();
    } catch {
      /* 何もしない */
    }
    this.lock = null;
  }

  /** タブに戻ったとき、必要なら取り直す。 */
  async reacquire(): Promise<void> {
    if (this.wanted && !this.lock) await this.acquire();
  }
}
