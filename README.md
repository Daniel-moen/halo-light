# Halo Light

A screen light for video calls: ring, soft box, edge light, key/fill and spotlight,
with accurate colour temperature. It's an installable PWA with no backend, works offline,
and is about 10 kB gzipped.

## Run

```sh
npm install
./start.sh --build     # build + serve dist/ detached on 0.0.0.0:8050 (pid in server.pid, log in server.log)
./stop.sh
npm run dev            # Vite dev server
npm test               # Playwright: Chromium, WebKit, iPhone and iPad
npm run icons          # re-render PNG icons from public/icons/icon.svg
```

## Shortcuts

| Key | Action |
| --- | --- |
| F | Fullscreen |
| H | Hide / show controls (stays hidden until H or a tap) |
| ↑ / ↓ | Brightness (Shift = ×5) |
| ← / → | Size (ring, spot) · thickness (edge) · softness (soft box) · fill (key/fill) |
| W / C | Warmer / cooler by 100 K (Shift = 500 K) |
| V | Camera preview on / off |
| S / B | Next shape / next background |
| 1–9 | Presets |
| ? / Esc | Help / close |

Drag the ring or spotlight to move it. Double-click to put it back at the camera.

## Notes

- Colour: the Planckian locus (Kim et al.) is shifted by Duv for tint, then converted XYZ → linear sRGB. The result is
  within ~4/255 of the CIE blackbody reference. Brightness is linear light output.
- The camera preview stays local. Its tracks are stopped when you hide it or when the page goes into the background.
- Camera, Wake Lock and the service worker need a secure context: `localhost` or HTTPS.
