// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_08e4 (ROM 0x08e4-0x08f0): HEAD via `jmp 0x08e4` at 0x00df. If mem[0x20ce]
// != 0 -> ret (rnz); else HL=0x391c, B=0x20 and tail-jump to blitter loc_14cb.
//
// Run: node --test games/invaders/translated/test/loc_08e4.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_08e4 } from "../loc_08e4.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x08e4, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

test("loc_08e4 arm ZERO: mem[0x20ce] == 0 -> setup + tail-jmp loc_14cb", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.mem.write8(0x20ce, 0x00);

  loc_08e4(m);

  assert.equal(m.regs.hl, 0x391c, "HL := 0x391c");
  assert.equal(m.regs.b, 0x20, "B := 0x20");
  assert.equal(m.tstates, 13 + 4 + 5 + 10 + 7 + 10, "T total (rnz not taken, tail jmp)");
  assert.equal(m.pc, 0x14cb, "tail jmp lands on loc_14cb");
  assert.deepEqual(m.calls, [0x14cb], "delegates to loc_14cb");
  assert.deepEqual(m.pcSeq, [0x08e7, 0x08e8, 0x08e9, 0x08ec, 0x08ee, 0x14cb], "step boundaries");
  assert.equal(m.regs.sp, 0x2400, "stack unwound (loc_14cb rets to caller)");
});

test("loc_08e4 arm NONZERO: mem[0x20ce] != 0 -> early rnz", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.mem.write8(0x20ce, 0x01);

  loc_08e4(m);

  assert.equal(m.tstates, 13 + 4 + 11, "T total (rnz taken)");
  assert.equal(m.pc, CALLER_RET, "ret to caller");
  assert.deepEqual(m.calls, [], "no blit on the early-return arm");
  assert.deepEqual(m.pcSeq, [0x08e7, 0x08e8, CALLER_RET], "step boundaries");
});

test("loc_08e4 MUTATION: rnz not-taken mis-charged 11T (not 5T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.mem.write8(0x20ce, 0x00);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x08e9 ? 11 : c); // fall-through off rnz is 5T
  loc_08e4(m);
  assert.equal(m.tstates, 13 + 4 + 11 + 10 + 7 + 10, "mutation adds 6 T (5 -> 11)");
  assert.notEqual(m.tstates, 49, "golden T-state total catches the mutant");
});
