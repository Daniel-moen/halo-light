import './style.css';
import { css, K_MAX, K_MIN, lightRGB, TINT_MAX } from './color';
import { renderLight } from './light';
import { CameraPreview } from './camera';
import { WakeLock } from './wakelock';
import {
  BUILT_IN_PRESETS, CAMERA_POS, loadSettings, loadUserPresets, sanitize, saveSettings,
  saveUserPresets, SHAPES, type Background, type Preset, type Settings, type Shape,
} from './state';

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector(sel) as T;
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll(sel)) as T[];

const stage = $('#stage');
const panel = $('#panel');
const help = $('#help');
const toastEl = $('#toast');
const body = document.body;

let settings: Settings = loadSettings();
let userPresets: Preset[] = loadUserPresets();

// ---------- Rendering ----------

let frame = 0;
let saveTimer = 0;
let easeTimer = 0;

function update(patch: Partial<Settings>, opts: { ease?: boolean } = {}) {
  settings = sanitize({ ...settings, ...patch });
  if (opts.ease) {
    stage.classList.add('ease');
    clearTimeout(easeTimer);
    easeTimer = window.setTimeout(() => stage.classList.remove('ease'), 500);
  } else if (stage.classList.contains('ease')) {
    stage.classList.remove('ease');
  }
  if (!frame) frame = requestAnimationFrame(flush);
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => saveSettings(settings), 250);
}

function flush() {
  frame = 0;
  renderLight(stage, settings);
  syncControls();
}

// ---------- Controls ----------

const ranges = $$<HTMLInputElement>('#panel input[type="range"]');
type NumKey = 'brightness' | 'kelvin' | 'tint' | 'size' | 'thickness' | 'softness' | 'fill';

const format: Record<NumKey, (v: number) => string> = {
  brightness: (v) => `${Math.round(v)}%`,
  kelvin: (v) => `${Math.round(v)} K`,
  tint: (v) => (v === 0 ? 'Neutral' : v > 0 ? `+${v} green` : `${-v} magenta`),
  size: (v) => `${Math.round(v)}`,
  thickness: (v) => `${Math.round(v)}`,
  softness: (v) => `${Math.round(v)}`,
  fill: (v) => `${Math.round(v)}%`,
};

for (const input of ranges) {
  input.addEventListener('input', () => update({ [input.name]: Number(input.value) }));
}

function gradientStops(colors: string[]) {
  return `linear-gradient(90deg, ${colors.join(', ')})`;
}

let lastGradKey = '';
function syncControls() {
  const s = settings;
  for (const input of ranges) {
    const key = input.name as NumKey;
    const v = s[key];
    if (document.activeElement !== input || input.value !== String(v)) input.value = String(v);
    const min = Number(input.min), max = Number(input.max);
    input.style.setProperty('--p', `${((v - min) / (max - min)) * 100}%`);
    const out = $(`output[data-out="${key}"]`);
    if (out) out.textContent = format[key](v);
  }

  // Colour tracks show what the slider actually does.
  const gradKey = `${s.kelvin}|${s.tint}`;
  if (gradKey !== lastGradKey) {
    lastGradKey = gradKey;
    const ks: string[] = [];
    for (let k = K_MIN; k <= K_MAX; k += 475) ks.push(css(lightRGB(k, s.tint, 1)));
    $('input.kelvin').style.setProperty('--grad', gradientStops(ks));
    const ts = [-TINT_MAX, -TINT_MAX / 2, 0, TINT_MAX / 2, TINT_MAX].map((t) => css(lightRGB(s.kelvin, t, 1)));
    $('input.tint').style.setProperty('--grad', gradientStops(ts));
    $('.brand').style.setProperty('--swatch', css(lightRGB(s.kelvin, s.tint, 1)));
  }

  setChecked('[data-shape]', 'shape', s.shape, panel);
  setChecked('[data-side]', 'side', s.side, panel);
  setChecked('[data-bg]', 'bg', s.background, panel);
  for (const el of $$('[data-for]', panel)) {
    el.hidden = !el.dataset.for!.split(' ').includes(s.shape);
  }
  renderPresetActive();
}

function setChecked(sel: string, attr: string, value: string, root: ParentNode) {
  for (const b of $$(sel, root)) {
    if (b.getAttribute('role') === 'radio') b.setAttribute('aria-checked', String(b.dataset[attr] === value));
  }
}

panel.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest('button');
  if (!t) return;
  if (t.dataset.shape) update({ shape: t.dataset.shape as Shape }, { ease: true });
  else if (t.dataset.side) update({ side: t.dataset.side as Settings['side'] }, { ease: true });
  else if (t.dataset.bg) update({ background: t.dataset.bg as Background }, { ease: true });
});

// Global actions (panel buttons, camera close, help close).
document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!t) return;
  const action = t.dataset.action!;
  if (action === 'camera') toggleCamera();
  else if (action === 'fullscreen') toggleFullscreen();
  else if (action === 'help') toggleHelp();
  else if (action === 'hide') hidePanel(true);
  else if (action === 'pos-camera') update({ ...CAMERA_POS }, { ease: true });
  else if (action === 'pos-center') update({ cx: 0.5, cy: 0.5 }, { ease: true });
});

// ---------- Presets ----------

const allPresets = () => [...BUILT_IN_PRESETS, ...userPresets];
/** Presets carry a look, not a position: where the camera is belongs to the setup. */
const lookOf = ({ cx: _x, cy: _y, ...look }: Settings) => look;
const sameLook = (a: Settings, b: Settings) => {
  const la = lookOf(a), lb = lookOf(b) as Record<string, unknown>;
  return Object.entries(la).every(([k, v]) => lb[k] === v);
};

const presetList = $('#preset-list');
const ICON_EDIT = '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>';
const ICON_X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
let renaming: string | null = null;

function applyPreset(p: Preset) {
  update(lookOf(p.settings), { ease: true });
  toast(p.name);
}

function renderPresets() {
  presetList.textContent = '';
  allPresets().forEach((p, i) => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.dataset.id = p.id;
    if (renaming === p.id) {
      const input = document.createElement('input');
      input.value = p.name;
      input.maxLength = 40;
      input.setAttribute('aria-label', 'Rename preset');
      let done = false;
      const finish = (commit: boolean) => {
        if (done) return;
        done = true;
        const name = input.value.trim();
        if (commit && name) {
          p.name = name;
          saveUserPresets(userPresets);
        }
        renaming = null;
        renderPresets();
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finish(true);
        if (e.key === 'Escape') finish(false);
      });
      input.addEventListener('blur', () => finish(true));
      chip.append(input);
      presetList.append(chip);
      input.focus();
      input.select();
      return;
    }
    const apply = document.createElement('button');
    apply.className = 'apply';
    apply.textContent = p.name;
    apply.title = `Apply “${p.name}”`;
    if (i < 9) {
      const k = document.createElement('kbd');
      k.textContent = String(i + 1);
      apply.append(k);
    }
    apply.addEventListener('click', () => applyPreset(p));
    chip.append(apply);
    if (!p.builtIn) {
      const edit = document.createElement('button');
      edit.className = 'mini';
      edit.innerHTML = ICON_EDIT;
      edit.title = 'Rename';
      edit.setAttribute('aria-label', `Rename ${p.name}`);
      edit.addEventListener('click', () => { renaming = p.id; renderPresets(); });
      const del = document.createElement('button');
      del.className = 'mini';
      del.innerHTML = ICON_X;
      del.title = 'Delete';
      del.setAttribute('aria-label', `Delete ${p.name}`);
      let armed = 0;
      del.addEventListener('click', () => {
        if (!armed) {
          // First click arms, second click deletes — no accidental losses.
          del.textContent = 'Delete?';
          armed = window.setTimeout(() => { armed = 0; del.innerHTML = ICON_X; }, 3000);
          return;
        }
        clearTimeout(armed);
        userPresets = userPresets.filter((x) => x.id !== p.id);
        saveUserPresets(userPresets);
        renderPresets();
        toast(`Deleted “${p.name}”`);
      });
      chip.append(edit, del);
    }
    presetList.append(chip);
  });
  renderPresetActive();
}

function renderPresetActive() {
  for (const chip of $$('.chip', presetList)) {
    const p = allPresets().find((x) => x.id === chip.dataset.id);
    chip.classList.toggle('active', !!p && sameLook(p.settings, settings));
  }
}

$<HTMLFormElement>('#preset-save').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $<HTMLInputElement>('#preset-save input');
  const name = input.value.trim() || `My light ${userPresets.length + 1}`;
  const existing = userPresets.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (existing) existing.settings = { ...settings };
  else userPresets.push({ id: `u${Date.now().toString(36)}`, name, settings: { ...settings } });
  saveUserPresets(userPresets);
  input.value = '';
  input.blur();
  renderPresets();
  toast(existing ? `Updated “${name}”` : `Saved “${name}”`);
});

// ---------- Panel visibility ----------

const IDLE_MS = 3500;
let idleTimer = 0;
let pinnedHidden = false; // hidden on purpose with H: stays hidden until H or a tap
let overPanel = false;
let pressingPanel = false;

function showPanel() {
  pinnedHidden = false;
  body.classList.remove('panel-hidden', 'idle');
  armIdle();
}
function hidePanel(pinned = false) {
  pinnedHidden = pinned;
  body.classList.add('panel-hidden', 'idle');
  clearTimeout(idleTimer);
  if (pinned) toast('Controls hidden — press H or tap to bring them back');
}
function armIdle() {
  clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    const typing = document.activeElement instanceof HTMLInputElement && document.activeElement.type === 'text';
    if (overPanel || pressingPanel || dragging || typing || !help.hidden) armIdle();
    else hidePanel();
  }, IDLE_MS);
}
const panelShown = () => !body.classList.contains('panel-hidden');

let lastX = -1, lastY = -1;
window.addEventListener('pointermove', (e) => {
  if (e.clientX === lastX && e.clientY === lastY) return;
  lastX = e.clientX; lastY = e.clientY;
  if (e.pointerType !== 'mouse') return; // touch reveals the panel by tapping
  body.classList.remove('idle');
  if (pinnedHidden) { armCursorHide(); return; }
  if (!panelShown()) showPanel();
  else armIdle();
}, { passive: true });

let cursorTimer = 0;
function armCursorHide() {
  clearTimeout(cursorTimer);
  cursorTimer = window.setTimeout(() => { if (!panelShown()) body.classList.add('idle'); }, IDLE_MS);
}

panel.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') overPanel = true; });
panel.addEventListener('pointerleave', () => { overPanel = false; });
panel.addEventListener('pointerdown', () => { pressingPanel = true; armIdle(); });
window.addEventListener('pointerup', () => { if (pressingPanel) { pressingPanel = false; armIdle(); } });
window.addEventListener('pointercancel', () => { pressingPanel = false; });
panel.addEventListener('focusin', armIdle);

// ---------- Dragging the light & tapping the stage ----------

let dragging = false;
let drag: { id: number; x: number; y: number; cx: number; cy: number; moved: boolean } | null = null;
const movable = () => settings.shape === 'ring' || settings.shape === 'spot';

stage.addEventListener('pointerdown', (e) => {
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, cx: settings.cx, cy: settings.cy, moved: false };
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 6) return;
  if (!movable()) return;
  drag.moved = dragging = true;
  update({
    cx: drag.cx + dx / window.innerWidth,
    cy: drag.cy + dy / window.innerHeight,
  });
});
const endDrag = (e: PointerEvent) => {
  if (!drag || e.pointerId !== drag.id) return;
  const tapped = !drag.moved && e.type === 'pointerup';
  drag = null;
  dragging = false;
  if (!tapped) { armIdle(); return; }
  if (panelShown() && e.pointerType !== 'mouse') hidePanel();
  else if (!panelShown()) showPanel();
};
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);
stage.addEventListener('dblclick', () => {
  if (movable()) update({ ...CAMERA_POS }, { ease: true });
});

// ---------- Camera, fullscreen, help, toast ----------

const camBox = $('#cam');
const camera = new CameraPreview($<HTMLVideoElement>('#cam-video'), (on) => {
  camBox.hidden = !on;
  $('#panel [data-action="camera"]').setAttribute('aria-pressed', String(on));
});
async function toggleCamera() {
  const err = await camera.toggle();
  if (err) toast(err);
}

const fsElement = () =>
  document.fullscreenElement ?? (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement;
function toggleFullscreen() {
  const root = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  const doc = document as Document & { webkitExitFullscreen?: () => void };
  if (fsElement()) {
    (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.())?.catch?.(() => {});
  } else if (root.requestFullscreen) {
    root.requestFullscreen({ navigationUI: 'hide' }).catch(() => toast('Fullscreen was blocked'));
  } else if (root.webkitRequestFullscreen) {
    root.webkitRequestFullscreen();
  } else {
    toast('Add to Home Screen to run full screen');
  }
}

function toggleHelp(force?: boolean) {
  const open = force ?? help.hidden;
  help.hidden = !open;
  if (open) { showPanel(); $('#help .close').focus(); }
}
help.addEventListener('click', (e) => { if (e.target === help) toggleHelp(false); });

let toastTimer = 0;
function toast(msg: string) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 1800);
}

// ---------- Keyboard ----------

const SIZE_KEY: Record<Shape, { key: NumKey; label: string }> = {
  ring: { key: 'size', label: 'Size' },
  spot: { key: 'size', label: 'Size' },
  edge: { key: 'thickness', label: 'Thickness' },
  softbox: { key: 'softness', label: 'Softness' },
  split: { key: 'fill', label: 'Fill' },
};

function nudge(key: NumKey, delta: number, label: string) {
  update({ [key]: settings[key] + delta });
  toast(`${label} ${format[key](settings[key])}`);
}

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const target = e.target as HTMLElement;
  if (target instanceof HTMLInputElement && target.type === 'text') return;
  const big = e.shiftKey;
  const k = e.key;

  if (!help.hidden && (k === 'Escape' || k === '?')) { e.preventDefault(); toggleHelp(false); return; }
  if (k.startsWith('Arrow')) {
    if (target instanceof HTMLInputElement && target.type === 'range') return; // native slider keys
    e.preventDefault();
    const sz = SIZE_KEY[settings.shape];
    if (k === 'ArrowUp') nudge('brightness', big ? 10 : 2, 'Brightness');
    if (k === 'ArrowDown') nudge('brightness', big ? -10 : -2, 'Brightness');
    if (k === 'ArrowRight') nudge(sz.key, big ? 5 : 1, sz.label);
    if (k === 'ArrowLeft') nudge(sz.key, big ? -5 : -1, sz.label);
    return;
  }
  if (e.repeat && !'wc'.includes(k.toLowerCase())) return;
  switch (k.toLowerCase()) {
    case 'f': toggleFullscreen(); break;
    case 'h': panelShown() ? hidePanel(true) : showPanel(); break;
    case 'w': nudge('kelvin', big ? -500 : -100, 'Temperature'); break;
    case 'c': nudge('kelvin', big ? 500 : 100, 'Temperature'); break;
    case 'v': toggleCamera(); break;
    case 's': {
      const i = SHAPES.findIndex((x) => x.id === settings.shape);
      const next = SHAPES[(i + 1) % SHAPES.length];
      update({ shape: next.id }, { ease: true });
      toast(next.label);
      break;
    }
    case 'b': {
      const order: Background[] = ['black', 'dim', 'same'];
      const next = order[(order.indexOf(settings.background) + 1) % order.length];
      update({ background: next }, { ease: true });
      toast(`Background: ${next}`);
      break;
    }
    case '?': case '/': toggleHelp(); break;
    case 'escape': if (!panelShown()) showPanel(); break;
    default:
      if (/^[1-9]$/.test(k)) {
        const p = allPresets()[Number(k) - 1];
        if (p) applyPreset(p);
      } else return;
  }
  e.preventDefault();
});

// ---------- Wake lock, install, offline ----------

const wakeStatus = $('#wake-status');
const wake = new WakeLock((held) => {
  wakeStatus.textContent = held
    ? 'Screen stays awake'
    : WakeLock.supported() ? 'Screen may dim — tap to keep awake' : window.isSecureContext
      ? 'Screen may dim — set Auto-Lock to Never'
      : 'Screen may dim (needs HTTPS)';
});
wake.acquire();
if (!WakeLock.supported()) wakeStatus.textContent = window.isSecureContext
  ? 'Screen may dim — set Auto-Lock to Never' : 'Screen may dim (needs HTTPS)';

let installEvent: (Event & { prompt: () => Promise<void> }) | null = null;
const installBtn = $('#install');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e as typeof installEvent;
  installBtn.hidden = false;
});
installBtn.addEventListener('click', async () => {
  installBtn.hidden = true;
  await installEvent?.prompt();
  installEvent = null;
});
window.addEventListener('appinstalled', () => { installBtn.hidden = true; });

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}));
}

// ---------- Boot ----------

renderLight(stage, settings);
syncControls();
renderPresets();
showPanel();

// Test/debug hook: read-only view of the current settings.
Object.defineProperty(window, 'halo', { value: { get settings() { return { ...settings }; } } });
