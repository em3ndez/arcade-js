// SPDX-License-Identifier: GPL-3.0-only
//
// Drift gate for the Centipede audio WIRING -- the seam between:
//   games/centiped/manifest.js     declares the map + model (synth)
//   games/centiped/audio/sounds.js  says which POKEY REGISTERS the synth taps
//   games/centiped/audio/synth.js   turns the latched register state into audio
//   boards/centiped/io.js           taps POKEY writes (pokeyWrite -> onSoundWrite, 0x1000+reg)
//   web/player.html setupSynthAudio pulls audio blocks and feeds the synth the register writes
// It re-derives the synth's behaviour from the map + synth alone and pins it -- no ROM, no audio, no
// browser. It cannot prove the synth SOUNDS right (that is the per-voice null-mutant test) -- only that the
// wiring still agrees and the model still computes the measured POKEY divider law. Run: node --test
import test from "node:test";
import assert from "node:assert/strict";
import manifest from "../manifest.js";
import map, { REGISTERS } from "../audio/sounds.js";
import { CentipedSynth, Synth, REGS, POKEY_CLOCK, CLOCK_64 } from "../audio/synth.js";

test("the manifest declares the synth map + model", () => {
  assert.ok(manifest.audio, "manifest has no audio block");
  assert.equal(manifest.audio.map, "audio/sounds.js");
  assert.equal(manifest.audio.model, "synth");
});

test("the map's default export is the synth contract the adapter reads", () => {
  assert.equal(map.model, "synth");
  assert.equal(map.registers, REGISTERS);
});

test("the synth module exports a generic Synth alias the adapter can resolve", () => {
  // web/player.html setupSynthAudio resolves `mod.Synth ?? mod.GalaxianSynth ?? mod.default`.
  assert.equal(Synth, CentipedSynth);
});

test("the synth latches the same POKEY addresses the map advertises", () => {
  assert.deepEqual(REGS.AUDF, map.registers.audf);
  assert.deepEqual(REGS.AUDC, map.registers.audc);
  assert.equal(REGS.AUDCTL, map.registers.audctl);
  assert.equal(REGS.SKCTL, map.registers.skctl);
});

// A deterministic re-derivation of the model: drive a pure-tone channel and pin the fundamental by
// zero-crossings -- it must be the POKEY divider law freq = (clock/28)/(2*(AUDF+1)) at the 64 kHz base.
function toneHz(audf) {
  const rate = 48000, s = new CentipedSynth(rate);
  s.write(REGS.SKCTL, 0x03);
  s.write(REGS.AUDF[1], audf);
  s.write(REGS.AUDC[1], 0xa4); // NOTPOLY5 | PURE, volume 4
  const buf = new Float32Array(rate); // 1 second
  s.render(buf);
  let zc = 0;
  for (let i = 1; i < buf.length; i++) if (buf[i - 1] < 0 && buf[i] >= 0) zc++;
  return zc; // ~= fundamental in Hz over the 1s window
}

test("a pure tone follows the POKEY divider law freq = (clock/28)/(2*(AUDF+1))", () => {
  assert.equal(CLOCK_64, POKEY_CLOCK / 28);
  for (const audf of [0x40, 0x80, 0xc0]) {
    const want = CLOCK_64 / (2 * (audf + 1));
    const got = toneHz(audf);
    assert.ok(Math.abs(got - want) < want * 0.06, `AUDF ${audf.toString(16)}: tone ${got}Hz != ~${want.toFixed(0)}Hz`);
  }
});

test("a lit channel adds energy the empty synth does not", () => {
  const rate = 48000;
  const rms = (writes) => {
    const s = new CentipedSynth(rate);
    for (const [a, v] of writes) s.write(a, v);
    const b = new Float32Array(4096); s.render(b);
    return Math.sqrt(b.reduce((acc, x) => acc + x * x, 0) / b.length);
  };
  assert.equal(rms([[REGS.SKCTL, 0x03]]), 0, "no channel lit -> silence");
  assert.ok(rms([[REGS.SKCTL, 0x03], [REGS.AUDF[1], 0x40], [REGS.AUDC[1], 0xa4]]) > 0.01,
    "a lit pure-tone channel must sound");
});
