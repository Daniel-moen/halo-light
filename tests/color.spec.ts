import { test, expect } from '@playwright/test';
import { lightRGB } from '../src/color';

// Reference: CIE 1931 2° blackbody colours in sRGB (Mitchell Charity's table).
const REF: [number, [number, number, number]][] = [
  [2700, [255, 169, 87]],
  [3200, [255, 187, 120]],
  [4000, [255, 209, 163]],
  [5000, [255, 228, 206]],
  [5600, [255, 238, 227]],
  [6500, [255, 249, 253]],
];

test.describe('Kelvin → RGB', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'pure function: run once');

  for (const [k, ref] of REF) {
    test(`${k} K matches the blackbody reference`, () => {
      const rgb = lightRGB(k, 0, 1);
      rgb.forEach((c, i) => expect(Math.abs(c - ref[i])).toBeLessThanOrEqual(6));
    });
  }

  test('tint moves along green / magenta', () => {
    const [, g0] = lightRGB(5600, 0, 1);
    const green = lightRGB(5600, 25, 1);
    const magenta = lightRGB(5600, -25, 1);
    expect(green[1] / green[0]).toBeGreaterThan(g0 / 255);
    expect(magenta[1] / magenta[0]).toBeLessThan(g0 / 255);
  });

  test('output scales linear light', () => {
    expect(lightRGB(6500, 0, 0)).toEqual([0, 0, 0]);
    expect(lightRGB(6500, 0, 0.5)[0]).toBe(188); // 50 % linear = sRGB 188
  });
});
