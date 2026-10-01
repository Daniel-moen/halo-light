import { test as base, expect, type Page } from '@playwright/test';
import type { Settings } from '../src/state';

/** Every test fails if the page logs an error or throws. */
export const test = base.extend<{ errors: string[] }>({
  errors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      // Playwright's iOS WebKit build logs this for its own built-in <video>
      // placard images; it is engine-internal, not from the app.
      if (/^Button failed to load, iconName = [\w-]+-placard/.test(m.text())) return;
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));
    await use(errors);
    expect(errors, 'console errors').toEqual([]);
  }, { auto: true }],
});
export { expect };

export async function open(page: Page, settings?: Partial<Settings>) {
  if (settings) {
    await page.addInitScript((s) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('halo.settings.v1', JSON.stringify(s));
        sessionStorage.setItem('seeded', '1');
      }
    }, settings);
  }
  await page.goto('./');
  await expect(page.locator('#panel')).toBeVisible();
}

export const current = (page: Page) =>
  page.evaluate(() => (window as unknown as { halo: { settings: Settings } }).halo.settings);

/** Hide the controls and the toast so they don't cover the light. */
export async function clearView(page: Page) {
  await page.evaluate(() => {
    document.body.classList.add('panel-hidden');
    document.getElementById('toast')!.style.display = 'none';
  });
  await page.waitForTimeout(500); // panel fade + any eased transition
}

/** Read the real rendered colour of one screen pixel. */
export async function pixel(page: Page, x: number, y: number): Promise<[number, number, number]> {
  const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 }, scale: 'css' });
  return page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const img = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]] as [number, number, number];
  }, png.toString('base64'));
}

export const luma = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
