/** ベルの時刻（秒）。null は「そのベルを使わない」。 */
export interface BellTimes {
  b1: number | null;
  b2: number;
  b3: number | null;
}

export interface ActiveBell {
  /** 1鈴・2鈴・3鈴。鳴らす回数もこの数と同じ。 */
  number: 1 | 2 | 3;
  ms: number;
}

export type Phase = 'talk' | 'qa' | 'over';

/** 使うベルを、時刻の早い順に並べる。 */
export function activeBells(t: BellTimes): ActiveBell[] {
  const list: ActiveBell[] = [];
  if (t.b1 !== null) list.push({ number: 1, ms: t.b1 * 1000 });
  list.push({ number: 2, ms: t.b2 * 1000 });
  if (t.b3 !== null) list.push({ number: 3, ms: t.b3 * 1000 });
  return list.sort((a, b) => a.ms - b.ms);
}

/** 時刻をすでに過ぎたベルの数。 */
export function passedCount(bells: readonly ActiveBell[], elapsedMs: number): number {
  let n = 0;
  for (const b of bells) if (elapsedMs >= b.ms) n++;
  return n;
}

export interface Judgement {
  /** 処理済みのベルの数（次の判定に渡す）。 */
  handled: number;
  /** いま鳴らすベル。なければ null。 */
  ring: ActiveBell | null;
}

/**
 * ベルを鳴らすかどうかの判定。
 * - その時刻を初めて超えたときに1回だけ鳴らす。
 * - 超えてから toleranceMs より遅れて気づいたとき（タブが裏に回っていたときなど）は、鳴らさず処理済みにだけする。
 * - 一度にいくつか超えていたときは、いちばん新しいベルだけを鳴らす。
 */
export function judgeBells(
  bells: readonly ActiveBell[],
  elapsedMs: number,
  handled: number,
  toleranceMs = 1500,
): Judgement {
  const passed = passedCount(bells, elapsedMs);
  if (passed <= handled) return { handled: passed, ring: null };
  const latest = bells[passed - 1];
  if (latest && elapsedMs - latest.ms <= toleranceMs) return { handled: passed, ring: latest };
  return { handled: passed, ring: null };
}

export function phaseAt(t: BellTimes, elapsedMs: number): Phase {
  if (elapsedMs < t.b2 * 1000) return 'talk';
  if (t.b3 !== null && elapsedMs < t.b3 * 1000) return 'qa';
  return 'over';
}

/** その段階の終わり（ミリ秒）。超過には終わりがない。 */
export function phaseEndMs(t: BellTimes, phase: Phase): number | null {
  if (phase === 'talk') return t.b2 * 1000;
  if (phase === 'qa') return t.b3 === null ? null : t.b3 * 1000;
  return null;
}

/** 全体の終わり（3鈴があれば3鈴、なければ2鈴）。超過時間の基準。 */
export function sessionEndMs(t: BellTimes): number {
  return (t.b3 ?? t.b2) * 1000;
}

/** ●●○ のような表示。 */
export function dots(bells: readonly ActiveBell[], handled: number): string {
  return bells.map((_, i) => (i < handled ? '●' : '○')).join('');
}
