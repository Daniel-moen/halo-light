import { css, lightRGB } from './color';
import type { Settings } from './state';

/** Background output relative to the light for the "dim" option. */
const DIM_LEVEL = 0.08;

/**
 * Push settings into CSS custom properties on the stage. The gradients and
 * shadows that draw each shape live in style.css and read these variables, so
 * a change is a handful of property writes and one repaint — no layout.
 */
export function renderLight(stage: HTMLElement, s: Settings) {
  const out = s.brightness / 100;
  const bgLevel = s.background === 'black' ? 0 : s.background === 'dim' ? out * DIM_LEVEL : out;
  const st = stage.style;
  st.setProperty('--lc', css(lightRGB(s.kelvin, s.tint, out)));
  st.setProperty('--fc', css(lightRGB(s.kelvin, s.tint, out * (s.fill / 100))));
  st.setProperty('--bg', css(lightRGB(s.kelvin, s.tint, bgLevel)));
  st.setProperty('--r', String(s.size));
  st.setProperty('--t', String(s.thickness));
  st.setProperty('--f', String(s.softness));
  st.setProperty('--cx', String(s.cx));
  st.setProperty('--cy', String(s.cy));
  stage.dataset.shape = s.shape;
  stage.dataset.side = s.side;
}
