// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1d9c (ROM 0x1d9c-0x1dca, Pooyan) -- per-frame gate on (0x8907)
 * bit 1.
 *   bit 1 CLEAR: tail-call loc_0fd5 (the main-loop sub-state dispatcher), then ret.
 *   bit 1 SET:   call loc_6da6, set HL=0x5a28 (0x584c: l-=0x24 -> 0x28; h+=2 -> 0x5a), then loop
 *                B=0x20 times over the SAME cell (no `inc hl` in the body), tallying A += (bit0 of
 *                (HL) set) + (bit3 of (HL) clear) each pass. If A != C (=0x20) it latches
 *                (0x89e7)=1; if A == C it `ret z` writing nothing.
 *
 * The mock's `call` POPS the pushed return (models each callee's ret) so a missing push16 desyncs
 * SP -- the final ret then lands off CALLER_RET and the SP-baseline assertion throws.
 *
 * Pinned paths:
 *   B  (0x8907 bit1=0): call [0x0fd5], ret. T = 13+8+7+17+10 = 55.
 *   A0 (0x8907 bit1=1, (0x5a28)=0x00): bit0 clear + bit3 clear => +1/pass => A=0x20 == C => ret z,
 *      no write. T = 2027, calls [0x6da6].
 *   A1 (0x8907 bit1=1, (0x5a28)=0x01): bit0 set + bit3 clear => +2/pass => A=0x40 != C => latch
 *      (0x89e7)=1. T = 2019, calls [0x6da6].
 *
 * TEETH: mis-charge `ld a,(0x8907)` (13 T) as 7 T on path B -- the golden T-state must catch it.
 * POSITIVE CONTROL (performed while authoring): deleting either push16 desyncs SP so the closing
 * ret misses CALLER_RET and the sp assertion throws; restored afterward.
 *
 * Run: node --test games/pooyan/translated/test/loc_1d9c.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1d9c } from "../loc_1d9c.js";

const CALLER_RET = 0xabcd;
const SP_BASE = 0x8780;

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1d9c, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write16(regs.sp, v); },
    pop16() { const v = mem.read16(regs.sp); regs.sp = (regs.sp + 2) & 0xffff; return v; },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // Each callee's `ret` pops the return this site pushed -- model it so SP stays balanced and a
    // missing push16 fails the SP-baseline tooth. loc_1d9c consumes nothing from 0x0fd5/0x6da6.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = SP_BASE; m.push16(CALLER_RET); }

// Build the loop's expected pcSeq. `bodyMid` = step targets between entering 0x1db7 and the djnz
// decision; the djnz then steps back to 0x1db7 for the first 31 passes, or to 0x1dc3 on the last.
function loopPcSeq(bodyMid) {
  const seq = [];
  for (let i = 0; i < 32; i++) {
    seq.push(...bodyMid);
    seq.push(i < 31 ? 0x1db7 : 0x1dc3);
  }
  return seq;
}

const HEAD_A = [
  0x1d9f, 0x1da1, 0x1da7,
  0x6da6,                 // call 0x6da6 -> target
  0x1dad, 0x1dae, 0x1db0, 0x1db1, 0x1db2, 0x1db3, 0x1db6, 0x1db7,
];

test("loc_1d9c: bit 1 clear -> tail-call loc_0fd5, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x00); // bit 1 clear

  loc_1d9c(m);

  assert.equal(m.tstates, 55, "T = 13+8+7(jr nt)+17(call)+10(ret)");
  assert.deepEqual(m.pcSeq, [0x1d9f, 0x1da1, 0x1da3, 0x0fd5, CALLER_RET],
    "not-taken path calls 0x0fd5 then rets to the caller");
  assert.deepEqual(m.calls, [0x0fd5], "delegates to the sub-state dispatcher loc_0fd5");
  assert.equal(m.pc, CALLER_RET, "ret popped the seated caller");
  assert.equal(m.regs.sp, SP_BASE, "stack balanced (call popped its pushed return)");
});

test("loc_1d9c: bit 1 set, (0x5a28)=0x00 -> +1/pass, A==C, ret z, no write", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x02); // bit 1 set
  m.mem.write8(0x5a28, 0x00); // bit0 clear, bit3 clear

  loc_1d9c(m);

  assert.equal(m.tstates, 2027, "prologue+setup+32*(47 body)+31*13+8 djnz +4 cp c +11 ret z");
  assert.deepEqual(m.pcSeq,
    [...HEAD_A, ...loopPcSeq([0x1db9, 0x1dbc, 0x1dbe, 0x1dc0, 0x1dc1]), 0x1dc4, CALLER_RET],
    "bit0 clear (jr z taken) + bit3 clear (jr nz nt, inc a) each pass, then ret z");
  assert.deepEqual(m.calls, [0x6da6], "calls loc_6da6 only");
  assert.equal(m.regs.a, 0x20, "A tallied +1 over 0x20 passes = 0x20");
  assert.equal(m.regs.c, 0x20, "C = low byte of ld bc,0x2020");
  assert.equal(m.mem.read8(0x89e7), 0x00, "A==C -> ret z, latch NOT written");
  assert.equal(m.pc, CALLER_RET, "ret popped the seated caller");
  assert.equal(m.regs.sp, SP_BASE, "stack balanced");
});

test("loc_1d9c: bit 1 set, (0x5a28)=0x01 -> +2/pass, A!=C, latch (0x89e7)=1", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x02); // bit 1 set
  m.mem.write8(0x5a28, 0x01); // bit0 set, bit3 clear

  loc_1d9c(m);

  assert.equal(m.tstates, 2019, "same loop shape, both inc a each pass; ret z nt then latch");
  assert.deepEqual(m.pcSeq,
    [...HEAD_A, ...loopPcSeq([0x1db9, 0x1dbb, 0x1dbc, 0x1dbe, 0x1dc0, 0x1dc1]),
      0x1dc4, 0x1dc5, 0x1dc7, 0x1dca, CALLER_RET],
    "bit0 set (jr z nt, inc a) + bit3 clear (jr nz nt, inc a), fall past ret z, write latch");
  assert.deepEqual(m.calls, [0x6da6], "calls loc_6da6 only");
  assert.equal(m.regs.a, 0x01, "A overwritten by ld a,0x01 before the latch write");
  assert.equal(m.mem.read8(0x89e7), 0x01, "A(0x40)!=C(0x20) -> latch written");
  assert.equal(m.pc, CALLER_RET, "ret popped the seated caller");
  assert.equal(m.regs.sp, SP_BASE, "stack balanced");
});

test("loc_1d9c MUTATION: `ld a,(0x8907)` mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1d9f ? 7 : cycles);
  seatCaller(m);
  m.mem.write8(0x8907, 0x00); // path B

  loc_1d9c(m);

  assert.equal(m.tstates, 49, "mutation loses 6 T (13 -> 7): 55 -> 49");
});
