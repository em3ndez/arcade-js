// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5b86 (ROM 0x5b86, Pooyan) -- calls loc_5b99 over the six
 * 0x18-byte objects at 0x8ae0, IX += 0x18 per object, B counting down from 6. The exx pair
 * parks B/DE in the alternate set across each call; the djnz 0x5b96 -> 0x5b8f latch is the
 * inlined loop body (0x5b8f is not an external entry).
 *
 * The mock's `call` POPS the return address the call site pushed (modelling loc_5b99's `ret`);
 * loc_5b86 does not read loc_5b99's register output (the exx pair restores B/DE), so pop-only is
 * faithful. A call site missing its push16 then desyncs the stack -- the balance assertion has teeth.
 * The single B=6 run exercises both djnz outcomes (taken x5, not-taken x1).
 * TEETH: mis-charge `add ix,de` (15 T) as 11 T -> the 354-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_5b86.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5b86 } from "../loc_5b86.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5b86, pcSeq: [],
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
    // loc_5b99's `ret` pops the return address the call site pushed -- model that pop so the stack
    // stays balanced (a missing push16 then desyncs SP and fails the balance tooth). loc_5b86 reads
    // none of loc_5b99's register output afterward (exx restores B/DE), so no register model needed.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

function expectedSeq() {
  const seq = [0x5b8a, 0x5b8d, 0x5b8f];
  for (let i = 0; i < 6; i++) {
    seq.push(0x5b90, 0x5b99, 0x5b94, 0x5b96);
    seq.push(i < 5 ? 0x5b8f : 0x5b98); // djnz taken x5, not-taken on the 6th
  }
  seq.push(CALLER_RET);
  return seq;
}

test("loc_5b86: six loc_5b99 passes over the 0x8ae0 table, IX += 0x18 each", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_5b86(m);

  assert.equal(m.tstates, 354, "T = 31 setup + 5*(40+13) + (40+8) + 10 ret");
  assert.deepEqual(m.pcSeq, expectedSeq(), "step boundaries (loop head visited each djnz)");
  assert.equal(m.pc, CALLER_RET, "ret to seated caller");
  assert.deepEqual(m.calls, [0x5b99, 0x5b99, 0x5b99, 0x5b99, 0x5b99, 0x5b99], "loc_5b99 called 6x");
  assert.equal(m.regs.ix, 0x8b70, "IX = 0x8ae0 + 6*0x18");
  assert.equal(m.regs.b, 0x00, "B counted down to 0");
  assert.equal(m.regs.de, 0x0018, "DE stride restored by the exx pair");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (every push16 matched a callee ret)");
});

test("loc_5b86 MUTATION: `add ix,de` mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5b96 ? 11 : cycles);
  seatCaller(m);

  loc_5b86(m);

  assert.equal(m.tstates, 354 - 6 * 4, "mutation loses 4 T per iteration (15 -> 11) x6");
  assert.throws(
    () => assert.equal(m.tstates, 354, "T-state total"),
    /354/,
    "the 354-T golden must fail on the mutant",
  );
});
