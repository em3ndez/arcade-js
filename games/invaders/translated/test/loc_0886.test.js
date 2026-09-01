// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_0886 (ROM 0x0886-0x088c): HL := (mem[0x2067] << 8) | 0xfc, then ret.
//
// Run: node --test games/invaders/translated/test/loc_0886.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0886 } from "../loc_0886.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0886, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

test("loc_0886: HL := (mem[0x2067]<<8)|0xfc, ret", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.mem.write8(0x2067, 0x25);

  loc_0886(m);

  assert.equal(m.regs.a, 0x25, "A := mem[0x2067]");
  assert.equal(m.regs.h, 0x25, "H := A");
  assert.equal(m.regs.l, 0xfc, "L := 0xfc");
  assert.equal(m.regs.hl, 0x25fc, "HL composed");
  assert.equal(m.tstates, 13 + 5 + 7 + 10, "T total");
  assert.equal(m.pc, CALLER_RET, "ret to caller");
  assert.deepEqual(m.calls, [], "no sub-calls");
  assert.deepEqual(m.pcSeq, [0x0889, 0x088a, 0x088c, CALLER_RET], "step boundaries");
  assert.equal(m.regs.sp, 0x2400, "stack unwound by ret");
});

test("loc_0886 MUTATION: lda mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.mem.write8(0x2067, 0x25);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0889 ? 7 : c);
  loc_0886(m);
  assert.equal(m.tstates, 7 + 5 + 7 + 10, "mutation loses 6 T");
  assert.notEqual(m.tstates, 35, "golden T-state total catches the mutant");
});
