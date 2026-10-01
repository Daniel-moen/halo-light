import { test, expect, open, clearView, pixel, luma } from './helpers';

// Viewport 1440×900 → 1vmin = 9px. Defaults: ring at top centre, r=38, t=14, soft=8.

test('ring: lit band around the camera, dark inside and outside', async ({ page }) => {
  await open(page, { shape: 'ring' });
  await clearView(page);
  expect(luma(await pixel(page, 720, 342))).toBeGreaterThan(220); // on the band
  expect(luma(await pixel(page, 720, 150))).toBeLessThan(10);     // inside the ring
  expect(luma(await pixel(page, 720, 600))).toBeLessThan(10);     // below it
  expect(luma(await pixel(page, 40, 860))).toBeLessThan(10);
});

test('soft box: whole screen lit', async ({ page }) => {
  await open(page, { shape: 'softbox', softness: 0 });
  await clearView(page);
  for (const [x, y] of [[720, 450], [20, 20], [1420, 880]]) {
    expect(luma(await pixel(page, x, y))).toBeGreaterThan(220);
  }
});

test('edge light: bright frame, dark centre', async ({ page }) => {
  await open(page, { shape: 'edge', thickness: 10, softness: 4 });
  await clearView(page);
  expect(luma(await pixel(page, 10, 450))).toBeGreaterThan(220);
  expect(luma(await pixel(page, 720, 6))).toBeGreaterThan(220);
  expect(luma(await pixel(page, 1430, 890))).toBeGreaterThan(220);
  expect(luma(await pixel(page, 720, 450))).toBeLessThan(10);
});

test('key / fill: key side brighter, side switch flips it', async ({ page }) => {
  await open(page, { shape: 'split', fill: 35, softness: 4 });
  await clearView(page);
  let left = luma(await pixel(page, 100, 450));
  let right = luma(await pixel(page, 1340, 450));
  expect(left).toBeGreaterThan(220);
  expect(right).toBeGreaterThan(100); // 35 % output ≈ sRGB 160
  expect(right).toBeLessThan(190);
  await page.evaluate(() => document.body.classList.remove('panel-hidden'));
  await page.locator('[data-side="right"]').click();
  await clearView(page);
  left = luma(await pixel(page, 100, 450));
  right = luma(await pixel(page, 1340, 450));
  expect(right).toBeGreaterThan(220);
  expect(left).toBeLessThan(190);
});

test('spotlight: lit disc at its position', async ({ page }) => {
  await open(page, { shape: 'spot', cx: 0.5, cy: 0.5, size: 20, softness: 4 });
  await clearView(page);
  expect(luma(await pixel(page, 720, 450))).toBeGreaterThan(220);
  expect(luma(await pixel(page, 720, 450 + 150))).toBeGreaterThan(220);
  expect(luma(await pixel(page, 100, 100))).toBeLessThan(10);
});

test('background: dim and same light the area outside the ring', async ({ page }) => {
  await open(page, { shape: 'ring', background: 'dim' });
  await clearView(page);
  const dim = luma(await pixel(page, 40, 860));
  expect(dim).toBeGreaterThan(40);
  expect(dim).toBeLessThan(120);
  await page.evaluate(() => document.body.classList.remove('panel-hidden'));
  await page.locator('[data-bg="same"]').click();
  await clearView(page);
  expect(luma(await pixel(page, 40, 860))).toBeGreaterThan(220);
});

test('shape buttons switch shapes and show only relevant controls', async ({ page }) => {
  await open(page);
  const size = page.locator('input[name="size"]');
  const fill = page.locator('input[name="fill"]');
  await page.locator('#panel [data-shape="split"]').click();
  await expect(page.locator('#stage')).toHaveAttribute('data-shape', 'split');
  await expect(fill).toBeVisible();
  await expect(size).toBeHidden();
  await page.locator('#panel [data-shape="ring"]').click();
  await expect(size).toBeVisible();
  await expect(fill).toBeHidden();
});
