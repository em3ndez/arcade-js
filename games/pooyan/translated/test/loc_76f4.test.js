// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_76f4 (ROM 0x76f4-0x7706): run loc_7707 over 6 object records,
// IX = 0x8ba0 + n*0x18, with the counter/stride parked in the alternate set across each call.
// The call to loc_7707 is a black box here (stub balances the pushed return).
//
// Run: node --test games/pooyan/translated/test/loc_76f4.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_76f4 } from "../loc_76f4.js";

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
    call(a) { this.calls.push(a); regs.sp = (regs.sp + 2) & 0xffff; return undefined; },
  };
  regs.sp = 0x8780; m.push16(CALLER_RET);
  return m;
}

test("loc_76f4: 6 iterations, IX advances 0x18 each -> 0x8c30, ret; 354 T", () => {
  const m = makeMachine();
  m.regs.b = 0x99; // clobbered by ld b,6

  loc_76f4(m);

  assert.equal(m.tstates, 354, "T total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.regs.sp, 0x8780, "6 call pushes balanced, ret popped caller");
  assert.equal(m.regs.ix, 0x8c30, "IX = 0x8ba0 + 6*0x18");
  assert.deepEqual(m.calls, Array(6).fill(0x7707), "loc_7707 called once per record");
  assert.equal(m.pcSeq.filter((p) => p === 0x7707).length, 6, "loop body ran 6 times");
});

test("loc_76f4 MUTATION: dropping the `add ix,de` step (0x7704) loses 6*15 = 90 T", () => {
  const full = makeMachine();
  loc_76f4(full);

  const mut = makeMachine();
  const realStep = mut.step.bind(mut);
  mut.step = (n, c) => realStep(n, n === 0x7704 ? 0 : c);
  loc_76f4(mut);

  assert.equal(full.tstates - mut.tstates, 90, "the 6 add-ix steps contribute 15 T each");
  assert.notEqual(mut.tstates, 354, "a dropped step is caught");
});
