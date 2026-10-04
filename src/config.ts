import type { BellTimes } from './bells';

export type Display = 'remaining' | 'elapsed';

export interface Settings {
  bells: BellTimes;
  display: Display;
  muted: boolean;
  volume: number; // 0〜1
}

export interface Preset {
  id: string;
  label: string;
  bells: BellTimes;
}

const min = (m: number): number => m * 60;

export const PRESETS: readonly Preset[] = [
  { id: '10-5', label: '発表10分＋質疑5分', bells: { b1: min(8), b2: min(10), b3: min(15) } },
  { id: '12-3', label: '発表12分＋質疑3分', bells: { b1: min(10), b2: min(12), b3: min(15) } },
  { id: '15-5', label: '発表15分＋質疑5分', bells: { b1: min(12), b2: min(15), b3: min(20) } },
  { id: '20-10', label: '発表20分＋質疑10分', bells: { b1: min(17), b2: min(20), b3: min(30) } },
];

export const DEFAULT_SETTINGS: Settings = {
  bells: PRESETS[2]!.bells,
  display: 'remaining',
  muted: false,
  volume: 0.7,
};

export function sameBells(a: BellTimes, b: BellTimes): boolean {
  return a.b1 === b.b1 && a.b2 === b.b2 && a.b3 === b.b3;
}

export function presetIdOf(bells: BellTimes): string {
  return PRESETS.find((p) => sameBells(p.bells, bells))?.id ?? 'custom';
}

/** 1鈴 < 2鈴 < 3鈴 になっているか。問題があれば理由を返す。 */
export function validateBells(t: BellTimes): string | null {
  if (!(t.b2 > 0)) return '2鈴（発表の終わり）の時刻を入れてください。';
  if (t.b1 !== null && !(t.b1 > 0 && t.b1 < t.b2)) return '1鈴は、0 より後で 2鈴より前にしてください。';
  if (t.b3 !== null && !(t.b3 > t.b2)) return '3鈴は、2鈴より後にしてください。';
  return null;
}

/** 発表時間から決める 1鈴 の既定（15分以上は3分前、それより短いときは2分前）。 */
export function defaultB1(talkSeconds: number): number | null {
  const before = talkSeconds >= min(15) ? min(3) : min(2);
  const b1 = talkSeconds - before;
  return b1 > 0 ? b1 : null;
}

const NUM = /^\d{1,3}(\.\d{1,2})?$/;

function minutesParam(value: string | null): number | null | undefined {
  if (value === null) return undefined; // 指定なし
  if (value === 'off') return null; // 使わない
  if (!NUM.test(value)) return undefined;
  const n = Number(value);
  return n > 999 ? undefined : Math.round(n * 60);
}

/**
 * URL から設定を読む。例：?talk=15&qa=5&b1=12
 * talk＝2鈴（発表の終わり）、qa＝質疑の長さ（0 なら3鈴なし）、b1＝1鈴の時刻（off で使わない）。
 * 読めない値は無視して、base の値を使う。
 */
export function parseParams(search: string, base: Settings = DEFAULT_SETTINGS): Settings {
  const q = new URLSearchParams(search);
  const next: Settings = { ...base, bells: { ...base.bells } };

  const talk = minutesParam(q.get('talk'));
  if (typeof talk === 'number' && talk > 0) {
    const qa = minutesParam(q.get('qa')); // 指定なし・読めないときは undefined → 既定の5分
    const qaSeconds = typeof qa === 'number' ? qa : min(5);
    const b1 = minutesParam(q.get('b1'));
    const bells: BellTimes = {
      b1: b1 === null ? null : typeof b1 === 'number' ? b1 : defaultB1(talk),
      b2: talk,
      b3: qaSeconds > 0 ? talk + qaSeconds : null,
    };
    next.bells = validateBells(bells) ? { ...base.bells } : bells;
  }
  if (q.get('mode') === 'elapsed') next.display = 'elapsed';
  if (q.get('mode') === 'remaining') next.display = 'remaining';
  if (q.get('mute') === '1') next.muted = true;
  return next;
}

const round2 = (n: number): string => String(Math.round(n * 100) / 100);

/** 設定を URL のクエリにする（共有用）。 */
export function toParams(s: Settings): string {
  const q = new URLSearchParams();
  q.set('talk', round2(s.bells.b2 / 60));
  q.set('qa', s.bells.b3 === null ? '0' : round2((s.bells.b3 - s.bells.b2) / 60));
  q.set('b1', s.bells.b1 === null ? 'off' : round2(s.bells.b1 / 60));
  if (s.display === 'elapsed') q.set('mode', 'elapsed');
  if (s.muted) q.set('mute', '1');
  return q.toString();
}

const KEY = 'talk-bell.v1';

export function loadSaved(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const o = JSON.parse(raw) as Partial<Settings>;
    const bells = o.bells && !validateBells(o.bells) ? o.bells : DEFAULT_SETTINGS.bells;
    return {
      bells,
      display: o.display === 'elapsed' ? 'elapsed' : 'remaining',
      muted: o.muted === true,
      volume: typeof o.volume === 'number' && o.volume >= 0 && o.volume <= 1 ? o.volume : DEFAULT_SETTINGS.volume,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function save(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 保存できない環境では何もしない */
  }
}
