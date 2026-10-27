#!/usr/bin/env node
/**
 * Synthesizes WikiSpin's original sound effects as 16-bit mono WAV files:
 *   assets/sounds/tick.wav  — a short wooden "clack" for each reel tile
 *   assets/sounds/chime.wav — a bright two-note "win" chime
 *
 * Everything is generated from math (no samples), so there is nothing to license.
 * Usage: node tools/make-sounds.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets', 'sounds');
const RATE = 44100;

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// Deterministic noise so rebuilds are identical.
let seed = 1234567;
const noise = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x3fffffff - 1;
};

function tick() {
  const len = Math.round(RATE * 0.045);
  const out = new Float32Array(len);
  let lp = 0;
  for (let i = 0; i < len; i++) {
    const t = i / RATE;
    const env = Math.exp(-t * 140);
    // Band-limited noise burst (the "clack") + two resonant partials (the "wood").
    lp += 0.35 * (noise() - lp);
    const body = 0.55 * Math.sin(2 * Math.PI * 1850 * t) + 0.3 * Math.sin(2 * Math.PI * 3100 * t);
    out[i] = 0.75 * env * (0.6 * lp + body * Math.exp(-t * 90));
  }
  // 1 ms fade-in to avoid a click at sample 0.
  for (let i = 0; i < 44; i++) out[i] *= i / 44;
  return out;
}

function chime() {
  const len = Math.round(RATE * 1.1);
  const out = new Float32Array(len);
  // Two bell-like notes (E6 then B6), each a few inharmonic partials with exponential decay.
  const notes = [
    { start: 0, f: 1318.5, gain: 0.45 },
    { start: 0.11, f: 1975.5, gain: 0.5 },
  ];
  const partials = [
    [1, 1.0, 3.2],
    [2.0, 0.35, 5.5],
    [2.76, 0.18, 7.5],
    [5.4, 0.06, 11],
  ];
  for (const n of notes) {
    const s0 = Math.round(n.start * RATE);
    for (let i = s0; i < len; i++) {
      const t = (i - s0) / RATE;
      const attack = Math.min(1, t / 0.004);
      let v = 0;
      for (const [ratio, amp, decay] of partials) v += amp * Math.sin(2 * Math.PI * n.f * ratio * t) * Math.exp(-t * decay);
      out[i] += n.gain * attack * v;
    }
  }
  // Gentle normalisation to -1 dBFS.
  const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  for (let i = 0; i < len; i++) out[i] *= 0.89 / peak;
  return out;
}

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, 'tick.wav'), wav(tick()));
await writeFile(path.join(OUT, 'chime.wav'), wav(chime()));
console.log('Wrote assets/sounds/tick.wav and assets/sounds/chime.wav');
