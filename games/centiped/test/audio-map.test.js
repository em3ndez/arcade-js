// SPDX-License-Identifier: GPL-3.0-only
//
// Consistency gate for the Centipede sound map (games/centiped/audio/sounds.js). Centipede is a SYNTH model
// (a single POKEY PSG driven off the 6502, no clips): the map is DATA the web audio adapter reads to know
// which POKEY REGISTERS to tap and hand to games/centiped/audio/synth.js. This pins the map's shape and the
// register set against an independent restatement, so an edit can't silently redefine the contract. No ROM,
// no audio, no browser. Run: node --test
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, isAbsolute } from "node:path";
import map, { MODEL, REGISTERS, POKEY_CLOCK } from "../audio/sounds.js";

const GAME_ROOT = join(dirname(fileURLToPath(import.meta.url)), ".."); // games/centiped

// Restated here (not imported) so a change to the map's own values can't redefine "valid".
const EXPECT = {
  audf: [0x1000, 0x1002, 0x1004, 0x1006],
  audc: [0x1001, 0x1003, 0x1005, 0x1007],
  audctl: 0x1008,
  skctl: 0x100f,
};

test("the model is the synth model", () => {
  assert.equal(MODEL, "synth");
});

test("the register set names the POKEY sound-write surface exactly", () => {
  assert.deepEqual(REGISTERS.audf, EXPECT.audf);
  assert.deepEqual(REGISTERS.audc, EXPECT.audc);
  assert.equal(REGISTERS.audctl, EXPECT.audctl);
  assert.equal(REGISTERS.skctl, EXPECT.skctl);
});

test("every tapped register is in the POKEY register file (0x1000-0x100F)", () => {
  const all = [...REGISTERS.audf, ...REGISTERS.audc, REGISTERS.audctl, REGISTERS.skctl];
  for (const a of all) assert.ok(a >= 0x1000 && a <= 0x100f, `${a.toString(16)} outside the POKEY register file`);
});

test("the POKEY clock is the centiped.cpp value (12.096 MHz / 8)", () => {
  assert.equal(POKEY_CLOCK, 12096000 / 8);
});

test("the default export is the synth contract the adapter reads, and its synth path resolves to a real file", () => {
  assert.equal(map.model, "synth");
  assert.equal(map.synth, "audio/synth.js");
  assert.ok(!map.synth.startsWith("./") && !isAbsolute(map.synth), "synth path must be game-root-relative");
  assert.ok(existsSync(join(GAME_ROOT, map.synth)), `synth module missing at games/centiped/${map.synth}`);
  assert.equal(map.registers, REGISTERS);
  assert.equal(map.pokeyClock, POKEY_CLOCK);
  assert.ok(typeof map.masterGain === "number" && map.masterGain > 0 && map.masterGain <= 4);
});
