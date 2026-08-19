// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0ecf (ROM 0x0ecf): sound command 0x00 -- `xor a` (A=0, Z set) then a
// tail-`jr 0x0eb3` into the enqueue helper. Flat-RAM mock (real Regs); the tail is a boundary, so
// the record-only `call` stub stops at the helper entry. T = 4 (xor) + 12 (jr).
// Run: node --test games/pooyan/translated/test/loc_0ecf.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0ecf } from "../loc_0ecf.js";

function makeMachine() {
  const regs = new Regs();
  return {
    regs, calls: [], tstates: 0, pc: 0x0ecf, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    call(a) { this.calls.push(a); return undefined; },
  };
}

test("loc_0ecf: xor a -> tail-jr into loc_0eb3", () => {
  const m = makeMachine();
  m.regs.a = 0x77;
  loc_0ecf(m);
  assert.equal(m.regs.a, 0x00, "xor a zeroes A (command 0)");
  assert.equal(m.regs.fZ, true, "xor a sets Z");
  assert.equal(m.regs.fC, false, "xor a clears C");
  assert.equal(m.tstates, 16, "T = 4 (xor) + 12 (jr)");
  assert.equal(m.pc, 0x0eb3, "tail-jr lands at the delegate entry");
  assert.deepEqual(m.calls, [0x0eb3], "delegates to loc_0eb3");
  assert.deepEqual(m.pcSeq, [0x0ed0, 0x0eb3], "step boundaries match the disassembly");
});

test("loc_0ecf MUTATION: `jr 0x0eb3` mis-charged 7T (not 12T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0eb3 ? 7 : c);
  loc_0ecf(m);
  assert.equal(m.tstates, 11, "mutation loses 5 T (12 -> 7)");
  assert.notEqual(m.tstates, 16, "golden T-state total catches the mutant");
});
