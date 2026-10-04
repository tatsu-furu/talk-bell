import './style.css';
import { Stopwatch } from './timer';
import { activeBells, dots, judgeBells, passedCount, phaseAt, phaseEndMs, sessionEndMs, type ActiveBell, type BellTimes, type Phase } from './bells';
import { formatClock, parseClock } from './format';
import { PRESETS, loadSaved, parseParams, presetIdOf, save, sameBells, toParams, validateBells, type Settings } from './config';
import { BellPlayer } from './audio';
import { WakeKeeper } from './wake';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} がありません`);
  return el as T;
};

// ---------- 状態 ----------
// URL に設定があればそれを優先し、なければ前回の設定を使う。
let settings: Settings = parseParams(location.search, loadSaved());
const watch = new Stopwatch();
const player = new BellPlayer();
const wake = new WakeKeeper();
let bells: ActiveBell[] = activeBells(settings.bells);
let handled = 0;
let lastShown = '';

player.volume = settings.volume;
player.muted = settings.muted;

// ---------- 要素 ----------
const stage = $('stage');
const clockEl = $('clock');
const phaseEl = $('phase');
const subEl = $('sub');
const nextEl = $('next-text');
const dotsEl = $('dots');
const flashEl = $('flash');
const btnToggle = $<HTMLButtonElement>('btn-toggle');
const settingsPanel = $('settings');
const btnSettings = $<HTMLButtonElement>('btn-settings');
const presetsEl = $('presets');
const errorEl = $('error');
const inputs = { b1: $<HTMLInputElement>('b1'), b2: $<HTMLInputElement>('b2'), b3: $<HTMLInputElement>('b3') };
const uses = { b1: $<HTMLInputElement>('use-b1'), b3: $<HTMLInputElement>('use-b3') };
const volumeEl = $<HTMLInputElement>('volume');
const muteEl = $<HTMLInputElement>('mute');
const shareEl = $<HTMLInputElement>('share-url');
const copyNote = $('copy-note');

const PHASE_LABEL: Record<Phase, string> = { talk: '発表中', qa: '質疑中', over: '終了（超過）' };
const PHASE_SUB: Record<Phase, string> = { talk: '発表の残り時間', qa: '質疑の残り時間', over: '超過した時間' };

// ---------- 表示 ----------
function render(): void {
  const elapsed = watch.elapsedMs();
  const t = settings.bells;
  const phase = phaseAt(t, elapsed);
  stage.dataset.phase = phase;

  let text: string;
  let sub: string;
  if (phase === 'over') {
    text = '+' + formatClock(elapsed - sessionEndMs(t), 'floor');
    sub = PHASE_SUB.over;
  } else if (settings.display === 'remaining') {
    text = formatClock((phaseEndMs(t, phase) ?? 0) - elapsed, 'ceil');
    sub = PHASE_SUB[phase];
  } else {
    text = formatClock(elapsed, 'floor');
    sub = '経過時間';
  }

  const nextBell = bells[passedCount(bells, elapsed)];
  const next = nextBell ? `次のベル　${nextBell.number}鈴　${formatClock(nextBell.ms, 'floor')}` : '次のベルはありません';
  const key = [text, phase, sub, next, handled].join('|');
  if (key === lastShown) return;
  lastShown = key;

  clockEl.textContent = text;
  phaseEl.textContent = PHASE_LABEL[phase];
  subEl.textContent = sub;
  nextEl.textContent = next;
  dotsEl.textContent = dots(bells, handled);
  document.title = `${text}｜発表ベル`;
}

function flash(): void {
  flashEl.classList.remove('on');
  stage.classList.remove('hit');
  void flashEl.offsetWidth; // アニメーションをやり直す
  flashEl.classList.add('on');
  stage.classList.add('hit');
  window.setTimeout(() => stage.classList.remove('hit'), 1200);
}

// ---------- 時刻の進行とベル ----------
function tick(): void {
  if (watch.running) {
    const j = judgeBells(bells, watch.elapsedMs(), handled);
    handled = j.handled;
    if (j.ring) {
      player.ring(j.ring.number);
      flash();
    }
  }
  render();
}

/** 時間を動かしたあと、鳴らさずに処理済みの数だけ取り直す。 */
function resync(): void {
  handled = passedCount(bells, watch.elapsedMs());
  lastShown = '';
  render();
}

window.setInterval(tick, 100);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    void wake.reacquire();
    tick();
  }
});

// ---------- 操作 ----------
function toggle(): void {
  if (watch.running) {
    watch.pause();
    void wake.release();
    btnToggle.textContent = '再開';
  } else {
    player.prepare(); // iPhone では、この操作のあとでないと音が出せない
    resync();
    watch.start();
    void wake.acquire();
    btnToggle.textContent = '一時停止';
  }
  btnToggle.setAttribute('aria-pressed', String(watch.running));
  lastShown = '';
  render();
}

function reset(confirmFirst: boolean): void {
  if (confirmFirst && watch.elapsedMs() > 1000 && !window.confirm('リセットしますか？（経過時間が 0 に戻ります）')) return;
  watch.reset();
  void wake.release();
  handled = 0;
  btnToggle.textContent = '開始';
  btnToggle.setAttribute('aria-pressed', 'false');
  lastShown = '';
  render();
}

function adjust(deltaMs: number): void {
  watch.adjust(deltaMs);
  resync();
}

function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.();
}

function setMuted(muted: boolean): void {
  settings = { ...settings, muted };
  player.muted = muted;
  muteEl.checked = muted;
  persist();
}

btnToggle.addEventListener('click', toggle);
$('btn-reset').addEventListener('click', () => reset(true));
$('btn-minus').addEventListener('click', () => adjust(-60_000));
$('btn-plus').addEventListener('click', () => adjust(60_000));
$('btn-full').addEventListener('click', toggleFullscreen);

document.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (target.matches('input[type="text"], input[type="range"], select, textarea')) return;
  if (e.code === 'Space') {
    if (target.closest('button')) return; // ボタンにフォーカスがあるときは、そのボタンを押す
    e.preventDefault();
    toggle();
  } else if (e.key === 'r' || e.key === 'R') reset(true);
  else if (e.key === 'ArrowLeft') { e.preventDefault(); adjust(-60_000); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); adjust(60_000); }
  else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
  else if (e.key === 'm' || e.key === 'M') setMuted(!settings.muted);
});

// ---------- 明るさ ----------
const themeBtn = $<HTMLButtonElement>('btn-theme');
function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.setAttribute('data-theme', theme);
  themeBtn.textContent = theme === 'dark' ? 'ライト' : 'ダーク';
  document.querySelector('#theme-color')?.setAttribute('content', theme === 'dark' ? '#121A1B' : '#F4F6F4');
  try { localStorage.setItem('talk-bell.theme', theme); } catch { /* 保存できなくてもよい */ }
}
themeBtn.addEventListener('click', () => {
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});
applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

// ---------- 設定 ----------
function persist(): void {
  save(settings);
  shareEl.value = `${location.origin}${location.pathname}?${toParams(settings)}`;
}

function applyBells(next: BellTimes): void {
  settings = { ...settings, bells: next };
  bells = activeBells(next);
  resync();
  persist();
  syncPanel();
}

function syncPanel(): void {
  const t = settings.bells;
  const id = presetIdOf(t);
  presetsEl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
  uses.b1.checked = t.b1 !== null;
  uses.b3.checked = t.b3 !== null;
  const set = (el: HTMLInputElement, sec: number | null): void => {
    if (document.activeElement === el) return; // 入力中は書き換えない
    el.value = sec === null ? '' : formatClock(sec * 1000, 'floor');
  };
  set(inputs.b1, t.b1);
  set(inputs.b2, t.b2);
  set(inputs.b3, t.b3);
  inputs.b1.disabled = !uses.b1.checked;
  inputs.b3.disabled = !uses.b3.checked;
  document.querySelectorAll<HTMLInputElement>('input[name="display"]').forEach((r) => (r.checked = r.value === settings.display));
  volumeEl.value = String(settings.volume);
  muteEl.checked = settings.muted;
  shareEl.value = `${location.origin}${location.pathname}?${toParams(settings)}`;
}

function readCustom(): void {
  const b2 = parseClock(inputs.b2.value);
  const b1 = uses.b1.checked ? parseClock(inputs.b1.value) : null;
  const b3 = uses.b3.checked ? parseClock(inputs.b3.value) : null;
  const bad =
    b2 === null ? '2鈴の時刻を「分:秒」（例 15:00）で入れてください。' :
    uses.b1.checked && b1 === null ? '1鈴の時刻を「分:秒」（例 12:00）で入れてください。' :
    uses.b3.checked && b3 === null ? '3鈴の時刻を「分:秒」（例 20:00）で入れてください。' : null;
  if (bad || b2 === null) return showError(bad);
  const next: BellTimes = { b1, b2, b3 };
  const order = validateBells(next);
  if (order) return showError(order);
  showError(null);
  if (!sameBells(next, settings.bells)) applyBells(next);
}

function showError(message: string | null): void {
  errorEl.hidden = message === null;
  errorEl.textContent = message ?? '';
}

for (const p of PRESETS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.id = p.id;
  b.textContent = p.label;
  b.addEventListener('click', () => { showError(null); applyBells(p.bells); });
  presetsEl.append(b);
}
const customBtn = document.createElement('button');
customBtn.type = 'button';
customBtn.dataset.id = 'custom';
customBtn.textContent = 'カスタム';
customBtn.addEventListener('click', () => inputs.b2.focus());
presetsEl.append(customBtn);

for (const el of [inputs.b1, inputs.b2, inputs.b3]) {
  el.addEventListener('change', readCustom);
  el.addEventListener('input', readCustom);
  el.addEventListener('blur', () => syncPanel());
}
for (const [key, el] of [['b1', uses.b1], ['b3', uses.b3]] as const) {
  el.addEventListener('change', () => {
    if (el.checked && !inputs[key].value) inputs[key].value = key === 'b1' ? formatClock(Math.max(60, settings.bells.b2 - 180) * 1000, 'floor') : formatClock((settings.bells.b2 + 300) * 1000, 'floor');
    inputs[key].disabled = !el.checked;
    readCustom();
  });
}
document.querySelectorAll<HTMLInputElement>('input[name="display"]').forEach((r) =>
  r.addEventListener('change', () => {
    if (!r.checked) return;
    settings = { ...settings, display: r.value === 'elapsed' ? 'elapsed' : 'remaining' };
    lastShown = '';
    persist();
    render();
  }),
);
volumeEl.addEventListener('input', () => {
  settings = { ...settings, volume: Number(volumeEl.value) };
  player.volume = settings.volume;
  persist();
});
muteEl.addEventListener('change', () => setMuted(muteEl.checked));
$('btn-test').addEventListener('click', () => {
  player.prepare();
  window.setTimeout(() => { player.ring(1); flash(); }, 60);
});
$('btn-copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shareEl.value);
    copyNote.textContent = 'コピーしました。';
  } catch {
    shareEl.select();
    copyNote.textContent = '選択しました。コピーしてください。';
  }
});
shareEl.addEventListener('focus', () => shareEl.select());

btnSettings.addEventListener('click', () => {
  const open = settingsPanel.hidden;
  settingsPanel.hidden = !open;
  btnSettings.setAttribute('aria-expanded', String(open));
  if (open) syncPanel();
});

if (!wake.supported) $('wake-warn').hidden = false;
syncPanel();
persist();
render();

// ---------- オフライン（Service Worker） ----------
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* 登録できなくても通常どおり使える */ });
  });
}
