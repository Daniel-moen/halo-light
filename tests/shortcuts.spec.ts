import { test, expect, open, current } from './helpers';

test('arrow keys change brightness and size', async ({ page }) => {
  await open(page, { brightness: 50, size: 30, shape: 'ring' });
  await page.keyboard.press('ArrowUp');
  expect((await current(page)).brightness).toBe(52);
  await page.keyboard.press('Shift+ArrowDown');
  expect((await current(page)).brightness).toBe(42);
  await page.keyboard.press('ArrowRight');
  expect((await current(page)).size).toBe(31);
  await page.keyboard.press('Shift+ArrowLeft');
  expect((await current(page)).size).toBe(26);
  await expect(page.locator('#toast')).toHaveText('Size 26');
});

test('arrow left/right adjust thickness on the edge light', async ({ page }) => {
  await open(page, { shape: 'edge', thickness: 10 });
  await page.keyboard.press('ArrowRight');
  expect((await current(page)).thickness).toBe(11);
});

test('W / C make the light warmer / cooler', async ({ page }) => {
  await open(page, { kelvin: 5000 });
  await page.keyboard.press('w');
  expect((await current(page)).kelvin).toBe(4900);
  await page.keyboard.press('c');
  await page.keyboard.press('c');
  expect((await current(page)).kelvin).toBe(5100);
  await page.keyboard.press('Shift+C');
  expect((await current(page)).kelvin).toBe(5600);
  await expect(page.locator('input[name="kelvin"]')).toHaveValue('5600');
});

test('number keys apply presets', async ({ page }) => {
  await open(page);
  await page.keyboard.press('2');
  expect((await current(page)).kelvin).toBe(3000);
  await page.keyboard.press('3');
  expect((await current(page)).shape).toBe('edge');
  await page.keyboard.press('9'); // no preset 9 yet: nothing happens
  expect((await current(page)).shape).toBe('edge');
});

test('H hides and shows the controls; they stay hidden on mouse move', async ({ page }) => {
  await open(page);
  await page.keyboard.press('h');
  await expect(page.locator('body')).toHaveClass(/panel-hidden/);
  await page.mouse.move(100, 100);
  await page.mouse.move(200, 220);
  await expect(page.locator('body')).toHaveClass(/panel-hidden/);
  await page.keyboard.press('h');
  await expect(page.locator('body')).not.toHaveClass(/panel-hidden/);
});

test('S cycles shapes and B cycles background', async ({ page }) => {
  await open(page, { shape: 'ring', background: 'black' });
  await page.keyboard.press('s');
  expect((await current(page)).shape).toBe('softbox');
  await page.keyboard.press('b');
  expect((await current(page)).background).toBe('dim');
});

test('? opens help, Escape closes it', async ({ page }) => {
  await open(page);
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Shortcuts' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.locator('[data-action="help"]').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('F toggles fullscreen', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'headless WebKit has no fullscreen');
  await open(page);
  await page.keyboard.press('f');
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await page.keyboard.press('f');
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
});

test('shortcuts are ignored while typing a preset name', async ({ page }) => {
  await open(page, { kelvin: 5000, shape: 'ring' });
  await page.locator('#preset-save input').fill('');
  await page.locator('#preset-save input').pressSequentially('wcsh12');
  expect(await current(page)).toMatchObject({ kelvin: 5000, shape: 'ring' });
  await expect(page.locator('body')).not.toHaveClass(/panel-hidden/);
  await expect(page.locator('#preset-save input')).toHaveValue('wcsh12');
});
