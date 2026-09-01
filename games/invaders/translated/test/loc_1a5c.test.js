// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_1a5c (ROM 0x1a5c-0x1a68): zero work RAM 0x2400-0x3fff. The routine seats
// HL=0x2400 itself and loops until H==0x40, so it always makes 0x1c00 (7168) writes; the stack is
// parked above 0x4000 so the caller return survives the clear and ret lands on it.
//
// Run: node --test games/invaders/translated/test/loc_1a5c.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1a5c } from "../loc_1a5c.js";

const CALLER_RET = 0xabcd;
const ITERS = 0x4000 - 0x2400; // 7168 bytes cleared, one loop body each
const GOLDEN_T = 10 + ITERS * 37 + 10; // lxi + 7168*(mvi+inx+mov+cpi+jnz) + ret

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1a5c, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only (no calls here)
  };
}

test("loc_1a5c: zeroes 0x2400-0x3fff, leaves HL=0x4000/A=0x40, rets to caller", () => {
  const m = makeMachine();
  m.regs.sp = 0x4400; m.push16(CALLER_RET); // stack above the cleared range
  m.ram[0x2400] = 0xff; // low boundary of clear
  m.ram[0x3000] = 0xff; // interior
  m.ram[0x3fff] = 0xff; // high boundary of clear
  m.ram[0x23ff] = 0xff; // just below range -- must survive
  m.ram[0x4000] = 0xff; // just above range -- must survive

  loc_1a5c(m);

  assert.equal(m.mem.read8(0x2400), 0x00, "0x2400 cleared");
  assert.equal(m.mem.read8(0x3000), 0x00, "0x3000 cleared");
  assert.equal(m.mem.read8(0x3fff), 0x00, "0x3fff cleared (last byte)");
  assert.equal(m.mem.read8(0x23ff), 0xff, "0x23ff untouched (below range)");
  assert.equal(m.mem.read8(0x4000), 0xff, "0x4000 untouched (H reached 0x40 -> loop exits)");
  assert.equal(m.regs.hl, 0x4000, "HL walked to 0x4000");
  assert.equal(m.regs.a, 0x40, "A holds H at exit");
  assert.equal(m.regs.fZ, true, "cpi 0x40 with A=0x40 -> Z set (loop exit condition)");
  assert.deepEqual(m.calls, [], "pure clear, no calls");
  assert.equal(m.tstates, GOLDEN_T, "golden T total: lxi + 7168 bodies + ret");
  assert.equal(m.pc, CALLER_RET, "ret returns to caller (stack survived the clear)");
});

test("loc_1a5c MUTATION: not-taken jnz mis-charged 11T not 10T is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x4400; m.push16(CALLER_RET);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1a68 ? c + 1 : c); // exit jnz -> step 0x1a68, real 10T
  loc_1a5c(m);
  assert.equal(m.tstates, GOLDEN_T + 1, "one-off mis-charge shifts the total by exactly 1");
  assert.notEqual(m.tstates, GOLDEN_T, "golden T-state total catches the mutant");
});
