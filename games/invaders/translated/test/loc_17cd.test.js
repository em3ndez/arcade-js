// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for translated loc_17cd (ROM 0x17cd-0x1803): early-out unless port2 bit2 set and
// 0x209a clear; else re-seat SP, four 0x09d6 clear passes, mark+re-init+EI+redraw, jmp 0x16c9.
// Golden = the full run path; plus the rz early-out and a T-state mutation.
// Run: node --test games/invaders/translated/test/loc_17cd.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_17cd } from "../loc_17cd.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x17cd, pcSeq: [],
    io: { ins: {}, inte: false, portIn(p) { return this.ins[p] & 0xff || 0; }, setInte(on) { this.inte = !!on; } },
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

const RUN_PC = [
  0x17cf, 0x17d1, 0x17d2, 0x17d5, 0x17d6, 0x17d7, 0x17da, 0x17dc,
  0x09d6, 0x17e0, 0x17dc,
  0x09d6, 0x17e0, 0x17dc,
  0x09d6, 0x17e0, 0x17dc,
  0x09d6, 0x17e0, 0x17e3,
  0x17e5, 0x17e8, 0x19d7, 0x17ec, 0x17ef, 0x17f2, 0x17f4, 0x0a93, 0x0ab1, 0x17fb, 0x17fe, 0x1801, 0x16c9,
];

test("loc_17cd run path: clears screen, EI, redraws, jmp 0x16c9; 331 T", () => {
  const m = makeMachine();
  m.io.ins[0x02] = 0x04; // bit2 set -> not rz
  m.mem.write8(0x209a, 0x00); // clear -> not rnz

  loc_17cd(m);

  assert.equal(m.regs.b, 0x00, "B decremented to 0 over four passes");
  assert.equal(m.regs.c, 0x04, "mvi c,0x04");
  assert.equal(m.regs.de, 0x1cbc, "lxi d,0x1cbc");
  assert.equal(m.regs.hl, 0x3016, "lxi h,0x3016");
  assert.equal(m.regs.a, 0x00, "xra a leaves A=0");
  assert.equal(m.mem.read8(0x209a), 0x00, "0x209a set then cleared -> 0");
  assert.equal(m.mem.read8(0x2093), 0x00, "0x2093 cleared");
  assert.equal(m.io.inte, true, "EI armed the interrupt-enable flip-flop");
  assert.equal(m.regs.sp, 0x2400 - 7 * 2, "SP re-seated 0x2400 then 7 record-only call pushes");
  assert.equal(m.tstates, 61 + 128 + 142, "setup(61)+loop(4*32)+tail(142)");
  assert.deepEqual(m.calls, [0x09d6, 0x09d6, 0x09d6, 0x09d6, 0x19d7, 0x0a93, 0x0ab1, 0x16c9], "four clears, re-init, two draws, tail 0x16c9");
  assert.deepEqual(m.pcSeq, RUN_PC, "step boundaries");
});

test("loc_17cd rz early-out: port2 bit2 clear -> return; 28 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.io.ins[0x02] = 0x00; // bit2 clear -> ani 0x04 == 0 -> rz taken

  loc_17cd(m);

  assert.equal(m.tstates, 10 + 7 + 11, "in+ani+rz(taken)");
  assert.deepEqual(m.calls, [], "no work done");
  assert.deepEqual(m.pcSeq, [0x17cf, 0x17d1, CALLER_RET], "step boundaries");
  assert.equal(m.pc, CALLER_RET, "returns to caller");
});

test("loc_17cd MUTATION: `ani` mis-charged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.io.ins[0x02] = 0x00;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x17d1 ? 4 : c);
  loc_17cd(m);
  assert.equal(m.tstates, 10 + 4 + 11, "mutation loses 3 T");
  assert.notEqual(m.tstates, 28, "golden T-state total catches the mutant");
});
