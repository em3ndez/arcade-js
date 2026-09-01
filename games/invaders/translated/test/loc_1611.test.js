// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_1611 (ROM 0x1611-0x1617): HL := mem[0x2067] << 8 (L=0, H=A), then ret.
// Values derived from dk.asm. loc_1611 makes no internal call, so its ret pops the caller return.
//
// Run: node --test games/invaders/translated/test/loc_1611.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1611 } from "../loc_1611.js";

const CALLER_RET = 0x1234;

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1611, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_1611: HL := mem[0x2067]<<8 (L=0,H=A), rets; 35 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write16(0x2400, CALLER_RET); // caller return
  m.mem.write8(0x2067, 0x37);        // page byte -> H
  m.regs.l = 0xaa;                    // proves mvi l overwrites it

  loc_1611(m);

  assert.equal(m.regs.l, 0x00, "L := 0x00");
  assert.equal(m.regs.a, 0x37, "A := mem[0x2067]");
  assert.equal(m.regs.h, 0x37, "H := A");
  assert.equal(m.regs.hl, 0x3700, "HL = mem[0x2067] << 8");
  assert.equal(m.tstates, 7 + 13 + 5 + 10, "mvi(7)+lda(13)+mov(5)+ret(10)");
  assert.deepEqual(m.calls, [], "no internal calls");
  assert.equal(m.pc, CALLER_RET, "ret to caller return");
  assert.equal(m.regs.sp, 0x2402, "SP popped once by ret");
  assert.deepEqual(m.pcSeq, [0x1613, 0x1616, 0x1617, CALLER_RET], "step boundaries");
});

test("loc_1611 MUTATION: lda mis-charged 10T (not 13T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write16(0x2400, CALLER_RET);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1616 ? 10 : c); // 0x1616 = landing after lda
  loc_1611(m);
  assert.equal(m.tstates, 7 + 10 + 5 + 10, "mutation loses 3 T (lda 13 -> 10)");
  assert.notEqual(m.tstates, 35, "golden T-state total catches the mutant");
});
