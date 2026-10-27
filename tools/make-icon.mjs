#!/usr/bin/env node
/**
 * Renders WikiSpin's original app icon and splash/adaptive-icon assets from SVG.
 * Concept: the reel cabinet. Three tiles slide past a brass marker; the winning
 * center tile holds an open book. Usage: node tools/make-icon.mjs
 */
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = (f) => path.join(ROOT, 'assets', f);

const INDIGO = '#1B2350';
const TILE = '#2C3772';
const BRASS = '#F2B630';
const INK = '#E9ECFF';

const book = (cx, cy, s, color) => `
  <g transform="translate(${cx} ${cy}) scale(${s})" fill="none" stroke="${color}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round">
    <path d="M0 -38 C -22 -52, -58 -52, -78 -42 L -78 42 C -58 32, -22 32, 0 46 Z"/>
    <path d="M0 -38 C 22 -52, 58 -52, 78 -42 L 78 42 C 58 32, 22 32, 0 46 Z"/>
    <path d="M-60 -20 C -45 -26, -24 -26, -14 -20 M-60 0 C -45 -6, -24 -6, -14 0 M14 -20 C 24 -26, 45 -26, 60 -20 M14 0 C 24 -6, 45 -6, 60 0" stroke-width="6" opacity="0.75"/>
  </g>`;

/** The reel artwork, drawn on a 1024 canvas. `bg` false leaves it transparent (Android foreground). */
function reelSvg({ bg = true, mono = false } = {}) {
  const fill = (c) => (mono ? '#FFFFFF' : c);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="60%">
      <stop offset="0" stop-color="#3A47A0"/>
      <stop offset="1" stop-color="${INDIGO}"/>
    </radialGradient>
    <linearGradient id="fadeL" x1="0" x2="1">
      <stop offset="0" stop-color="${INDIGO}" stop-opacity="1"/>
      <stop offset="1" stop-color="${INDIGO}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="fadeR" x1="1" x2="0">
      <stop offset="0" stop-color="${INDIGO}" stop-opacity="1"/>
      <stop offset="1" stop-color="${INDIGO}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  ${bg ? `<rect width="1024" height="1024" fill="url(#glow)"/>` : ''}
  <!-- side tiles -->
  <rect x="-40" y="352" width="250" height="320" rx="44" fill="${fill(TILE)}" opacity="${mono ? 0.5 : 1}"/>
  <rect x="814" y="352" width="250" height="320" rx="44" fill="${fill(TILE)}" opacity="${mono ? 0.5 : 1}"/>
  ${bg ? `<rect x="0" y="300" width="220" height="430" fill="url(#fadeL)"/><rect x="804" y="300" width="220" height="430" fill="url(#fadeR)"/>` : ''}
  <!-- winning tile -->
  <rect x="312" y="292" width="400" height="440" rx="60" fill="${fill(TILE)}" stroke="${fill(BRASS)}" stroke-width="16"/>
  <rect x="352" y="300" width="320" height="18" rx="9" fill="${fill(BRASS)}"/>
  ${book(512, 520, 1.6, fill(INK))}
  <!-- brass marker -->
  <path d="M452 170 L572 170 L512 252 Z" fill="${fill(BRASS)}"/>
  <path d="M452 854 L572 854 L512 772 Z" fill="${fill(BRASS)}"/>
</svg>`;
}

const png = (svg, size, file) => sharp(Buffer.from(svg)).resize(size, size).png().toFile(out(file));

await png(reelSvg(), 1024, 'icon.png');
await png(reelSvg(), 48, 'favicon.png');
// Android adaptive icon: art inside the 66% safe zone on a transparent layer.
const shrink = (svg) => svg.replace('<svg ', '<svg ').replace(/viewBox="0 0 1024 1024"/, 'viewBox="-260 -260 1544 1544"');
await png(shrink(reelSvg({ bg: false })), 1024, 'android-icon-foreground.png');
await png(shrink(reelSvg({ bg: false, mono: true })), 1024, 'android-icon-monochrome.png');
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: INDIGO } }).png().toFile(out('android-icon-background.png'));
// Splash: the art without the square background.
await png(reelSvg({ bg: false }), 1024, 'splash-icon.png');
console.log('Wrote icon.png, favicon.png, android-icon-*.png and splash-icon.png');
