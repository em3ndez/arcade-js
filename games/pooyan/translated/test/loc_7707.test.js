// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_7707 (ROM 0x7707-0x7714): the per-object state machine that rst-0x28
// dispatches on (ix+2)&3. Two exits: an early `ret nc` for an inactive record, and a tail dispatch
// to loc_0028 that pushes the inline table base 0x7715 (record-only call stub, so the push stands).
//
// Run: node --test games/pooyan/translated/test/loc_7707.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_7707 } from "../loc_7707.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  const m = {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    call(a) { this.calls.push(a); return undefined; }, // record-only: tail dispatch keeps its push
  };
  regs.sp = 0x8780; m.push16(CALLER_RET);
  return m;
}

// ── active record, state 2 -> rst 0x28 tail dispatch to loc_0028 ────────────────────────────────
test("loc_7707: active record, state 2 -> pushes table base 0x7715, delegates loc_0028; 84 T", () => {
  const m = makeMachine();
  m.regs.ix = 0x8ba0;
  m.mem.write8(0x8ba0, 0x01); // bit0 set -> active (rrca sets carry -> ret nc not taken)
  m.mem.write8(0x8ba2, 0x02); // state 2

  loc_7707(m);

  assert.equal(m.tstates, 84, "T total");
  assert.equal(m.pc, 0x0028, "delegates to loc_0028");
  assert.deepEqual(m.calls, [0x0028], "dispatch trampoline");
  assert.equal(m.regs.a, 0x02, "A = (ix+2)&3 (loc_0028 does the doubling)");
  assert.equal(m.regs.sp, 0x877c, "rst 0x28 pushed one word (the table base)");
  assert.equal(m.mem.read16(m.regs.sp), 0x7715, "pushed return = inline table base");
  assert.equal(m.mem.read16((m.regs.sp + 2) & 0xffff), CALLER_RET, "caller return sits below it");
  assert.deepEqual(m.pcSeq, [0x770a, 0x770d, 0x770e, 0x770f, 0x7712, 0x7714, 0x0028], "step boundaries");
});

// ── inactive record -> early ret nc ─────────────────────────────────────────────────────────────
test("loc_7707: inactive record (bit0 clear) -> ret nc; 53 T", () => {
  const m = makeMachine();
  m.regs.ix = 0x8ba0;
  m.mem.write8(0x8ba0, 0x00);
  m.mem.write8(0x8ba1, 0x00); // or -> 0, rrca -> carry clear -> ret nc

  loc_7707(m);

  assert.equal(m.tstates, 53, "T total");
  assert.equal(m.pc, CALLER_RET, "returns via ret nc");
  assert.deepEqual(m.calls, [], "no dispatch");
  assert.deepEqual(m.pcSeq, [0x770a, 0x770d, 0x770e, CALLER_RET], "step boundaries");
});

test("loc_7707 MUTATION: `or (ix+1)` at 0x770d mis-charged 15T (not 19T) is caught", () => {
  const m = makeMachine();
  m.regs.ix = 0x8ba0;
  m.mem.write8(0x8ba0, 0x01);
  m.mem.write8(0x8ba2, 0x02);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x770d ? 15 : c);
  loc_7707(m);
  assert.equal(m.tstates, 80, "mutation loses 4 T (19 -> 15)");
  assert.notEqual(m.tstates, 84, "golden T-state total catches the mutant");
});
