// SPDX-License-Identifier: GPL-3.0-only
//
// Voice-independence gate for the Galaxian audio synth (games/galaxian/audio/synth.js). galaxian_a.cpp mixes
// FOUR independent inputs -- PITCH (0x7800), BACKGROUND (FS 0x6800-2 + DAC 0x6004-7), FIRE (0x6805), HIT
// (0x6803) -- so each must voice on its own. A prior model fused them (gated PITCH behind the FS bits), which
// silenced the whole FS-off start tune in the browser; this pins each voice so that regression can't return.
// Node-only (no ROM/MAME): drives the register writes and asserts the rendered block is non-silent.
import test from "node:test";
import assert from "node:assert/strict";
import { GalaxianSynth, TONE_HZ_NUM, FIRE_DECAY_S } from "../audio/synth.js";

const RATE = 48000;
const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);

function render(writes, n = 2048) {
  const s = new GalaxianSynth(RATE);
  for (const [a, v] of writes) s.write(a, v);
  const out = new Float32Array(n);
  s.render(out);
  return { s, out };
}

test("PITCH voices with the background OFF (the start-tune regression: FS gating used to silence it)", () => {
  // pitch=128 (an audible note), all FS off, VOL2 on. The fused model rendered SILENCE here.
  const { out } = render([[0x7800, 128], [0x6807, 1]]);
  assert.ok(rms(out) > 0.01, `PITCH voice silent with FS off (rms ${rms(out).toFixed(4)})`);
});

test("PITCH note-off (0xFF) with FS off is silent (the rest sentinel)", () => {
  const { out } = render([[0x7800, 0xff], [0x6807, 1]]);
  assert.ok(rms(out) < 1e-4, `note-off should be silent (rms ${rms(out).toFixed(5)})`);
});

test("PITCH frequency follows 192000/(256-pitch)", () => {
  const pitch = 128; // -> 1500 Hz
  const { out } = render([[0x7800, pitch], [0x6807, 1]], RATE); // 1 second
  let crossings = 0;
  for (let i = 1; i < out.length; i++) if ((out[i - 1] < 0) !== (out[i] < 0)) crossings++;
  const freq = crossings / 2; // over 1s
  const want = TONE_HZ_NUM / (256 - pitch);
  assert.ok(Math.abs(freq - want) / want < 0.05, `pitch freq ${freq.toFixed(0)}Hz, want ~${want}Hz`);
});

test("BACKGROUND voices from the FS enables + DAC, with PITCH OFF (the buzzing background)", () => {
  // pitch note-off, FS1/2/3 on, DAC=15 (0x6004-7 bit0), VOL2 on.
  const { out } = render([[0x7800, 0xff], [0x6800, 1], [0x6801, 1], [0x6802, 1],
    [0x6004, 1], [0x6005, 1], [0x6006, 1], [0x6007, 1], [0x6807, 1]]);
  assert.ok(rms(out) > 0.01, `background silent with FS on (rms ${rms(out).toFixed(4)})`);
});

test("FIRE voices on the rising edge and decays (the player shot)", () => {
  const s = new GalaxianSynth(RATE);
  s.write(0x6805, 1); // rising edge -> retrigger
  const first = new Float32Array(2048); s.render(first);
  assert.ok(rms(first) > 0.01, `FIRE silent after trigger (rms ${rms(first).toFixed(4)})`);
  // render past the full decay; the tail must be quiet
  const blocks = Math.ceil((FIRE_DECAY_S * RATE) / 2048) + 2;
  let tail = new Float32Array(2048);
  for (let b = 0; b < blocks; b++) { tail = new Float32Array(2048); s.render(tail); }
  assert.ok(rms(tail) < rms(first) * 0.1, `FIRE did not decay (first ${rms(first).toFixed(4)}, tail ${rms(tail).toFixed(4)})`);
});

test("HIT voices on the rising edge (the explosion)", () => {
  const s = new GalaxianSynth(RATE);
  s.write(0x6803, 1);
  const out = new Float32Array(2048); s.render(out);
  assert.ok(rms(out) > 0.01, `HIT silent after trigger (rms ${rms(out).toFixed(4)})`);
});

test("output stays within [-1, 1] with every voice firing at once", () => {
  const { out } = render([[0x7800, 100], [0x6800, 1], [0x6801, 1], [0x6802, 1],
    [0x6004, 1], [0x6007, 1], [0x6803, 1], [0x6805, 1], [0x6806, 1], [0x6807, 1]]);
  for (const x of out) assert.ok(x >= -1 && x <= 1, `sample ${x} out of range`);
});
