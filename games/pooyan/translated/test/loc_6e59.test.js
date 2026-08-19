// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_6e59 (ROM 0x6e59-0x6e74): level-intro phase 1 body -- nine ordered calls.
// All are plain-ret callees (pattern-A), so the stub runs m.ret().
//
// Run: node --test games/pooyan/translated/test/loc_6e59.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6e59 } from "../loc_6e59.js";

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
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    call(addr) { this.calls.push(addr); this.ret(); return undefined; },
  };
}
function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_6e59: nine ordered calls then ret; 253 T", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_6e59(m);

  assert.equal(m.tstates, 9 * (17 + 10) + 10, "253 T (9 calls @27 + ret 10)");
  assert.equal(m.pc, CALLER_RET, "returns to caller");
  assert.deepEqual(m.calls,
    [0x1583, 0x6e75, 0x1e55, 0x20d4, 0x02ef, 0x18da, 0x191c, 0x6404, 0x0e64], "call order");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.pcSeq,
    [0x1583, 0x6e5c, 0x6e75, 0x6e5f, 0x1e55, 0x6e62, 0x20d4, 0x6e65, 0x02ef, 0x6e68,
     0x18da, 0x6e6b, 0x191c, 0x6e6e, 0x6404, 0x6e71, 0x0e64, 0x6e74, CALLER_RET], "boundaries");
});

test("loc_6e59 MUTATION: a dropped call step (17->0) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x191c ? 0 : c);
  loc_6e59(m);
  assert.notEqual(m.tstates, 253, "golden 253 T catches the dropped step");
});
