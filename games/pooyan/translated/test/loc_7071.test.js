// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_7071 (ROM 0x7071-0x70e9): the ANTI-TAMPER clone of loc_0b32. We pin the
// row-block-mismatch path: the very first (0x82bc) comparison fails, so it tail-jumps to sub-state 0
// (0x08b3). `call` is record-only here (a tail jump, not a pattern-A call, so no ret).
//
// Run: node --test games/pooyan/translated/test/loc_7071.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_7071 } from "../loc_7071.js";

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
    call(addr) { this.calls.push(addr); return undefined; },
  };
}
function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_7071: first (0x82bc) row mismatch tail-jumps to 0x08b3; 62 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x82bc, 0x01); // (0x82bc) != (0x82bc-0x20): mismatch on iteration 1

  loc_7071(m);

  assert.equal(m.tstates, 10 + 10 + 7 + 7 + 11 + 7 + 10, "62 T");
  assert.equal(m.pc, 0x08b3, "tail-jump to attract sub-state 0");
  assert.deepEqual(m.calls, [0x08b3], "delegates to 0x08b3");
  assert.deepEqual(m.pcSeq, [0x7074, 0x7077, 0x7079, 0x707a, 0x707b, 0x707c, 0x08b3], "boundaries");
  assert.equal(m.regs.hl, 0x829c, "HL walked one -0x20 stride");
});

test("loc_7071 MUTATION: add hl,de at 0x707a mischarged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x82bc, 0x01);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x707b ? 7 : c);
  loc_7071(m);
  assert.notEqual(m.tstates, 62, "golden 62 T catches the mischarge");
});
