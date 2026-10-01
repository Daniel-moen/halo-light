import { test, expect, open } from './helpers';

test('camera preview starts mirrored and fully releases the camera when hidden', async ({ page }) => {
  await open(page);
  await page.keyboard.press('v');
  const cam = page.locator('#cam');
  await expect(cam).toBeVisible();
  await expect(page.locator('#panel [data-action="camera"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => {
    const v = document.querySelector('video')!;
    (window as any).__stream = v.srcObject;
    return v.srcObject instanceof MediaStream && v.videoWidth > 0;
  })).toBe(true);
  expect(await page.locator('#cam-video').evaluate((v) => getComputedStyle(v).transform)).toContain('matrix(-1');

  // Hide with the close button on the preview.
  await page.locator('.cam-close').click();
  await expect(cam).toBeHidden();
  const released = await page.evaluate(() => {
    const s = (window as any).__stream as MediaStream;
    return {
      ended: s.getTracks().every((t) => t.readyState === 'ended'),
      src: document.querySelector('video')!.srcObject,
    };
  });
  expect(released).toEqual({ ended: true, src: null });

  // And back on with the panel button, off with V.
  await page.locator('#panel [data-action="camera"]').click();
  await expect(cam).toBeVisible();
  await page.keyboard.press('v');
  await expect(cam).toBeHidden();
});

test('camera is released when the page is backgrounded', async ({ page }) => {
  await open(page);
  await page.keyboard.press('v');
  await expect(page.locator('#cam')).toBeVisible();
  await page.evaluate(() => {
    (window as any).__stream = document.querySelector('video')!.srcObject;
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#cam')).toBeHidden();
  expect(await page.evaluate(() =>
    ((window as any).__stream as MediaStream).getTracks().every((t) => t.readyState === 'ended'))).toBe(true);
});
