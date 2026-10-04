/** m:ss。残り時間は切り上げ（ベルの時刻ちょうどに 0:00 になる）、経過時間は切り捨て。 */
export function formatClock(ms: number, rounding: 'ceil' | 'floor'): string {
  const total = Math.max(0, rounding === 'ceil' ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** 入力欄の「12:30」や「12」を秒にする。読めなければ null。 */
export function parseClock(text: string): number | null {
  const t = text.trim().replace(/：/g, ':');
  const m = /^(\d{1,3})(?::([0-5]?\d))?$/.exec(t);
  if (!m) return null;
  const minutes = Number(m[1]);
  const seconds = m[2] === undefined ? 0 : Number(m[2]);
  if (minutes > 999) return null;
  return minutes * 60 + seconds;
}
