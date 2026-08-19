// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for the translated loc_0343 (Pooyan ROM 0x0343) -- the moving-object copy loop.
 * Two of the four bytes per record are computed screen coordinates: the 16-bit sub-pixel pair is
 * shifted left 3 (top 3 bits of the low byte rolled into A by `rlc c; rla` x3) then biased -8.
 *
 * Self-contained mock (real Regs, flat RAM, seated caller). Leaf routine, single `ret`.
 *
 * Path (B=1): one record from IX=0x8AE0. Hand-computed coords:
 *   (ix+5,ix+6)=0x40,0x03 -> 0x1A - 8 = 0x12 ; (ix+3,ix+4)=0x80,0x02 -> 0x14 - 8 = 0x0C.
 *   Raw bytes (ix+0x10)=0x55, (ix+0x0f)=0x66. Result list = [0x12,0x55,0x0C,0x66] (277 T).
 * Plus B=2 (549 T) proving the djnz loop-back.
 *
 * TEETH: mis-charge `add ix,de` (DD 19 = 15 T) as `add hl,de` (11 T); the golden 277 must catch it.
 *
 * Run: node --test games/pooyan/translated/test/loc_0343.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0343 } from "../loc_0343.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0343, pcSeq: [],
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
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

// Record at IX=0x8AE0 with the coordinate sources chosen so the shift is easy to check by hand.
function setupRec0(m) {
  seatCaller(m);
  m.regs.hl = 0x8850;
  m.regs.ix = 0x8ae0;
  m.regs.de = 0x0018;
  m.regs.b = 0x01;
  m.mem.write8(0x8ae5, 0x40); m.mem.write8(0x8ae6, 0x03); // coord A src (ix+5:ix+6)
  m.mem.write8(0x8af0, 0x55);                             // (ix+0x10) raw
  m.mem.write8(0x8ae3, 0x80); m.mem.write8(0x8ae4, 0x02); // coord B src (ix+3:ix+4)
  m.mem.write8(0x8aef, 0x66);                             // (ix+0x0f) raw
}

const ITER = [
  0x0346, 0x0349, 0x034b, 0x034c, 0x034e, 0x034f, 0x0351, 0x0352, 0x0354, 0x0355, 0x0356,
  0x0359, 0x035a, 0x035b, 0x035e, 0x0361, 0x0363, 0x0364, 0x0366, 0x0367, 0x0369, 0x036a,
  0x036c, 0x036d, 0x036e, 0x0371, 0x0372, 0x0373, 0x0375,
];
const EXPECTED_PC_SEQ_B1 = [...ITER, 0x0377, CALLER_RET];

test("loc_0343 B=1: coord math -> list [0x12,0x55,0x0C,0x66]", () => {
  const m = makeMachine();
  setupRec0(m);
  loc_0343(m);

  const b = (a) => m.mem.read8(a);
  assert.equal(m.tstates, 277, "B=1 T-state total");
  assert.equal(m.pc, CALLER_RET, "ends via ret");
  assert.deepEqual(m.calls, [], "leaf -- no calls");
  assert.deepEqual([b(0x8850), b(0x8851), b(0x8852), b(0x8853)], [0x12, 0x55, 0x0c, 0x66], "record");
  assert.equal(m.regs.hl, 0x8854, "HL advanced by 4");
  assert.equal(m.regs.ix, 0x8af8, "IX advanced by one stride");
  assert.equal(m.regs.b, 0x00);
  assert.equal(m.regs.a, 0x66, "A = last raw byte");
  assert.equal(m.regs.c, 0x04, "C = last rotated low byte (0x02 rlc = 0x04)");
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ_B1, "step boundaries match the disassembly");
});

test("loc_0343 B=2: djnz loops once", () => {
  const m = makeMachine();
  setupRec0(m);
  m.regs.b = 0x02;
  // second record at IX+0x18 = 0x8AF8
  m.mem.write8(0x8afd, 0x00); m.mem.write8(0x8afe, 0x10); // coord A -> 0x10<<3 -8 = 0x78
  m.mem.write8(0x8b08, 0x99);
  m.mem.write8(0x8afb, 0x00); m.mem.write8(0x8afc, 0x20); // coord B -> 0x20<<3 -8 = 0xF8
  m.mem.write8(0x8b07, 0xaa);
  loc_0343(m);

  const b = (a) => m.mem.read8(a);
  assert.equal(m.tstates, 549, "B=2 = 2*259 body + 13 + 8 djnz + 10 ret");
  assert.deepEqual([b(0x8850), b(0x8853)], [0x12, 0x66], "record 0 intact");
  assert.deepEqual([b(0x8854), b(0x8855), b(0x8856), b(0x8857)], [0x78, 0x99, 0xf8, 0xaa], "record 1");
  assert.equal(m.regs.hl, 0x8858, "HL advanced by 8");
  assert.equal(m.regs.ix, 0x8b10, "IX advanced by 2 strides");
  assert.equal(m.regs.b, 0x00);
});

test("loc_0343 MUTATION: `add ix,de` mis-charged 11T (dropped DD prefix) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  let first = true;
  m.step = (nextAddr, cycles) => {
    if (first && nextAddr === 0x0375) { first = false; return realStep(nextAddr, 11); }
    return realStep(nextAddr, cycles);
  };
  setupRec0(m);
  loc_0343(m);
  assert.equal(m.tstates, 273, "mutation loses 4 T (15 -> 11)");
  assert.throws(() => assert.equal(m.tstates, 277, "B=1 T-state total"), /T-state total/);
});
