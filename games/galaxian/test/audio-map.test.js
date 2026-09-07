// SPDX-License-Identifier: GPL-3.0-only
//
// Consistency gate for the Galaxian sound map (games/galaxian/audio/sounds.js). Galaxian is a SYNTH model
// (discrete-analogue netlist, no clips): the map is DATA the web audio adapter reads to know which sound
// REGISTERS to tap and hand to games/galaxian/audio/synth.js. This test pins the map's shape and the
// register set against an independent restatement, so an edit can't silently redefine the contract. No
// ROM, no audio, no browser. Run: node --test
import test from "node:test";
import assert from "node:assert/strict";
import map, { MODEL, REGISTERS, TONE_HZ_NUM } from "../audio/sounds.js";

// Restated here (not imported) so a change to the map's own values can't redefine "valid".
const EXPECT = {
  fs: [0x6800, 0x6801, 0x6802],
  hit: 0x6803,
  fire: 0x6805,
  vol: [0x6806, 0x6807],
  pitch: 0x7800,
};

test("the model is the synth model", () => {
  assert.equal(MODEL, "synth");
});

test("the register set names galaxian's sound-write surface exactly", () => {
  assert.deepEqual(REGISTERS.fs, EXPECT.fs);
  assert.equal(REGISTERS.hit, EXPECT.hit);
  assert.equal(REGISTERS.fire, EXPECT.fire);
  assert.deepEqual(REGISTERS.vol, EXPECT.vol);
  assert.equal(REGISTERS.pitch, EXPECT.pitch);
});

test("every tapped register is in the board's sound-write space (0x6004-0x7800)", () => {
  const all = [...REGISTERS.fs, REGISTERS.hit, REGISTERS.fire, ...REGISTERS.vol, REGISTERS.pitch];
  for (const a of all) assert.ok(a >= 0x6004 && a <= 0x7800, `${a.toString(16)} outside the sound-write space`);
});

test("the pitch law numerator is the measured 555/pitch-DAC constant", () => {
  assert.equal(TONE_HZ_NUM, 192000); // freq = 192000/(256-pitch); measured 0x80->1500, 0xC0->3000 Hz
});

test("the default export is the synth contract the adapter reads", () => {
  assert.equal(map.model, "synth");
  assert.equal(map.synth, "./synth.js");
  assert.equal(map.registers, REGISTERS);
  assert.equal(map.toneHzNum, TONE_HZ_NUM);
  assert.ok(typeof map.masterGain === "number" && map.masterGain > 0 && map.masterGain <= 4);
});
