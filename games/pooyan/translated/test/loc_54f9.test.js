// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_54f9 (ROM 0x54f9, Pooyan) -- spawn-slot scan loop over B actor blocks
 * at IX (stride DE). Per slot: exx to the scan set, test (ix+0)|(ix+1); non-zero = live slot (advance IX,
 * djnz), zero = free slot -> pick a type word from table 0x5637 (index 0x8d12&0x0f via rst 0x20), store to
 * (ix+0x17), and call loc_5489. loc_5489 ends `pop af; ret`, so it skip-returns TWO levels -- one spawn
 * per entry, control returns to loc_54f9's CALLER (never to 0x5513).
 *
 * The mock's `call` POPS: rst 0x20 (0x0020) pops its pushed return then does HL += A; A = (HL). loc_5489
 * pops the pushed 0x5513 (its `pop af`) and then the caller return (its `ret`), landing pc past loc_54f9.
 * A missing push16 before the call desyncs the stack -> loc_5489 pops the wrong slots and pc/sp fail.
 *
 * Cases: B=1 live slot -> ret; B=1 free slot -> rst 0x20 + skip-return; B=2 live-then-free -> djnz taken +
 * spawn on the second slot. TEETH: mis-charge `add ix,de` (15 T) as 11 T -> the 91-T golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_54f9.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_54f9 } from "../loc_54f9.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x54f9, pcSeq: [],
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
    call(addr) {
      this.calls.push(addr);
      if (addr === 0x0020) {                 // rst 0x20: pop the pushed return, then HL += A; A = (HL)
        this.pop16();
        const idx = (regs.hl + regs.a) & 0xffff;
        regs.hl = idx;
        regs.a = mem.read8(idx);
        return undefined;
      }
      if (addr === 0x5489) {                 // pop af drops the pushed 0x5513; ret pops the caller return
        this.pop16();
        this.pc = this.pop16();              // skip-return -- callee-internal, not counted in pcSeq/T
        return undefined;
      }
      this.pop16();
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_54f9 Test 1: B=1, live slot -> advance + ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x01;
  m.regs.de = 0x0018;
  m.regs.ix = 0x8c30;
  m.mem.write8(0x8c30, 0x01);   // (ix+0)|(ix+1) != 0 -> live slot -> jr nz taken

  loc_54f9(m);

  assert.equal(m.tstates, 91, "Test 1 T total");
  assert.deepEqual(m.pcSeq, [0x54fa, 0x54fd, 0x5500, 0x5513, 0x5514, 0x5516, 0x5518, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "own ret to the seated caller");
  assert.deepEqual(m.calls, [], "no spawn -- slot was live");
  assert.equal(m.regs.ix, 0x8c48, "IX advanced by stride");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound");
});

test("loc_54f9 Test 2: B=1, free slot -> rst 0x20 + loc_5489 skip-return", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x01;
  m.regs.de = 0x0018;
  m.regs.ix = 0x8c30;
  m.mem.write8(0x8c30, 0x00);   // free slot
  m.mem.write8(0x8c31, 0x00);
  m.mem.write8(0x8d12, 0x02);   // table index (& 0x0f)
  m.mem.write8(0x5639, 0x77);   // table[0x5637 + 2] -> type word

  loc_54f9(m);

  assert.equal(m.tstates, 133, "Test 2 T total");
  assert.deepEqual(m.pcSeq, [
    0x54fa, 0x54fd, 0x5500, 0x5502, 0x5504, 0x5507, 0x550a, 0x550c, 0x0020, 0x5510, 0x5489,
  ], "free slot: rst 0x20 lookup then skip-returning loc_5489");
  assert.equal(m.pc, CALLER_RET, "loc_5489 skip-returns two levels to loc_54f9's caller");
  assert.deepEqual(m.calls, [0x0020, 0x5489]);
  assert.equal(m.mem.read8(0x8c47), 0x77, "type word stored to (ix+0x17)");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (0x5513 + CALLER_RET both popped by loc_5489)");
});

test("loc_54f9 Test 3: B=2, live then free -> djnz taken + spawn on slot 1", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x02;
  m.regs.de = 0x0018;
  m.regs.ix = 0x8c30;
  m.mem.write8(0x8c30, 0x01);   // slot 0 live
  m.mem.write8(0x8c48, 0x00);   // slot 1 free
  m.mem.write8(0x8c49, 0x00);
  m.mem.write8(0x8d12, 0x02);
  m.mem.write8(0x5639, 0x77);

  loc_54f9(m);

  assert.equal(m.tstates, 219, "Test 3 T total (86 live iter + 133 spawn iter)");
  assert.deepEqual(m.pcSeq, [
    0x54fa, 0x54fd, 0x5500, 0x5513, 0x5514, 0x5516, 0x54f9,                     // iter1 live + djnz taken
    0x54fa, 0x54fd, 0x5500, 0x5502, 0x5504, 0x5507, 0x550a, 0x550c, 0x0020, 0x5510, 0x5489, // iter2 spawn
  ]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x0020, 0x5489]);
  assert.equal(m.mem.read8(0x8c5f), 0x77, "type word stored to slot-1 (ix+0x17)");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_54f9 MUTATION: `add ix,de` mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5516 ? 11 : cycles);
  seatCaller(m);
  m.regs.b = 0x01;
  m.regs.de = 0x0018;
  m.regs.ix = 0x8c30;
  m.mem.write8(0x8c30, 0x01);

  loc_54f9(m);

  assert.equal(m.tstates, 87, "mutation loses 4 T (15 -> 11)");
  assert.throws(() => assert.equal(m.tstates, 91, "golden"), /91/, "the 91-T golden must fail on the mutant");
});
