// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_71c7 (ROM 0x71c7-0x71cd): bonus phase 0 body -- two ordered calls then ret.
//
// Run: node --test games/pooyan/translated/test/loc_71c7.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_71c7 } from "../loc_71c7.js";

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

test("loc_71c7: runs 0x71ce then 0x20d4, ret; 64 T", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_71c7(m);

  assert.equal(m.tstates, 17 + 10 + 17 + 10 + 10, "64 T");
  assert.equal(m.pc, CALLER_RET, "returns to caller");
  assert.deepEqual(m.calls, [0x71ce, 0x20d4], "call order");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.pcSeq, [0x71ce, 0x71ca, 0x20d4, 0x71cd, CALLER_RET], "boundaries");
});

test("loc_71c7 MUTATION: call 0x71ce mischarged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x71ce ? 10 : c);
  loc_71c7(m);
  assert.notEqual(m.tstates, 64, "golden 64 T catches the mischarge");
});
