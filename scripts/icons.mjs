// Render the PNG app icons from public/icons/icon.svg with Playwright's Chromium.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/icons/icon.svg', 'utf8');
// Maskable: full-bleed background, artwork inside the 80% safe zone.
const maskable = svg
  .replace('<rect width="512" height="512" rx="112" fill="#0b0b0d"/>',
    '<rect width="512" height="512" fill="#0b0b0d"/><g transform="translate(51.2 51.2) scale(0.8)">')
  .replace('</svg>', '</g></svg>');
// Apple applies its own corner mask, so give it a square tile.
const square = svg.replace(' rx="112"', '');

const jobs = [
  ['icon-192.png', 192, svg],
  ['icon-512.png', 512, svg],
  ['maskable-512.png', 512, maskable],
  ['apple-touch-icon.png', 180, square],
];

const browser = await chromium.launch();
for (const [name, size, src] of jobs) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${src}`);
  await page.screenshot({ path: `public/icons/${name}`, omitBackground: true });
  await page.close();
}
await browser.close();
console.log('icons written');
