// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter + mutation test for loc_0794 (Frogger sound-command issue, ROM 0x0794-0x07AB):
// latches A->0xD000, then 0xD002 bit3 low then high; the low write is the FALLING edge that
// asserts the audio /INT (soundTriggers++). 105 T. Needs PPI1 output-programmed or writes drop.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0794 } from "../loc_0794.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.mem.write8(0xd006, 0x88, 7);      // program PPI1 A/B as outputs (cold-boot does this first)
  m.mem.workRam[0x03d9] = 0x18;       // sound-control shadow at 0x83d9
  m.mem.write8(0xd002, 0x08, 10);     // seed control bit3 HIGH so the falling edge is real
  m.mem.writeTrace = [];              // capture only loc_0794's own writes
  return m;
}

function run(fn) {
  const m = mk();
  m.regs.a = 0x33; // sound command
  const c0 = m.cycles;
  fn(m);
  return {
    cycles: m.cycles - c0,
    trace: m.mem.writeTrace.map((w) => [w.addr, w.value]),
    soundData: m.io.soundData,
    triggers: m.io.soundTriggers,
  };
}

function checkSpec(res) {
  assert.equal(res.cycles, 105, "T-state total (13+13+7+13+4*4+13+7+13+10)");
  assert.equal(res.soundData, 0x33, "the command byte reached the sound latch (0xD000)");
  assert.deepEqual(
    res.trace,
    [[0xd000, 0x33], [0xd002, 0x10], [0xd002, 0x18]],
    "0xD000 latch, then 0xD002 bit3 low (0x10) then high (0x18)",
  );
  assert.equal(res.triggers, 1, "the bit3 falling edge asserted the audio /INT once");
}

test("loc_0794: latch sound command, pulse the /INT edge; 105 T", () => {
  checkSpec(run(loc_0794));
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0794.js
//   find: regs.and(0xf7);
//   repl: regs.and(0xff);
//   expect: FAIL  (bit 3 is no longer cleared, so the low 0xD002 write is 0x18 not
//                  0x10 -- no falling edge, no /INT: caught by the trace + triggers)
//   verified-anchor: count == 1  (the sole `and 0xf7` in loc_0794.js)
test("loc_0794: the contract catches a dropped bit-3 falling edge", () => {
  const mutant = (m) => {
    const { regs, mem } = m;
    mem.write8(0xd000, regs.a, 10);
    m.step(0x0797, 13);
    regs.a = mem.read8(0x83d9);
    m.step(0x079a, 13);
    regs.and(0xff); // MUTANT: bit 3 not cleared
    m.step(0x079c, 7);
    mem.write8(0xd002, regs.a, 10);
    m.step(0x079f, 13);
    m.step(0x07a0, 4); m.step(0x07a1, 4); m.step(0x07a2, 4); m.step(0x07a3, 4);
    regs.a = mem.read8(0x83d9);
    m.step(0x07a6, 13);
    regs.or(0x08);
    m.step(0x07a8, 7);
    mem.write8(0xd002, regs.a, 10);
    m.step(0x07ab, 13);
    m.ret();
  };
  assert.throws(() => checkSpec(run(mutant)));
});
