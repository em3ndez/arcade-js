// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for translated loc_5b06 (ROM 0x5b06-0x5b2b, Pooyan) -- a checksum gate.
 * Runs only when (0x8907)==5; then sums the 6 bytes at DE=0x1553 (iy=0x5315 copied byte-swapped:
 * d=iyl, e=iyh) carrying into H, and tests L+H+0x7f. A zero result ret's (5b25); a nonzero result
 * bumps the counter at 0x881e and ret's (5b2b). Pure leaf -- no calls, no push16.
 *
 * Paths: GATE ((0x8907)!=5 -> ret nz immediately); ZERO (checksum balances -> ret z, 0x881e
 * untouched); SUM (nonzero -> both jr-nc outcomes exercised, one carry into H, bumps 0x881e).
 * TEETH: mis-charge `inc (hl)` (11 T) as 7 T -> the 395-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_5b06.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5b06 } from "../loc_5b06.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5b06, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const PC_SUM = [
  0x5b09, 0x5b0b, 0x5b0c, 0x5b10, 0x5b12, 0x5b14, 0x5b15, 0x5b16, 0x5b17,
  0x5b19, 0x5b1a, 0x5b1b, 0x5b1e, 0x5b1f, 0x5b20,             // iter1: jr nc taken
  0x5b19, 0x5b1a, 0x5b1b, 0x5b1d, 0x5b1e, 0x5b1f, 0x5b20,     // iter2: carry -> inc h
  0x5b19, 0x5b1a, 0x5b1b, 0x5b1e, 0x5b1f, 0x5b20,             // iter3
  0x5b19, 0x5b1a, 0x5b1b, 0x5b1e, 0x5b1f, 0x5b20,             // iter4
  0x5b19, 0x5b1a, 0x5b1b, 0x5b1e, 0x5b1f, 0x5b20,             // iter5
  0x5b19, 0x5b1a, 0x5b1b, 0x5b1e, 0x5b1f, 0x5b20,             // iter6 (djnz falls out)
  0x5b22, 0x5b23, 0x5b25, 0x5b26, 0x5b28, 0x5b2a, 0x5b2b, CALLER_RET,
];

test("loc_5b06 SUM: (0x8907)==5, nonzero checksum -> bump 0x881e + ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x05);
  // bytes at DE=0x1553: 0xff then 0x02 forces a carry (inc h) on iteration 2
  [0xff, 0x02, 0x00, 0x00, 0x00, 0x00].forEach((v, i) => m.mem.write8(0x1553 + i, v));

  loc_5b06(m);

  assert.equal(m.tstates, 395, "SUM T-state total");
  assert.deepEqual(m.pcSeq, PC_SUM, "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "ret at 0x5b2b to the seated caller");
  assert.equal(m.mem.read8(0x881e), 0x01, "counter at 0x881e bumped");
  assert.equal(m.regs.a, 0x81, "A = L+H+0x7f (0x01+0x01+0x7f)");
  assert.equal(m.regs.hl, 0x881e, "HL = 0x881e after ld h,0x88 / ld l,0x1e");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to the pre-seat baseline");
});

test("loc_5b06 ZERO: checksum balances -> ret z at 0x5b25, 0x881e untouched", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x05);
  // 0x81 in slot 0 -> L=0x81, H=0, A=0x81; 0x81+0x7f=0x100 -> A=0, Z set
  [0x81, 0x00, 0x00, 0x00, 0x00, 0x00].forEach((v, i) => m.mem.write8(0x1553 + i, v));

  loc_5b06(m);

  assert.equal(m.tstates, 367, "ZERO T-state total");
  assert.deepEqual(m.pcSeq, [
    0x5b09, 0x5b0b, 0x5b0c, 0x5b10, 0x5b12, 0x5b14, 0x5b15, 0x5b16, 0x5b17,
    0x5b19, 0x5b1a, 0x5b1b, 0x5b1e, 0x5b1f, 0x5b20,
    0x5b19, 0x5b1a, 0x5b1b, 0x5b1e, 0x5b1f, 0x5b20,
    0x5b19, 0x5b1a, 0x5b1b, 0x5b1e, 0x5b1f, 0x5b20,
    0x5b19, 0x5b1a, 0x5b1b, 0x5b1e, 0x5b1f, 0x5b20,
    0x5b19, 0x5b1a, 0x5b1b, 0x5b1e, 0x5b1f, 0x5b20,
    0x5b19, 0x5b1a, 0x5b1b, 0x5b1e, 0x5b1f, 0x5b20,
    0x5b22, 0x5b23, 0x5b25, CALLER_RET,
  ], "all six loop iterations then ret z at 0x5b25");
  assert.equal(m.pc, CALLER_RET, "ret z to the seated caller");
  assert.equal(m.regs.a, 0x00, "A == 0 (Z that took the ret)");
  assert.equal(m.mem.read8(0x881e), 0x00, "0x881e never bumped on the balanced path");
});

test("loc_5b06 GATE: (0x8907)!=5 -> ret nz at 0x5b0b immediately", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x03);

  loc_5b06(m);

  assert.equal(m.tstates, 13 + 7 + 11, "T = ld a,(nn) + cp + ret nz");
  assert.deepEqual(m.pcSeq, [0x5b09, 0x5b0b, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
});

test("loc_5b06 MUTATION: `inc (hl)` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5b2b ? 7 : cycles);
  seatCaller(m);
  m.mem.write8(0x8907, 0x05);
  [0xff, 0x02, 0x00, 0x00, 0x00, 0x00].forEach((v, i) => m.mem.write8(0x1553 + i, v));

  loc_5b06(m);

  assert.equal(m.tstates, 391, "mutation loses 4 T (11 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 395, "SUM T-state total"),
    /395/,
    "the 395-T golden must fail on the mutant",
  );
});
