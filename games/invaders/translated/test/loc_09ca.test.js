// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_09ca (ROM 0x09ca-0x09d5): pick the active player's pointer from bit0 of
// 0x2067. Both arms tested: bit0=1 -> carry set -> HL=0x20f8, early rc; bit0=0 -> HL=0x20fc.
//
// Run: node --test games/invaders/translated/test/loc_09ca.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_09ca } from "../loc_09ca.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x2400; m.push16(CALLER_RET); }

test("loc_09ca: 0x2067 bit0=1 -> HL=0x20f8, early rc; 38 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x2067, 0x01);

  loc_09ca(m);

  assert.equal(m.regs.hl, 0x20f8, "carry set -> player-2 pointer 0x20f8");
  assert.equal(m.pc, CALLER_RET, "rc returns to caller");
  assert.deepEqual(m.pcSeq, [0x09cd, 0x09ce, 0x09d1, CALLER_RET], "rc taken, no fall-through");
  assert.equal(m.tstates, 13 + 4 + 10 + 11, "38 T: lda+rrc+lxi+rc(taken)");
});

test("loc_09ca: 0x2067 bit0=0 -> HL=0x20fc, rc not taken; 52 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x2067, 0x00);

  loc_09ca(m);

  assert.equal(m.regs.hl, 0x20fc, "carry clear -> player-1 pointer 0x20fc");
  assert.equal(m.pc, CALLER_RET, "final ret to caller");
  assert.deepEqual(m.pcSeq, [0x09cd, 0x09ce, 0x09d1, 0x09d2, 0x09d5, CALLER_RET], "rc falls through");
  assert.equal(m.tstates, 13 + 4 + 10 + 5 + 10 + 10, "52 T: lda+rrc+lxi+rc(nt)+lxi+ret");
});

test("loc_09ca MUTATION: `rc` not-taken mis-charged 11T (not 5T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x2067, 0x00);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x09d2 ? 11 : c);
  loc_09ca(m);
  assert.notEqual(m.tstates, 52, "golden T-state total catches the mutant");
});
