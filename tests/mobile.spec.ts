import { test, expect, open, clearView, pixel, luma } from './helpers';

test('controls fit the screen without sideways scrolling', async ({ page }) => {
  await open(page);
  const vp = page.viewportSize()!;
  const box = (await page.locator('#panel').boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vp.width);
});

test('the light renders', async ({ page }) => {
  await open(page, { shape: 'softbox', softness: 0 });
  await clearView(page);
  const vp = page.viewportSize()!;
  expect(luma(await pixel(page, Math.round(vp.width / 2), 40))).toBeGreaterThan(220);
});

test('tap shows and hides the controls; sliders work by touch', async ({ page }) => {
  await open(page);
  const vp = page.viewportSize()!;
  await page.touchscreen.tap(vp.width / 2, 60);
  await expect(page.locator('body')).toHaveClass(/panel-hidden/);
  await page.touchscreen.tap(vp.width / 2, 60);
  await expect(page.locator('body')).not.toHaveClass(/panel-hidden/);
  await page.getByRole('button', { name: /Warm evening/ }).tap();
  await expect(page.locator('output[data-out="kelvin"]')).toHaveText('3000 K');
});

test('landscape layout fits too', async ({ page }) => {
  const vp = page.viewportSize()!;
  await page.setViewportSize({ width: vp.height, height: vp.width });
  await open(page);
  const box = (await page.locator('#panel').boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(vp.width);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.height);
});
