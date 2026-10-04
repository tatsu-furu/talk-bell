import { describe, expect, it } from 'vitest';
import { activeBells, dots, judgeBells, phaseAt, phaseEndMs, passedCount, sessionEndMs, type BellTimes } from '../src/bells';
import { ringOffsets } from '../src/audio';
import { PRESETS } from '../src/config';

const preset15 = PRESETS.find((p) => p.id === '15-5')!.bells; // 12:00 / 15:00 / 20:00

/** 100ms ごとに判定して、鳴ったベルの番号と時刻を集める。 */
function simulate(t: BellTimes, endMs: number, stepMs = 100) {
  const bells = activeBells(t);
  let handled = 0;
  const rung: Array<{ number: number; at: number }> = [];
  for (let e = 0; e <= endMs; e += stepMs) {
    const j = judgeBells(bells, e, handled);
    handled = j.handled;
    if (j.ring) rung.push({ number: j.ring.number, at: e });
  }
  return rung;
}

describe('judgeBells', () => {
  it('15分＋5分のプリセットで 12:00・15:00・20:00 に、それぞれ1回ずつ判定される', () => {
    const rung = simulate(preset15, 25 * 60_000);
    expect(rung).toEqual([
      { number: 1, at: 12 * 60_000 },
      { number: 2, at: 15 * 60_000 },
      { number: 3, at: 20 * 60_000 },
    ]);
  });

  it('鳴らす回数は 1鈴=1回、2鈴=2回、3鈴=3回', () => {
    expect(ringOffsets(1)).toEqual([0]);
    expect(ringOffsets(2)).toHaveLength(2);
    expect(ringOffsets(3)).toHaveLength(3);
    expect(ringOffsets(3)[1]).toBeCloseTo(0.35);
  });

  it('同じベルは二度鳴らさない（同じ時刻で何度判定しても1回）', () => {
    const bells = activeBells(preset15);
    let handled = 0;
    let count = 0;
    for (let i = 0; i < 20; i++) {
      const j = judgeBells(bells, 12 * 60_000 + i, handled);
      handled = j.handled;
      if (j.ring) count++;
    }
    expect(count).toBe(1);
  });

  it('タブが裏に回っていて遅れて気づいたときは、鳴らさず処理済みにだけする', () => {
    const bells = activeBells(preset15);
    const j = judgeBells(bells, 12 * 60_000 + 30_000, 0);
    expect(j.ring).toBeNull();
    expect(j.handled).toBe(1);
    // そのあと 2鈴 は普通に鳴る
    expect(judgeBells(bells, 15 * 60_000, j.handled).ring?.number).toBe(2);
  });

  it('一度に複数を超えていたら、いちばん新しいものだけ（許容内なら）鳴らす', () => {
    const bells = activeBells({ b1: 10, b2: 20, b3: 30 });
    const j = judgeBells(bells, 30_500, 0);
    expect(j.ring?.number).toBe(3);
    expect(j.handled).toBe(3);
  });

  it('時刻を巻き戻したあと（handled の取り直し）に、もう一度鳴る', () => {
    const bells = activeBells(preset15);
    const back = passedCount(bells, 5 * 60_000);
    expect(back).toBe(0);
    expect(judgeBells(bells, 12 * 60_000, back).ring?.number).toBe(1);
  });

  it('使わないベルは鳴らない', () => {
    const rung = simulate({ b1: null, b2: 60, b3: null }, 120_000);
    expect(rung).toEqual([{ number: 2, at: 60_000 }]);
  });
});

describe('段階と表示', () => {
  it('発表中 → 質疑中 → 超過', () => {
    expect(phaseAt(preset15, 0)).toBe('talk');
    expect(phaseAt(preset15, 14 * 60_000 + 59_000)).toBe('talk');
    expect(phaseAt(preset15, 15 * 60_000)).toBe('qa');
    expect(phaseAt(preset15, 20 * 60_000)).toBe('over');
  });

  it('3鈴がないときは、2鈴のあとがそのまま超過', () => {
    const t: BellTimes = { b1: null, b2: 600, b3: null };
    expect(phaseAt(t, 599_000)).toBe('talk');
    expect(phaseAt(t, 600_000)).toBe('over');
    expect(sessionEndMs(t)).toBe(600_000);
  });

  it('段階の終わり', () => {
    expect(phaseEndMs(preset15, 'talk')).toBe(900_000);
    expect(phaseEndMs(preset15, 'qa')).toBe(1_200_000);
    expect(phaseEndMs(preset15, 'over')).toBeNull();
  });

  it('●○ の表示', () => {
    const bells = activeBells(preset15);
    expect(dots(bells, 0)).toBe('○○○');
    expect(dots(bells, 2)).toBe('●●○');
  });
});
