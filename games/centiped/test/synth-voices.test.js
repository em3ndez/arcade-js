// SPDX-License-Identifier: GPL-3.0-only
//
// Voice-independence gate for the Centipede audio synth (games/centiped/audio/synth.js). POKEY mixes FOUR
// independent channels -- V1 noise (AUDC=0x84), V2 pure tone (AUDC=0xA4), V3 gritty poly4 buzz (AUDC=0x64,
// fast-clocked via AUDCTL=0x20), V4 pure tone (AUDC=0xA4) -- each grounded from the MAME write-tap
// (scratchpad/deep_capture/tracked_deep.csv). Each voice must sound ON ITS OWN: if the synth ever collapses
// a channel to silence, that channel's isolation test goes RED (the null-mutant control -- an aggregate
// energy metric cannot fail per-voice, but this can). Node-only (no ROM / no MAME): drive the POKEY writes
// and assert the rendered block carries measurable energy. Run: node --test
import test from "node:test";
import assert from "node:assert/strict";
import { CentipedSynth, REGS } from "../audio/synth.js";

const RATE = 48000;
const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);

// The four grounded channels: [AUDF, AUDC, AUDCTL] captured for each POKEY channel of a real play.
const VOICE = [
  { ch: 0, audf: 0x60, audc: 0x84, audctl: 0x00, name: "V1 ch1 17-bit poly NOISE (gunshot/hit)" },
  { ch: 1, audf: 0x40, audc: 0xa4, audctl: 0x00, name: "V2 ch2 PURE tone (marching/movement)" },
  { ch: 2, audf: 0x60, audc: 0x64, audctl: 0x20, name: "V3 ch3 poly4 BUZZ, CH3 fast clock" },
  { ch: 3, audf: 0x20, audc: 0xa4, audctl: 0x00, name: "V4 ch4 PURE tone (high blip)" },
];

// Render ONE voice in isolation: only its channel gets a non-zero volume, the other three stay at AUDC=0.
function renderVoice(v, n = 4096) {
  const s = new CentipedSynth(RATE);
  s.write(REGS.SKCTL, 0x03);        // SK_RESET releases the poly counters (boot value)
  s.write(REGS.AUDCTL, v.audctl);
  s.write(REGS.AUDF[v.ch], v.audf);
  s.write(REGS.AUDC[v.ch], v.audc);
  const out = new Float32Array(n);
  s.render(out);
  return out;
}

for (const v of VOICE) {
  test(`${v.name} sounds on its own (null-mutant: silence it -> RED)`, () => {
    const out = renderVoice(v);
    assert.ok(rms(out) > 0.01, `${v.name} silent in isolation (rms ${rms(out).toFixed(4)})`);
  });
}

test("V2 pure tone follows the POKEY divider law freq = (clock/28)/(2*(AUDF+1))", () => {
  // AUDF2=0x40 (64) at 64 kHz base: (1512000/28)/(2*65) ~= 415 Hz.
  const out = renderVoice({ ch: 1, audf: 0x40, audc: 0xa4, audctl: 0x00 }, RATE); // 1 second
  let crossings = 0;
  for (let i = 1; i < out.length; i++) if ((out[i - 1] < 0) !== (out[i] < 0)) crossings++;
  const freq = crossings / 2;
  const want = (12096000 / 8 / 28) / (2 * (0x40 + 1));
  assert.ok(Math.abs(freq - want) / want < 0.06, `pure tone ${freq.toFixed(0)}Hz, want ~${want.toFixed(0)}Hz`);
});

test("a channel at volume 0 is silent (the mixer sums per-channel volume, not a shared gate)", () => {
  const s = new CentipedSynth(RATE);
  s.write(REGS.SKCTL, 0x03);
  s.write(REGS.AUDF[1], 0x40);
  s.write(REGS.AUDC[1], 0xa0); // PURE waveform but volume nibble = 0
  const out = new Float32Array(4096); s.render(out);
  assert.ok(rms(out) < 1e-4, `volume-0 channel should be silent (rms ${rms(out).toFixed(5)})`);
});

test("all four voices firing together stay within [-1, 1]", () => {
  const s = new CentipedSynth(RATE);
  s.write(REGS.SKCTL, 0x03);
  s.write(REGS.AUDCTL, 0x20);
  for (const v of VOICE) { s.write(REGS.AUDF[v.ch], v.audf); s.write(REGS.AUDC[v.ch], v.audc | 0x06); }
  const out = new Float32Array(4096); s.render(out);
  for (const x of out) assert.ok(x >= -1 && x <= 1, `sample ${x} out of range`);
  assert.ok(rms(out) > 0.01, "the full mix must be audible");
});
