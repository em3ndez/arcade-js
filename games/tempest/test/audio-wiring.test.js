// SPDX-License-Identifier: GPL-3.0-only
//
// Drift gate for the Tempest audio WIRING -- the seam between:
//   games/tempest/manifest.js       declares the map + model (synth)
//   games/tempest/audio/sounds.js   says which sound REGISTERS the synth taps
//   games/tempest/audio/synth.js    turns the latched POKEY register state into audio
//   boards/tempest/io.js            forwards POKEY writes to io.onSoundWrite (addr,value)
//   web/player.html setupSynthAudio pulls audio blocks and feeds it the register writes
// It re-derives the synth's behaviour from the map + synth alone and pins it -- no ROM, no audio, no browser.
// It cannot prove the synth SOUNDS right (that is the per-voice null-mutant + the MAME-correlation check) --
// only that the wiring still agrees and the model still computes the measured pitch law.
import test from "node:test";
import assert from "node:assert/strict";
import manifest from "../manifest.js";
import map, { REGISTERS, POKEY1, POKEY2, POKEY_CLOCK } from "../audio/sounds.js";
import { Synth } from "../audio/synth.js";

test("the manifest declares the synth map + model", () => {
  assert.ok(manifest.audio, "manifest has no audio block");
  assert.equal(manifest.audio.map, "audio/sounds.js");
  assert.equal(manifest.audio.model, "synth");
});

test("the map's default export is the synth contract the adapter reads", () => {
  assert.equal(map.model, "synth");
  assert.equal(map.registers, REGISTERS);
});

test("the board forwards a POKEY write to io.onSoundWrite as (0x60C0+chip*0x10+reg, value)", async () => {
  const { Io } = await import("../../../boards/tempest/io.js");
  const io = new Io();
  const seen = [];
  io.onSoundWrite = (addr, value) => seen.push([addr, value]);
  io.pokeyWrite(0, 4, 44, 0);  // POKEY1 AUDF3
  io.pokeyWrite(1, 7, 0x08, 0); // POKEY2 AUDC4
  assert.deepEqual(seen, [[POKEY1 + 4, 44], [POKEY2 + 7, 0x08]]);
});

// A deterministic re-derivation of the synth model: drive a channel with a fixed pure-tone write stream and
// pin the resulting tone by zero-crossings. AUDCTL=0 (power-on) => base clock POKEY_CLOCK/28; a pure tone
// toggles once per (AUDF+1) base ticks, so freq = (POKEY_CLOCK/28)/(2*(AUDF+1)).
function toneHz(pitch) {
  const rate = 48000, synth = new Synth(rate);
  synth.write(POKEY1 + 5, 0xac); // AUDC3 pure tone, volume 12
  synth.write(POKEY1 + 4, pitch); // AUDF3
  synth.write(POKEY1 + 9, 0); // STIMER
  const buf = new Float32Array(rate); // 1 second
  synth.render(buf);
  let zc = 0;
  for (let i = 1; i < buf.length; i++) if (buf[i - 1] < 0 && buf[i] >= 0) zc++;
  return zc;
}

test("the tone follows the measured pitch law freq = (POKEY_CLOCK/28)/(2*(AUDF+1))", () => {
  for (const pitch of [0x16, 0x2c, 0x64]) {
    const want = (POKEY_CLOCK / 28) / (2 * (pitch + 1));
    const got = toneHz(pitch);
    assert.ok(Math.abs(got - want) < want * 0.05, `pitch ${pitch.toString(16)}: tone ${got}Hz != ~${want.toFixed(0)}Hz`);
  }
});

test("more lit voices raise the amplitude (voices sum into one mix)", () => {
  const rate = 48000;
  const rms = (chans) => {
    const s = new Synth(rate);
    for (const [c, ch] of chans) {
      const base = c ? POKEY2 : POKEY1;
      s.write(base + ch * 2 + 1, 0xac); s.write(base + ch * 2, 44);
    }
    s.write(POKEY1 + 9, 0); s.write(POKEY2 + 9, 0);
    const b = new Float32Array(rate); s.render(b);
    return Math.sqrt(b.reduce((a, x) => a + x * x, 0) / b.length);
  };
  assert.ok(rms([[0, 2], [0, 0], [1, 3]]) > rms([[0, 2]]), "adding voices must raise amplitude");
});
