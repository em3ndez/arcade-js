// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for translated loc_1804 (ROM 0x1804-0x1814): 0x2084 zero -> delegate 0x0707; else
// 0x2085 nonzero -> return; else B=1, tail-jump 0x18fa. All three arms + a T-state mutation.
// Run: node --test games/invaders/translated/test/loc_1804.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1804 } from "../loc_1804.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1804, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

test("loc_1804 main: 0x2084 nonzero, 0x2085 zero -> B=1, tail 0x18fa; 69 T", () => {
  const m = makeMachine();
  m.mem.write8(0x2084, 0x01);
  m.mem.write8(0x2085, 0x00);

  loc_1804(m);

  assert.equal(m.regs.hl, 0x2085, "inx h advanced to 0x2085");
  assert.equal(m.regs.a, 0x00, "A := [0x2085] == 0");
  assert.equal(m.regs.b, 0x01, "mvi b,0x01");
  assert.equal(m.tstates, 10 + 7 + 4 + 10 + 5 + 7 + 4 + 5 + 7 + 10, "fall-through path");
  assert.deepEqual(m.calls, [0x18fa], "tail-jump delegate");
  assert.deepEqual(m.pcSeq, [0x1807, 0x1808, 0x1809, 0x180c, 0x180d, 0x180e, 0x180f, 0x1810, 0x1812, 0x18fa], "step boundaries");
});

test("loc_1804 jz arm: 0x2084 zero -> delegate 0x0707; 31 T", () => {
  const m = makeMachine();
  m.mem.write8(0x2084, 0x00);

  loc_1804(m);

  assert.equal(m.tstates, 10 + 7 + 4 + 10, "lxi+mov+ana+jz(taken)");
  assert.deepEqual(m.calls, [0x0707], "delegate 0x0707");
  assert.deepEqual(m.pcSeq, [0x1807, 0x1808, 0x1809, 0x0707], "step boundaries");
});

test("loc_1804 rnz arm: 0x2084 nonzero, 0x2085 nonzero -> return; 58 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.mem.write8(0x2084, 0x01);
  m.mem.write8(0x2085, 0x02);

  loc_1804(m);

  assert.equal(m.tstates, 10 + 7 + 4 + 10 + 5 + 7 + 4 + 11, "to rnz(taken)");
  assert.deepEqual(m.calls, [], "no delegation");
  assert.deepEqual(m.pcSeq, [0x1807, 0x1808, 0x1809, 0x180c, 0x180d, 0x180e, 0x180f, CALLER_RET], "step boundaries");
  assert.equal(m.pc, CALLER_RET, "returns to caller");
});

test("loc_1804 MUTATION: `inx h` mis-charged 10T (not 5T) is caught", () => {
  const m = makeMachine();
  m.mem.write8(0x2084, 0x01);
  m.mem.write8(0x2085, 0x00);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x180d ? 10 : c);
  loc_1804(m);
  assert.equal(m.tstates, 69 + 5, "mutation adds 5 T (5 -> 10)");
  assert.notEqual(m.tstates, 69, "golden T-state total catches the mutant");
});
