import { test, expect, open, current } from './helpers';

test('built-in presets apply their look', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /Warm evening/ }).click();
  expect(await current(page)).toMatchObject({ kelvin: 3000, brightness: 70, background: 'dim', shape: 'ring' });
  await expect(page.locator('.chip.active')).toHaveText(/Warm evening/);
  await page.getByRole('button', { name: /Bright makeup/ }).click();
  expect(await current(page)).toMatchObject({ shape: 'softbox', kelvin: 5400 });
});

test('presets keep the light where the camera is', async ({ page }) => {
  await open(page, { cx: 0.2, cy: 0.1 });
  await page.getByRole('button', { name: /Natural daylight/ }).click();
  expect(await current(page)).toMatchObject({ cx: 0.2, cy: 0.1, kelvin: 5600 });
});

test('save, restore, rename and delete a custom preset', async ({ page }) => {
  await open(page);
  await page.locator('input[name="brightness"]').fill('42');
  await page.locator('input[name="kelvin"]').fill('4100');
  await page.locator('#preset-save input').fill('Desk at night');
  await page.locator('#preset-save button').click();
  const chip = page.locator('.chip', { hasText: 'Desk at night' });
  await expect(chip).toBeVisible();
  await expect(chip).toHaveClass(/active/);
  await expect(chip.locator('kbd')).toHaveText('6');

  // Persisted across reload, and restores the saved look.
  await page.reload();
  await page.getByRole('button', { name: /Natural daylight/ }).click();
  expect((await current(page)).brightness).toBe(100);
  await page.locator('.chip', { hasText: 'Desk at night' }).locator('.apply').click();
  expect(await current(page)).toMatchObject({ brightness: 42, kelvin: 4100 });

  // Number key applies it too.
  await page.getByRole('button', { name: /Natural daylight/ }).click();
  await page.locator('body').press('6');
  expect((await current(page)).brightness).toBe(42);

  // Rename.
  await page.getByRole('button', { name: 'Rename Desk at night' }).click();
  const field = page.getByRole('textbox', { name: 'Rename preset' });
  await field.fill('Late call');
  await field.press('Enter');
  await expect(page.locator('.chip', { hasText: 'Late call' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.chip', { hasText: 'Late call' })).toBeVisible();
  await expect(page.locator('.chip', { hasText: 'Desk at night' })).toHaveCount(0);

  // Delete needs a confirming second click.
  const del = page.getByRole('button', { name: 'Delete Late call' });
  await del.click();
  await expect(page.locator('.chip', { hasText: 'Late call' })).toBeVisible();
  await expect(del).toHaveText('Delete?');
  await del.click();
  await expect(page.locator('.chip', { hasText: 'Late call' })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.chip', { hasText: 'Late call' })).toHaveCount(0);
});

test('saving with an existing name updates that preset', async ({ page }) => {
  await open(page);
  await page.locator('#preset-save input').fill('Mine');
  await page.locator('#preset-save button').click();
  await page.locator('input[name="brightness"]').fill('60');
  await page.locator('#preset-save input').fill('mine');
  await page.locator('#preset-save button').click();
  await expect(page.locator('.chip', { hasText: /^Mine/ })).toHaveCount(1);
  await page.getByRole('button', { name: /Natural daylight/ }).click();
  await page.locator('.chip', { hasText: 'Mine' }).locator('.apply').click();
  expect((await current(page)).brightness).toBe(60);
});

test('built-in presets cannot be renamed or deleted', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('button', { name: /^(Rename|Delete) / })).toHaveCount(0);
});
