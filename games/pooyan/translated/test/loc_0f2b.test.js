// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0f2b (ROM 0x0f2b): sound command 0x11 -- `ld a,0x11` then a
// tail-`jp 0x0ea2` into the enqueue helper. Flat-RAM mock (real Regs); the tail is a boundary,
// so the record-only `call` stub stops at the helper entry. T = 7 (ld) + 10 (jp).
// Run: node --test games/pooyan/translated/test/loc_0f2b.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0f2b } from "../loc_0f2b.js";

function makeMachine() {
  const regs = new Regs();
  return {
    regs, calls: [], tstates: 0, pc: 0x0f2b, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    call(a) { this.calls.push(a); return undefined; },
  };
}

test("loc_0f2b: A=0x11 -> tail into loc_0ea2", () => {
  const m = makeMachine();
  loc_0f2b(m);
  assert.equal(m.regs.a, 0x11, "A = 0x11 (sound command) handed to loc_0ea2");
  assert.equal(m.tstates, 17, "T = 7 (ld) + 10 (jp)");
  assert.equal(m.pc, 0x0ea2, "tail lands at the delegate entry");
  assert.deepEqual(m.calls, [0x0ea2], "delegates to loc_0ea2");
  assert.deepEqual(m.pcSeq, [0x0f2d, 0x0ea2], "step boundaries match the disassembly");
});

test("loc_0f2b MUTATION: `jp 0x0ea2` mis-charged 17T (as a call, not 10T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0ea2 ? 17 : c);
  loc_0f2b(m);
  assert.equal(m.tstates, 24, "mutation adds 7 T (10 -> 17)");
  assert.notEqual(m.tstates, 17, "golden T-state total catches the mutant");
});
