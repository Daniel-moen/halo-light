// Colour science for the light: correlated colour temperature (Kelvin) plus a
// green/magenta tint (Duv), converted to display sRGB.
//
// Pipeline: Planckian locus chromaticity (Kim et al. 2002 cubic spline fit,
// accurate to ~1e-3 in xy over 1667–25000 K) → CIE 1960 uv → offset along the
// locus normal by Duv → CIE XYZ → linear sRGB (D65) → scaled so the brightest
// channel is 1 → scaled by output level → sRGB transfer curve.

export type RGB = [number, number, number];

export const K_MIN = 2700;
export const K_MAX = 6500;
/** Tint slider runs −50…+50; ±50 maps to Duv ±0.015 (a strong correction). */
export const TINT_MAX = 50;
const DUV_PER_STEP = 0.015 / TINT_MAX;

function planckXY(T: number): [number, number] {
  const t = Math.min(25000, Math.max(1667, T));
  const t1 = 1e3 / t, t2 = t1 * t1, t3 = t2 * t1; // in units of 1e3/T
  const x = t <= 4000
    ? -0.2661239 * t3 - 0.2343589 * t2 + 0.8776956 * t1 + 0.17991
    : -3.0258469 * t3 + 2.1070379 * t2 + 0.2226347 * t1 + 0.24039;
  const x2 = x * x, x3 = x2 * x;
  const y = t <= 2222
    ? -1.1063814 * x3 - 1.3481102 * x2 + 2.18555832 * x - 0.20219683
    : t <= 4000
      ? -0.9549476 * x3 - 1.37418593 * x2 + 2.09137015 * x - 0.16748867
      : 3.081758 * x3 - 5.8733867 * x2 + 3.75112997 * x - 0.37001483;
  return [x, y];
}

const xyToUv = ([x, y]: [number, number]): [number, number] => {
  const d = -2 * x + 12 * y + 3;
  return [(4 * x) / d, (6 * y) / d];
};
const uvToXy = ([u, v]: [number, number]): [number, number] => {
  const d = 2 * u - 8 * v + 4;
  return [(3 * u) / d, (2 * v) / d];
};

/** Linear-light sRGB for a colour temperature and tint, max channel = 1. */
export function kelvinToLinear(kelvin: number, tint = 0): RGB {
  let [u, v] = xyToUv(planckXY(kelvin));
  if (tint) {
    // Unit normal to the locus, oriented towards +v (green side).
    const a = xyToUv(planckXY(kelvin - 10));
    const b = xyToUv(planckXY(kelvin + 10));
    let nu = -(b[1] - a[1]), nv = b[0] - a[0];
    if (nv < 0) { nu = -nu; nv = -nv; }
    const len = Math.hypot(nu, nv);
    const duv = tint * DUV_PER_STEP;
    u += (nu / len) * duv;
    v += (nv / len) * duv;
  }
  const [x, y] = uvToXy([u, v]);
  const X = x / y, Y = 1, Z = (1 - x - y) / y;
  const rgb: RGB = [
    3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z,
    -0.969266 * X + 1.8760108 * Y + 0.041556 * Z,
    0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z,
  ];
  const m = Math.max(...rgb);
  return rgb.map((c) => Math.max(0, c / m)) as RGB;
}

const encode = (c: number) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

/** 8-bit sRGB for a temperature/tint at a given light output (0–1, linear). */
export function lightRGB(kelvin: number, tint: number, output: number): RGB {
  const o = Math.min(1, Math.max(0, output));
  return kelvinToLinear(kelvin, tint).map((c) => Math.round(encode(c * o) * 255)) as RGB;
}

export const css = ([r, g, b]: RGB) => `rgb(${r} ${g} ${b})`;
