// SPDX-License-Identifier: GPL-3.0-only
//
// Drift gate for the Galaxian audio WIRING -- the seam between:
//   games/galaxian/manifest.js    declares the map + model (synth) + samples dir
//   games/galaxian/audio/sounds.js  says which sound REGISTERS the synth taps
//   games/galaxian/audio/synth.js   turns the latched register state into audio
//   web/player.html setupSynthAudio pulls audio blocks and feeds it the register writes
// It re-derives the synth's behavior from the map + synth alone and pins it -- no ROM, no audio, no
// browser. It cannot prove the synth SOUNDS right (that is the by-ear / correlation sign-off) -- only that
// the wiring still agrees and the model still computes the measured pitch law. Run: node --test
import test from "node:test";
import assert from "node:assert/strict";
import manifest from "../manifest.js";
import map, { REGISTERS } from "../audio/sounds.js";
import { GalaxianSynth, TONE_HZ_NUM } from "../audio/synth.js";

test("the manifest declares the synth map + a samples dir", () => {
  assert.ok(manifest.audio, "manifest has no audio block");
  assert.equal(manifest.audio.map, "audio/sounds.js");
  assert.equal(manifest.audio.model, "synth");
  assert.equal(manifest.audio.samples, "audio/samples");
});

test("the map's default export is the synth contract the adapter reads", () => {
  assert.equal(map.model, "synth");
  assert.equal(map.registers, REGISTERS);
});

// A deterministic re-derivation of the synth model: drive it with a fixed register-write stream and pin the
// resulting tone. Measures the fundamental by zero-crossings -- the freq must be the measured 555/pitch law.
function toneHz(pitch, fsBits) {
  const rate = 48000, synth = new GalaxianSynth(rate);
  synth.write(REGISTERS.pitch, pitch);
  for (let i = 0; i < fsBits; i++) synth.write(REGISTERS.fs[i], 1);
  synth.write(REGISTERS.vol[0], 1);
  const buf = new Float32Array(rate); // 1 second
  synth.render(buf);
  let zc = 0;
  for (let i = 1; i < buf.length; i++) if (buf[i - 1] < 0 && buf[i] >= 0) zc++;
  return zc; // ~= fundamental in Hz over the 1s window
}

test("the tone follows the measured pitch law freq = 192000/(256-pitch)", () => {
  for (const pitch of [0x40, 0x80, 0xc0]) {
    const want = TONE_HZ_NUM / (256 - pitch);
    const got = toneHz(pitch, 1);
    assert.ok(Math.abs(got - want) < want * 0.05, `pitch ${pitch.toString(16)}: tone ${got}Hz != ~${want}Hz`);
  }
});

test("no lit FS voice = silent; lighting voices raises amplitude", () => {
  const rate = 48000;
  const rms = (fsBits) => {
    const s = new GalaxianSynth(rate); s.write(REGISTERS.pitch, 0x80); s.write(REGISTERS.vol[0], 1);
    for (let i = 0; i < fsBits; i++) s.write(REGISTERS.fs[i], 1);
    const b = new Float32Array(rate); s.render(b);
    return Math.sqrt(b.reduce((a, x) => a + x * x, 0) / b.length);
  };
  assert.equal(rms(0), 0, "no FS voice lit must be silent");
  assert.ok(rms(3) > rms(1), "more lit FS voices must be louder (amplitude ~ count)");
});
