// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0f09 (ROM 0x0f09): sound command 0x0b -- `ld a,0x0b` then a
// tail-`jr 0x0e8f` into the enqueue helper. Flat-RAM mock (real Regs); the tail is a boundary,
// so the record-only `call` stub stops at the helper entry. T = 7 (ld) + 12 (jr).
// Run: node --test games/pooyan/translated/test/loc_0f09.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0f09 } from "../loc_0f09.js";

function makeMachine() {
  const regs = new Regs();
  return {
    regs, calls: [], tstates: 0, pc: 0x0f09, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    call(a) { this.calls.push(a); return undefined; },
  };
}

test("loc_0f09: A=0x0b -> tail into loc_0e8f", () => {
  const m = makeMachine();
  loc_0f09(m);
  assert.equal(m.regs.a, 0x0b, "A = 0x0b (sound command) handed to loc_0e8f");
  assert.equal(m.tstates, 19, "T = 7 (ld) + 12 (jr)");
  assert.equal(m.pc, 0x0e8f, "tail lands at the delegate entry");
  assert.deepEqual(m.calls, [0x0e8f], "delegates to loc_0e8f");
  assert.deepEqual(m.pcSeq, [0x0f0b, 0x0e8f], "step boundaries match the disassembly");
});

test("loc_0f09 MUTATION: `jr 0x0e8f` mis-charged 7T (not 12T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0e8f ? 7 : c);
  loc_0f09(m);
  assert.equal(m.tstates, 14, "mutation loses 5 T (12 -> 7)");
  assert.notEqual(m.tstates, 19, "golden T-state total catches the mutant");
});
