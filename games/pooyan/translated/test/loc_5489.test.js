// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for translated loc_5489 (ROM 0x5489, Pooyan) -- actor-block initialiser.
 * Straight-line (no branches); ends `pop af; ret` (skip-return past its immediate caller).
 *
 * The mock's `call` POPS the return address each call site pushed (models the callee's `ret`); for the
 * two rst 0x20 (loc_0020) it also reproduces loc_0020's net effect HL += A; A = (HL), since (ix+0x0a)
 * depends on the second lookup. loc_0c45 / loc_381e leave nothing loc_5489 reads back, so those mock
 * calls only pop. Stack is seated GRANDCALLER_RET then CALLER_RET: the `pop af` drops CALLER_RET and the
 * `ret` returns to GRANDCALLER_RET, fully unwinding -- a missing push16 at any call site desyncs it.
 *
 * Run: node --test games/pooyan/translated/test/loc_5489.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5489 } from "../loc_5489.js";

const CALLER_RET = 0xabcd;
const GRAND_RET = 0x1234;
const IX = 0x8c30;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5489, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // Pop the pushed return (models the callee `ret`); loc_0020 additionally does HL += A; A = (HL).
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x0020) { regs.hl = (regs.hl + regs.a) & 0xffff; regs.a = mem.read8(regs.hl); }
      return undefined;
    },
  };
}

test("loc_5489 initialise: seeds fields, two rst-0x20 lookups -> signed (ix+0x0a); 319 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x8780;
  m.push16(GRAND_RET);
  m.push16(CALLER_RET);
  m.regs.ix = IX;
  m.regs.b = 0x07;             // -> (ix+0x06)
  m.mem.write8(IX + 0x17, 0x02); // -> C = 0x02 (first lookup index)
  m.mem.write8(0x8907, 0x01);  // 0x8907 & 7 = 1 -> second index 3*1 = 3
  // first rst: HL = 0x55d7 + 0x02 = 0x55d9 (A there discarded by ld a,(0x8907))
  m.mem.write8(0x55d9, 0x77);
  // second rst: HL = 0x55d9 + 0x03 = 0x55dc; A = 0x05 -> neg -> 0xfb
  m.mem.write8(0x55dc, 0x05);

  loc_5489(m);

  assert.equal(m.tstates, 319, "T-state total");
  assert.deepEqual(m.pcSeq, [
    0x548d, 0x548e, 0x5491, 0x5494, 0x5498, 0x549c, 0x549f, 0x54a2, 0x54a3, 0x54a6,
    0x0c45, 0x381e,                     // call targets (loc_0c45, loc_381e)
    0x54b0, 0x54b1, 0x54b4, 0x0020,     // rst 0x20 -> loc_0020
    0x54b8, 0x54ba, 0x54bb, 0x54bc, 0x54bd, 0x0020, // second rst 0x20
    0x54c0, 0x54c3, 0x54c4, GRAND_RET,
  ], "step boundaries visit the call targets; ends at the grandcaller");
  assert.equal(m.pc, GRAND_RET, "pop af + ret returns past the immediate caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (every push16 matched a callee ret)");
  assert.deepEqual(m.calls, [0x0c45, 0x381e, 0x0020, 0x0020]);
  assert.equal(m.mem.read8(IX + 0x00), 0x01);
  assert.equal(m.mem.read8(IX + 0x02), 0x00);
  assert.equal(m.mem.read8(IX + 0x05), 0x00);
  assert.equal(m.mem.read8(IX + 0x03), 0x60);
  assert.equal(m.mem.read8(IX + 0x04), 0x1b);
  assert.equal(m.mem.read8(IX + 0x06), 0x07, "(ix+0x06) = B");
  assert.equal(m.mem.read8(IX + 0x11), 0x40);
  assert.equal(m.mem.read8(IX + 0x0a), 0xfb, "neg(0x05) speed");
});

test("loc_5489 MUTATION: rst 0x20 mis-charged 4T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  let firstRst = true;
  m.step = (nextAddr, cycles) => {
    if (nextAddr === 0x0020 && firstRst) { firstRst = false; return realStep(nextAddr, 4); }
    return realStep(nextAddr, cycles);
  };
  m.regs.sp = 0x8780;
  m.push16(GRAND_RET);
  m.push16(CALLER_RET);
  m.regs.ix = IX;
  m.regs.b = 0x07;
  m.mem.write8(IX + 0x17, 0x02);
  m.mem.write8(0x8907, 0x01);
  m.mem.write8(0x55dc, 0x05);

  loc_5489(m);

  assert.equal(m.tstates, 312, "mutation loses 7 T (11 -> 4)");
  assert.throws(() => assert.equal(m.tstates, 319, "T-state total"), /319/);
});
