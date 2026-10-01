import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * Emit /sw.js with a precache list of every file in the build, versioned by a
 * hash of that list so a new deploy replaces the old cache. No runtime deps.
 */
function serviceWorker(): Plugin {
  return {
    name: 'halo-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const publicFiles = ['manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png',
        'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];
      const urls = ['/', ...[...files, ...publicFiles].filter((f) => f !== 'index.html').map((f) => `/${f}`)];
      const hash = createHash('sha256');
      for (const f of files) {
        const item = bundle[f];
        hash.update(f).update(item.type === 'chunk' ? item.code : item.source);
      }
      for (const f of publicFiles) hash.update(readFileSync(`public/${f}`));
      const version = hash.digest('hex').slice(0, 12);
      const template = readFileSync('src/sw.template.js', 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template.replace('__VERSION__', version).replace('__URLS__', JSON.stringify(urls)),
      });
    },
  };
}

export default defineConfig({
  plugins: [serviceWorker()],
  build: { target: 'es2022', cssMinify: true, assetsInlineLimit: 0 },
  server: { host: true },
});
