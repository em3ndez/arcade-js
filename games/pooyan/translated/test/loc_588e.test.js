// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_588e (ROM 0x588e, Pooyan) -- the per-eagle init loop: for each of
 * B sprite blocks, call loc_572b (E=0x04) then advance IX by 0x18. The mock's `call` POPS the return
 * address the call site pushed (modelling loc_572b's `ret`); a missing push16 then desyncs SP and the
 * final `ret` returns to the wrong place -- the stack tooth. Two cases: B=2 full loop (pcSeq + T=129),
 * and B=1 single pass. MUTATION: mis-charge `add ix,de` (15 T) as 11 T -> the golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_588e.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_588e } from "../loc_588e.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x588e, pcSeq: [],
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
    // loc_572b's `ret` pops the return address the call site pushed -- model that pop so a missing
    // push16 desyncs the stack. loc_572b's register effect on loc_588e is nil (IX is advanced here).
    call(addr) { this.calls.push(addr); this.pc = this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_588e B=2: two blocks initialised, IX advances by 0x18 each", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x02;
  m.regs.ix = 0x8ae0;

  loc_588e(m);

  assert.equal(m.tstates, 129, "B=2 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x5890, 0x572b, 0x5896, 0x5898, 0x588e, // iter1, djnz taken
    0x5890, 0x572b, 0x5896, 0x5898, 0x589a, // iter2, djnz falls out
    CALLER_RET,
  ], "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "ret to the seated caller");
  assert.deepEqual(m.calls, [0x572b, 0x572b], "loc_572b once per block");
  assert.equal(m.regs.ix, 0x8b10, "IX advanced 2*0x18 from 0x8ae0");
  assert.equal(m.regs.de, 0x0018, "DE = 0x18 stride from the last ld de,0x0018");
  assert.equal(m.regs.b, 0x00, "B counted down to 0");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (every push16 matched loc_572b's ret)");
});

test("loc_588e B=1: single block, djnz falls out immediately", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x01;
  m.regs.ix = 0x8ae0;

  loc_588e(m);

  assert.equal(m.tstates, 7 + 17 + 10 + 15 + 8 + 10, "B=1 T-state total");
  assert.deepEqual(m.pcSeq, [0x5890, 0x572b, 0x5896, 0x5898, 0x589a, CALLER_RET]);
  assert.equal(m.regs.ix, 0x8af8, "IX advanced one 0x18 stride");
  assert.deepEqual(m.calls, [0x572b]);
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
});

test("loc_588e MUTATION: `add ix,de` mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5898 ? 11 : cycles);
  seatCaller(m);
  m.regs.b = 0x02;
  m.regs.ix = 0x8ae0;

  loc_588e(m);

  assert.equal(m.tstates, 121, "mutation loses 4 T per iter * 2 = 8 T");
  assert.throws(
    () => assert.equal(m.tstates, 129, "B=2 T-state total"),
    /129/,
    "the 129-T golden must fail on the mutant",
  );
});
