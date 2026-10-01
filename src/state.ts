import { K_MAX, K_MIN, TINT_MAX } from './color';

export type Shape = 'ring' | 'softbox' | 'edge' | 'split' | 'spot';
export type Background = 'black' | 'dim' | 'same';

export interface Settings {
  shape: Shape;
  /** Light output, 0–100 % (linear, i.e. % of the screen's maximum light). */
  brightness: number;
  kelvin: number;
  /** −50 (magenta) … +50 (green). */
  tint: number;
  /** Ring / spotlight radius in vmin. */
  size: number;
  /** Ring / edge band thickness in vmin. */
  thickness: number;
  /** Feather width in vmin. */
  softness: number;
  background: Background;
  /** Light centre as a fraction of the viewport (ring and spotlight). */
  cx: number;
  cy: number;
  /** Split light: which side carries the key light. */
  side: 'left' | 'right';
  /** Split light: fill side output as % of the key side. */
  fill: number;
}

export interface Preset {
  id: string;
  name: string;
  builtIn?: boolean;
  settings: Settings;
}

export const SHAPES: { id: Shape; label: string }[] = [
  { id: 'ring', label: 'Ring' },
  { id: 'softbox', label: 'Soft box' },
  { id: 'edge', label: 'Edge' },
  { id: 'split', label: 'Key / fill' },
  { id: 'spot', label: 'Spot' },
];

/** Where a MacBook's camera is: centred on the top edge. */
export const CAMERA_POS = { cx: 0.5, cy: 0 };

export const DEFAULTS: Settings = {
  shape: 'ring',
  brightness: 100,
  kelvin: 5000,
  tint: 0,
  size: 38,
  thickness: 14,
  softness: 8,
  background: 'black',
  ...CAMERA_POS,
  side: 'left',
  fill: 35,
};

const p = (s: Partial<Settings>): Settings => ({ ...DEFAULTS, ...s });

export const BUILT_IN_PRESETS: Preset[] = [
  { id: 'daylight', name: 'Natural daylight', builtIn: true, settings: p({ kelvin: 5600 }) },
  { id: 'warm', name: 'Warm evening', builtIn: true,
    settings: p({ kelvin: 3000, brightness: 70, softness: 16, background: 'dim' }) },
  { id: 'call', name: 'Video call', builtIn: true,
    settings: p({ shape: 'edge', kelvin: 4800, brightness: 90, thickness: 12, softness: 18, background: 'dim' }) },
  { id: 'makeup', name: 'Bright makeup', builtIn: true,
    settings: p({ shape: 'softbox', kelvin: 5400, brightness: 100, softness: 0, background: 'same' }) },
  { id: 'soft-edge', name: 'Soft edge', builtIn: true,
    settings: p({ shape: 'edge', kelvin: 4200, brightness: 75, thickness: 6, softness: 30 }) },
];

const clamp = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
const oneOf = <T extends string>(v: unknown, opts: readonly T[], d: T): T =>
  opts.includes(v as T) ? (v as T) : d;

/** Validate anything loaded from storage into a complete Settings object. */
export function sanitize(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULTS;
  return {
    shape: oneOf(r.shape, SHAPES.map((s) => s.id), d.shape),
    brightness: clamp(r.brightness, 0, 100, d.brightness),
    kelvin: clamp(r.kelvin, K_MIN, K_MAX, d.kelvin),
    tint: clamp(r.tint, -TINT_MAX, TINT_MAX, d.tint),
    size: clamp(r.size, 5, 70, d.size),
    thickness: clamp(r.thickness, 1, 40, d.thickness),
    softness: clamp(r.softness, 0, 40, d.softness),
    background: oneOf(r.background, ['black', 'dim', 'same'] as const, d.background),
    cx: clamp(r.cx, 0, 1, d.cx),
    cy: clamp(r.cy, 0, 1, d.cy),
    side: oneOf(r.side, ['left', 'right'] as const, d.side),
    fill: clamp(r.fill, 0, 100, d.fill),
  };
}

// localStorage can be missing or throw (private mode, blocked storage), so
// every access is guarded and the app runs fine without it.
const KEY_SETTINGS = 'halo.settings.v1';
const KEY_PRESETS = 'halo.presets.v1';

function read(key: string): unknown {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage unavailable */ }
}

export const loadSettings = (): Settings => {
  const raw = read(KEY_SETTINGS);
  return raw ? sanitize(raw) : { ...DEFAULTS };
};
export const saveSettings = (s: Settings) => write(KEY_SETTINGS, s);

export function loadUserPresets(): Preset[] {
  const raw = read(KEY_PRESETS);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => x && typeof x.id === 'string' && typeof x.name === 'string')
    .map((x) => ({ id: x.id, name: String(x.name).slice(0, 40), settings: sanitize(x.settings) }));
}
export const saveUserPresets = (list: Preset[]) =>
  write(KEY_PRESETS, list.map(({ id, name, settings }) => ({ id, name, settings })));
