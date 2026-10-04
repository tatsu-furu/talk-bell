import { describe, expect, it } from 'vitest';
import { formatClock, parseClock } from '../src/format';
import { DEFAULT_SETTINGS, PRESETS, defaultB1, parseParams, presetIdOf, toParams, validateBells } from '../src/config';

describe('formatClock / parseClock', () => {
  it('残り時間は切り上げ、経過時間は切り捨て', () => {
    expect(formatClock(899_001, 'ceil')).toBe('15:00');
    expect(formatClock(900_000, 'ceil')).toBe('15:00');
    expect(formatClock(0, 'ceil')).toBe('0:00');
    expect(formatClock(59_999, 'floor')).toBe('0:59');
    expect(formatClock(75 * 60_000, 'floor')).toBe('75:00');
    expect(formatClock(-5, 'ceil')).toBe('0:00');
  });

  it('入力欄の文字を秒にする', () => {
    expect(parseClock('12:30')).toBe(750);
    expect(parseClock('12')).toBe(720);
    expect(parseClock('１２：００')).toBeNull(); // 全角数字は読まない
    expect(parseClock('12：00')).toBe(720);
    expect(parseClock('12:75')).toBeNull();
    expect(parseClock('abc')).toBeNull();
    expect(parseClock('')).toBeNull();
  });
});

describe('URL の読み書き', () => {
  it('?talk=15&qa=5&b1=12 が 12:00 / 15:00 / 20:00 になる', () => {
    const s = parseParams('?talk=15&qa=5&b1=12');
    expect(s.bells).toEqual({ b1: 720, b2: 900, b3: 1200 });
  });

  it('書き出して読み直すと同じ設定になる（別の端末で再現できる）', () => {
    for (const p of PRESETS) {
      const s = { ...DEFAULT_SETTINGS, bells: p.bells };
      expect(parseParams('?' + toParams(s)).bells).toEqual(p.bells);
    }
    const custom = { ...DEFAULT_SETTINGS, bells: { b1: null, b2: 750, b3: null }, display: 'elapsed' as const, muted: true };
    const back = parseParams('?' + toParams(custom));
    expect(back).toEqual({ ...custom, volume: DEFAULT_SETTINGS.volume });
  });

  it('b1 を省くと既定の 1鈴、off で使わない、qa=0 で 3鈴なし', () => {
    expect(parseParams('?talk=15&qa=5').bells.b1).toBe(720);
    expect(parseParams('?talk=10&qa=5').bells.b1).toBe(480);
    expect(parseParams('?talk=10&qa=5&b1=off').bells.b1).toBeNull();
    expect(parseParams('?talk=10&qa=0').bells.b3).toBeNull();
    expect(parseParams('?talk=10').bells.b3).toBe(900);
  });

  it('おかしな値は無視して元の設定のままにする', () => {
    expect(parseParams('?talk=abc').bells).toEqual(DEFAULT_SETTINGS.bells);
    expect(parseParams('?talk=-3').bells).toEqual(DEFAULT_SETTINGS.bells);
    expect(parseParams('?talk=10&b1=12').bells).toEqual(DEFAULT_SETTINGS.bells); // 1鈴が2鈴より後
    expect(parseParams('').bells).toEqual(DEFAULT_SETTINGS.bells);
  });

  it('小数の分も読める', () => {
    expect(parseParams('?talk=12.5&qa=2.5&b1=10').bells).toEqual({ b1: 600, b2: 750, b3: 900 });
  });
});

describe('設定の確認', () => {
  it('順番がおかしい設定を見つける', () => {
    expect(validateBells({ b1: 100, b2: 50, b3: null })).not.toBeNull();
    expect(validateBells({ b1: null, b2: 100, b3: 100 })).not.toBeNull();
    expect(validateBells({ b1: 10, b2: 100, b3: 200 })).toBeNull();
    expect(validateBells({ b1: null, b2: 0, b3: null })).not.toBeNull();
  });

  it('プリセットの判定と、1鈴の既定', () => {
    expect(presetIdOf(PRESETS[0]!.bells)).toBe('10-5');
    expect(presetIdOf({ b1: 1, b2: 2, b3: 3 })).toBe('custom');
    expect(defaultB1(900)).toBe(720);
    expect(defaultB1(60)).toBeNull();
  });
});
