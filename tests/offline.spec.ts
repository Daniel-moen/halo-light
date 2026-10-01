import { test, expect } from './helpers';

test('manifest and icons are installable', async ({ request }) => {
  const res = await request.get('manifest.webmanifest');
  expect(res.headers()['content-type']).toContain('application/manifest+json');
  const m = await res.json();
  expect(m).toMatchObject({ name: 'Halo Light', display: 'standalone', start_url: './' });
  for (const icon of m.icons) expect((await request.get(icon.src)).status()).toBe(200);
  expect(m.icons.some((i: { sizes: string }) => i.sizes === '512x512')).toBe(true);
  expect(m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  expect((await request.get('icons/apple-touch-icon.png')).status()).toBe(200);
});

test('works offline after the first visit', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active?.state;
  });
  await page.reload(); // now controlled by the service worker
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#panel')).toBeVisible();
  await expect(page.locator('#stage')).toHaveAttribute('data-shape', 'ring');
  await context.setOffline(false);
});
