// SPDX-License-Identifier: GPL-3.0-only
//
// Per-voice NULL-MUTANT gate for the Tempest audio synth (games/tempest/audio/synth.js). Tempest mixes EIGHT
// independent POKEY voices (4 channels x 2 chips, tempest.cpp:668-690); an aggregate MAME-envelope
// correlation CANNOT fail per-voice (galaxian shipped silent on 3 of its 4 voices under a passing +0.7), so
// each voice is pinned here: drive ONLY that channel (all others stay at the power-on AUDC 0xb0 = volume 0,
// silent) and assert the rendered mix is non-silent. Silence any one voice in synth.js -> that voice's test
// goes RED. Node-only (no ROM/MAME): drives the register writes and asserts on the rendered block.
import test from "node:test";
import assert from "node:assert/strict";
import { Synth, PokeyChip, POKEY1_BASE, POKEY2_BASE, POKEY_CLOCK } from "../audio/synth.js";

const RATE = 48000;
const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);

// Address of a channel's AUDF/AUDC register. chip 0/1, channel 0..3.
const AUDF = (chip, ch) => (chip ? POKEY2_BASE : POKEY1_BASE) + ch * 2;
const AUDC = (chip, ch) => (chip ? POKEY2_BASE : POKEY1_BASE) + ch * 2 + 1;

function renderOne(writes, n = 4096) {
  const s = new Synth(RATE);
  for (const [a, v] of writes) s.write(a, v);
  const out = new Float32Array(n);
  s.render(out);
  return out;
}

// The eight voices: each must sound on its own. AUDF=44 -> ~600 Hz; AUDC 0xac = PURE tone (0x20), volume 12.
for (let chip = 0; chip < 2; chip++) {
  for (let ch = 0; ch < 4; ch++) {
    test(`POKEY${chip + 1} channel ${ch + 1} voices on its own (per-voice null-mutant)`, () => {
      const out = renderOne([[AUDF(chip, ch), 44], [AUDC(chip, ch), 0xac]]);
      assert.ok(rms(out) > 0.02, `POKEY${chip + 1} ch${ch + 1} silent (rms ${rms(out).toFixed(4)})`);
    });
  }
}

test("the power-on state (no writes) is silent", () => {
  const out = renderOne([]);
  assert.ok(rms(out) < 1e-3, `idle synth not silent (rms ${rms(out).toFixed(5)})`);
});

test("volume 0 is silent even with a pure-tone control set (the volume nibble gates the voice)", () => {
  const out = renderOne([[AUDF(0, 2), 44], [AUDC(0, 2), 0xa0]]); // pure tone, volume 0
  assert.ok(rms(out) < 1e-3, `volume-0 voice audible (rms ${rms(out).toFixed(5)})`);
});

test("the poly17 noise generator sounds (AUDC control nibble 0x80, the noise voice Tempest uses)", () => {
  const out = renderOne([[AUDF(0, 1), 40], [AUDC(0, 1), 0x86]]); // NOTPOLY5, poly17, volume 6
  assert.ok(rms(out) > 0.02, `poly17 noise voice silent (rms ${rms(out).toFixed(4)})`);
});

test("a PURE-tone channel divides at freq = pokeyClock/28 / (2*(AUDF+1))", () => {
  // AUDCTL=0 (power-on): base clock = POKEY_CLOCK/28. Pure tone toggles once per (AUDF+1) base ticks.
  for (const audf of [22, 44, 100]) {
    const s = new Synth(RATE);
    s.write(AUDC(0, 2), 0xac); s.write(AUDF(0, 2), audf);
    const out = new Float32Array(RATE); // 1 second
    s.render(out);
    let zc = 0; for (let i = 1; i < out.length; i++) if (out[i - 1] < 0 && out[i] >= 0) zc++;
    const want = (POKEY_CLOCK / 28) / (2 * (audf + 1));
    assert.ok(Math.abs(zc - want) / want < 0.05, `AUDF ${audf}: tone ${zc}Hz != ~${want.toFixed(0)}Hz`);
  }
});

test("output stays within [-1, 1] with every voice firing at once", () => {
  const writes = [];
  for (let chip = 0; chip < 2; chip++) for (let ch = 0; ch < 4; ch++) {
    writes.push([AUDF(chip, ch), 30 + ch * 7], [AUDC(chip, ch), 0xa0 | 0x0f]); // pure tone, max volume
  }
  const out = renderOne(writes, 8192);
  for (const x of out) assert.ok(x >= -1 && x <= 1, `sample ${x} out of range`);
});

test("a single PokeyChip steps and produces a non-zero level for an active pure-tone channel", () => {
  const c = new PokeyChip();
  c.write(5, 0xac); c.write(4, 44); c.write(9, 0); // channel 3 pure tone, STIMER syncs the counter
  let sawLevel = false;
  for (let i = 0; i < 8192; i++) { c.step(); if (c.level() > 0) sawLevel = true; }
  assert.ok(sawLevel, "PokeyChip never produced a non-zero level for an active channel");
});
