// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_76ea (ROM 0x76ea-0x76f3): the per-frame driver that calls
// loc_76f4, 0x7625, 0x02ef in order and returns. The call stub balances each pushed return (SP+=2).
//
// Run: node --test games/pooyan/translated/test/loc_76ea.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_76ea } from "../loc_76ea.js";

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

test("loc_76ea: calls 0x76f4, 0x7625, 0x02ef then ret; 61 T", () => {
  const m = makeMachine();

  loc_76ea(m);

  assert.equal(m.tstates, 61, "T total (3*17 + ret 10)");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.regs.sp, 0x8780, "all three call pushes balanced, ret popped caller");
  assert.deepEqual(m.calls, [0x76f4, 0x7625, 0x02ef], "delegation order");
  assert.deepEqual(m.pcSeq, [0x76f4, 0x7625, 0x02ef, CALLER_RET], "step boundaries");
});

test("loc_76ea MUTATION: `call 0x7625` at 0x76ed mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x7625 ? 10 : c);
  loc_76ea(m);
  assert.equal(m.tstates, 54, "mutation loses 7 T (17 -> 10)");
  assert.notEqual(m.tstates, 61, "golden T-state total catches the mutant");
});
