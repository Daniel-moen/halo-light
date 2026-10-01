import { test, expect, open, clearView, pixel, luma, current } from './helpers';

const BAND: [number, number] = [720, 342];

test('brightness slider dims the light', async ({ page }) => {
  await open(page, { shape: 'ring', softness: 0 });
  await page.locator('input[name="brightness"]').fill('25');
  await expect(page.locator('output[data-out="brightness"]')).toHaveText('25%');
  await clearView(page);
  const l = luma(await pixel(page, ...BAND));
  // 25 % linear output ≈ sRGB 137
  expect(l).toBeGreaterThan(110);
  expect(l).toBeLessThan(160);
  await page.evaluate(() => document.body.classList.remove('panel-hidden'));
  await page.locator('input[name="brightness"]').fill('0');
  await clearView(page);
  expect(luma(await pixel(page, ...BAND))).toBeLessThan(3);
});

test('temperature slider: warm is red-heavy, cool is near white', async ({ page }) => {
  await open(page, { shape: 'softbox', softness: 0 });
  await page.locator('input[name="kelvin"]').fill('2700');
  await expect(page.locator('output[data-out="kelvin"]')).toHaveText('2700 K');
  await clearView(page);
  const [r1, , b1] = await pixel(page, 720, 450);
  expect(r1).toBe(255);
  expect(b1).toBeLessThan(150);
  await page.evaluate(() => document.body.classList.remove('panel-hidden'));
  await page.locator('input[name="kelvin"]').fill('6500');
  await clearView(page);
  const [r2, g2, b2] = await pixel(page, 720, 450);
  expect(Math.min(r2, g2, b2)).toBeGreaterThan(240);
});

test('tint slider shifts green / magenta', async ({ page }) => {
  await open(page, { shape: 'softbox', softness: 0, kelvin: 5600 });
  await page.locator('input[name="tint"]').fill('50');
  await expect(page.locator('output[data-out="tint"]')).toHaveText('+50 green');
  await clearView(page);
  const green = await pixel(page, 720, 450);
  await page.evaluate(() => document.body.classList.remove('panel-hidden'));
  await page.locator('input[name="tint"]').fill('-50');
  await clearView(page);
  const magenta = await pixel(page, 720, 450);
  expect(green[1]).toBeGreaterThan(magenta[1]);
  expect(magenta[2]).toBeGreaterThan(green[2]);
});

test('size, thickness and softness change the ring', async ({ page }) => {
  await open(page, { shape: 'ring', softness: 0 });
  await page.locator('input[name="size"]').fill('20');
  await page.locator('input[name="thickness"]').fill('6');
  await page.locator('input[name="softness"]').fill('12');
  expect(await current(page)).toMatchObject({ size: 20, thickness: 6, softness: 12 });
  await clearView(page);
  expect(luma(await pixel(page, 720, 180))).toBeGreaterThan(220); // new band at r=20vmin
  expect(luma(await pixel(page, ...BAND))).toBeLessThan(10);      // old band now dark
});

test('dragging moves the ring; double-click returns it to the camera', async ({ page }) => {
  await open(page, { shape: 'ring' });
  await page.evaluate(() => document.body.classList.add('panel-hidden'));
  await page.mouse.move(400, 600);
  await page.mouse.down();
  await page.mouse.move(300, 650, { steps: 5 });
  await page.mouse.move(256, 690, { steps: 5 });
  await page.mouse.up();
  const s = await current(page);
  expect(s.cx).toBeCloseTo(0.5 - 144 / 1440, 2);
  expect(s.cy).toBeCloseTo(90 / 900, 2);
  await page.mouse.dblclick(256, 690);
  await expect.poll(async () => (await current(page)).cy).toBe(0);
});

test('position buttons centre and reset the ring', async ({ page }) => {
  await open(page, { shape: 'ring' });
  await page.locator('[data-action="pos-center"]').click();
  expect(await current(page)).toMatchObject({ cx: 0.5, cy: 0.5 });
  await page.locator('[data-action="pos-camera"]').click();
  expect(await current(page)).toMatchObject({ cx: 0.5, cy: 0 });
});

test('panel auto-hides when idle and returns on mouse move', async ({ page }) => {
  await page.clock.install();
  await open(page);
  await page.mouse.move(200, 200);
  await page.mouse.move(210, 210);
  await page.clock.runFor(2000);
  await expect(page.locator('body')).not.toHaveClass(/panel-hidden/);
  await page.clock.runFor(2500);
  await expect(page.locator('body')).toHaveClass(/panel-hidden/);
  await expect(page.locator('body')).toHaveClass(/idle/); // cursor hidden too
  await page.mouse.move(300, 300);
  await expect(page.locator('body')).not.toHaveClass(/panel-hidden/);
});

test('panel stays while the pointer is over it', async ({ page }) => {
  await page.clock.install();
  await open(page);
  await page.locator('#panel .brand').hover();
  await page.clock.runFor(8000);
  await expect(page.locator('body')).not.toHaveClass(/panel-hidden/);
});

test('settings are remembered across reloads', async ({ page }) => {
  await open(page);
  await page.locator('input[name="kelvin"]').fill('3300');
  await page.locator('#panel [data-shape="edge"]').click();
  await page.waitForTimeout(400); // debounced save
  await page.reload();
  expect(await current(page)).toMatchObject({ kelvin: 3300, shape: 'edge' });
  await expect(page.locator('input[name="kelvin"]')).toHaveValue('3300');
});

test('corrupt storage falls back to defaults', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('halo.settings.v1', '{"kelvin":99999,"shape":"nope","brightness":"x"}');
    localStorage.setItem('halo.presets.v1', 'not json');
  });
  await page.goto('/');
  expect(await current(page)).toMatchObject({ kelvin: 6500, shape: 'ring', brightness: 100 });
});
