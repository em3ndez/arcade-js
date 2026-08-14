// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_0f69 (Frogger score-pack, ROM 0x0F69-0x0F8B): reads (0x83EB) and (0x83ED),
// SBCs to pick the larger into DE (smaller pushed), calls loc_0a84 on each and stores first-A ->
// (0x83FB), second-A -> (0x83FC). loc_0a84 is stubbed with an SP-balancer returning a fixed A per call.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0f69 } from "../loc_0f69.js";

// Stub for loc_0a84: record the DE passed in, hand back a fixed A, and balance the CALL's pushed return.
function mk(retSeq) {
  const calls = [];
  const stub = (mm) => {
    calls.push(mm.regs.de);
    mm.regs.a = retSeq[calls.length - 1];
    mm.regs.sp = (mm.regs.sp + 2) & 0xffff;
  };
  const m = new Machine(new Uint8Array(0x4000), new Map([[0x0a84, stub]]));
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = calls;
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];

test("loc_0f69: (0x83eb) >= (0x83ed) packs the larger word first; 213 T", () => {
  const m = mk([0x11, 0x22]);
  m.mem.write16(0x83eb, 0x2000);
  m.mem.write16(0x83ed, 0x1000);
  loc_0f69(m);
  assert.deepEqual(m.calls, [0x2000, 0x1000], "first call gets the larger, second the smaller");
  assert.equal(r(m, 0x83fb), 0x11, "(0x83fb) = first-call A");
  assert.equal(r(m, 0x83fc), 0x22, "(0x83fc) = second-call A");
  assert.equal(m.regs.sp, 0x8800, "SP restored");
  assert.equal(m.cycles, 213, "non-carry path (jr not taken + push de/pop de/jr)");
});

test("loc_0f69: (0x83eb) < (0x83ed) still packs the larger word first; 185 T", () => {
  const m = mk([0x33, 0x44]);
  m.mem.write16(0x83eb, 0x1000);
  m.mem.write16(0x83ed, 0x2000);
  loc_0f69(m);
  assert.deepEqual(m.calls, [0x2000, 0x1000], "first call gets the larger (0x83ed), second the smaller");
  assert.equal(r(m, 0x83fb), 0x33, "(0x83fb) = first-call A");
  assert.equal(r(m, 0x83fc), 0x44, "(0x83fc) = second-call A");
  assert.equal(m.regs.sp, 0x8800, "SP restored");
  assert.equal(m.cycles, 185, "carry path (jr c taken -> push bc)");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0f69.js
//   find: mem.write16(0x83fb, regs.hl);
//   repl: mem.write16(0x83fb, ((regs.hl << 8) | (regs.hl >> 8)) & 0xffff);   // HL bytes swapped
//   expect: FAIL  ((0x83fb)/(0x83fc) transposed — caught by the pack check)
//   verified-anchor: count == 1  (the sole write16 to 0x83fb in loc_0f69.js)
// Simulated by intercepting the 0x83fb store and swapping HL's bytes, which is what the edit produces.
test("loc_0f69: the contract catches a byte-swapped store", () => {
  const m = mk([0x11, 0x22]);
  m.mem.write16(0x83eb, 0x2000);
  m.mem.write16(0x83ed, 0x1000);
  const ow = m.mem.write16.bind(m.mem);
  m.mem.write16 = (a, val) => ow(a, a === 0x83fb ? (((val << 8) | (val >> 8)) & 0xffff) : val);
  loc_0f69(m);
  assert.throws(() => {
    assert.equal(r(m, 0x83fb), 0x11);
    assert.equal(r(m, 0x83fc), 0x22);
  });
});
