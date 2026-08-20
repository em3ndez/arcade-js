// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_6018 (ROM 0x6018, Pooyan) -- the advance + djnz-back latch of the
 * 6-slot overlap scan. Steps IX by 4 / HL by 0x18, decrements the slot counter B, and either
 * tail-jumps loc_5fa2's entry (more slots) or rets to loc_5fa2's caller (B spent).
 *
 * The mock's `call` POPS the return address the seat pushed (modelling the tail callee's `ret`), so a
 * mis-modelled tail transfer desyncs SP and the pre-seat-baseline tooth fires.
 *
 * Path LOOP (B=2 -> B=1, jp nz taken): tail-jumps loc_5fa2; pcSeq visits 0x5fa2; SP unwinds to baseline.
 * Path DONE (B=1 -> B=0, jp nz not taken): ret to the seated caller.
 * TEETH: mis-charge `add ix,de` (15 T) as 11 T -> the golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_6018.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6018 } from "../loc_6018.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6018, pcSeq: [],
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
    // The tail callee's `ret` pops whatever the caller frame held; model that pop so a mis-modelled
    // tail transfer (or a stray push) leaves SP off the baseline and fails the stack tooth.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_6018 Path LOOP: B=2 -> jp nz taken -> tail-jump loc_5fa2", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x02;
  m.regs.ix = 0x8850;
  m.regs.hl = 0x8ae0;

  loc_6018(m);

  assert.equal(m.tstates, 10 + 15 + 7 + 11 + 4 + 10, "Path LOOP T-state total");
  assert.deepEqual(m.pcSeq, [0x601b, 0x601d, 0x601f, 0x6020, 0x6021, 0x5fa2]);
  assert.equal(m.pc, 0x5fa2, "tail jp lands on loc_5fa2");
  assert.deepEqual(m.calls, [0x5fa2]);
  assert.equal(m.regs.ix, 0x8854, "IX += 4");
  assert.equal(m.regs.hl, 0x8af8, "HL += 0x18");
  assert.equal(m.regs.b, 0x01, "B decremented");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline (tail callee ret consumed CALLER_RET)");
});

test("loc_6018 Path DONE: B=1 -> jp nz not taken -> ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x01;
  m.regs.ix = 0x8850;
  m.regs.hl = 0x8ae0;

  loc_6018(m);

  assert.equal(m.tstates, 10 + 15 + 7 + 11 + 4 + 10 + 10, "Path DONE T-state total");
  assert.deepEqual(m.pcSeq, [0x601b, 0x601d, 0x601f, 0x6020, 0x6021, 0x6024, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret to the seated caller");
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.b, 0x00, "B decremented to zero");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_6018 MUTATION: `add ix,de` mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x601d ? 11 : cycles);
  seatCaller(m);
  m.regs.b = 0x02;
  m.regs.ix = 0x8850;
  m.regs.hl = 0x8ae0;

  loc_6018(m);

  assert.equal(m.tstates, 53, "mutation loses 4 T (15 -> 11)");
  assert.throws(
    () => assert.equal(m.tstates, 57, "Path LOOP T-state total"),
    /57/,
    "the 57-T golden must fail on the mutant",
  );
});
