// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0f0d (ROM 0x0f0d): sound command 0x0b -- `ld a,0x0b` then a
// tail-`jr 0x0ea2` into the enqueue helper. Flat-RAM mock (real Regs); the tail is a boundary,
// so the record-only `call` stub stops at the helper entry. T = 7 (ld) + 12 (jr).
// Run: node --test games/pooyan/translated/test/loc_0f0d.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0f0d } from "../loc_0f0d.js";

function makeMachine() {
  const regs = new Regs();
  return {
    regs, calls: [], tstates: 0, pc: 0x0f0d, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    call(a) { this.calls.push(a); return undefined; },
  };
}

test("loc_0f0d: A=0x0b -> tail into loc_0ea2", () => {
  const m = makeMachine();
  loc_0f0d(m);
  assert.equal(m.regs.a, 0x0b, "A = 0x0b (sound command) handed to loc_0ea2");
  assert.equal(m.tstates, 19, "T = 7 (ld) + 12 (jr)");
  assert.equal(m.pc, 0x0ea2, "tail lands at the delegate entry");
  assert.deepEqual(m.calls, [0x0ea2], "delegates to loc_0ea2");
  assert.deepEqual(m.pcSeq, [0x0f0f, 0x0ea2], "step boundaries match the disassembly");
});

test("loc_0f0d MUTATION: `jr 0x0ea2` mis-charged 7T (not 12T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0ea2 ? 7 : c);
  loc_0f0d(m);
  assert.equal(m.tstates, 14, "mutation loses 5 T (12 -> 7)");
  assert.notEqual(m.tstates, 19, "golden T-state total catches the mutant");
});
