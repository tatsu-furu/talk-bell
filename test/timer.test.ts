import { describe, expect, it } from 'vitest';
import { Stopwatch } from '../src/timer';

function clock(start = 1000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('Stopwatch', () => {
  it('開始からの経過を、時計との差で数える', () => {
    const c = clock();
    const w = new Stopwatch(c.now);
    w.start();
    c.advance(12_345);
    expect(w.elapsedMs()).toBe(12_345);
  });

  it('一時停止の間は数えず、再開と停止を何度繰り返しても合計が正しい', () => {
    const c = clock();
    const w = new Stopwatch(c.now);
    let expected = 0;
    for (let i = 1; i <= 50; i++) {
      w.start();
      c.advance(100 * i);
      expected += 100 * i;
      w.pause();
      c.advance(7_000); // 止まっている時間
    }
    expect(w.elapsedMs()).toBe(expected);
    expect(w.running).toBe(false);
  });

  it('タブが1分間裏に回って更新が止まっていても、戻ったときの表示は時計どおり', () => {
    const c = clock();
    const w = new Stopwatch(c.now);
    w.start();
    c.advance(5_000);
    c.advance(60_000); // 更新されない1分
    expect(w.elapsedMs()).toBe(65_000);
  });

  it('adjust は動いている間も止まっている間も効き、0 未満にはならない', () => {
    const c = clock();
    const w = new Stopwatch(c.now);
    w.adjust(-60_000);
    expect(w.elapsedMs()).toBe(0);
    w.adjust(60_000);
    w.start();
    c.advance(10_000);
    w.adjust(60_000);
    expect(w.elapsedMs()).toBe(130_000);
    w.adjust(-1_000_000);
    expect(w.elapsedMs()).toBe(0);
  });

  it('reset で 0 に戻って止まる', () => {
    const c = clock();
    const w = new Stopwatch(c.now);
    w.start();
    c.advance(3_000);
    w.reset();
    expect(w.elapsedMs()).toBe(0);
    expect(w.running).toBe(false);
  });
});
