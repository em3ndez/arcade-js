// SPDX-License-Identifier: GPL-3.0-only
//
// Consistency gate for the Tempest sound map (games/tempest/audio/sounds.js). Tempest is a SYNTH model (two
// discrete POKEY chips, no clips): the map is DATA the web audio adapter reads to know which sound REGISTERS
// to forward to games/tempest/audio/synth.js. This pins the map's shape + the register set against an
// independent restatement so an edit can't silently redefine the contract. No ROM, no audio, no browser.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, isAbsolute } from "node:path";
import map, { MODEL, REGISTERS, POKEY1, POKEY2, SOUND_REGS, POKEY_CLOCK } from "../audio/sounds.js";

const GAME_ROOT = join(dirname(fileURLToPath(import.meta.url)), ".."); // games/tempest

// Restated here (not imported) so a change to the map's own values can't redefine "valid".
const EXPECT_POKEY1 = 0x60c0, EXPECT_POKEY2 = 0x60d0, EXPECT_REGS = 10, EXPECT_CLOCK = 1512000;

test("the model is the synth model", () => {
  assert.equal(MODEL, "synth");
});

test("the two POKEY sound-register base addresses match tempest.cpp (0x60C0 / 0x60D0)", () => {
  assert.equal(POKEY1, EXPECT_POKEY1);
  assert.equal(POKEY2, EXPECT_POKEY2);
  assert.equal(SOUND_REGS, EXPECT_REGS);
  assert.equal(POKEY_CLOCK, EXPECT_CLOCK);
});

test("the register set names both chips' 10 sound registers (AUDF1..AUDC4, AUDCTL, STIMER)", () => {
  assert.deepEqual(REGISTERS.pokey1, Array.from({ length: EXPECT_REGS }, (_, r) => EXPECT_POKEY1 + r));
  assert.deepEqual(REGISTERS.pokey2, Array.from({ length: EXPECT_REGS }, (_, r) => EXPECT_POKEY2 + r));
});

test("every tapped register is inside the board's POKEY sound-write space (0x60C0-0x60DF)", () => {
  for (const a of [...REGISTERS.pokey1, ...REGISTERS.pokey2]) {
    assert.ok(a >= 0x60c0 && a <= 0x60df, `${a.toString(16)} outside the POKEY sound-write space`);
  }
});

test("the default export is the synth contract the adapter reads, and its synth path resolves to a real file", () => {
  assert.equal(map.model, "synth");
  assert.equal(map.synth, "audio/synth.js");
  assert.ok(!map.synth.startsWith("./") && !isAbsolute(map.synth), "synth path must be game-root-relative");
  assert.ok(existsSync(join(GAME_ROOT, map.synth)), `synth module missing at games/tempest/${map.synth}`);
  assert.equal(map.registers, REGISTERS);
  assert.equal(map.pokeyClock, EXPECT_CLOCK);
  assert.ok(typeof map.masterGain === "number" && map.masterGain > 0 && map.masterGain <= 4);
});
