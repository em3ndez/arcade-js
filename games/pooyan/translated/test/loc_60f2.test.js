// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_60f2 (ROM 0x60f2, Pooyan) -- the shared outer-loop epilogue of
 * the 0x6069 sprite/collision scan. Advance IX += 4 / HL += 0x18, dec B; while B != 0 tail-jp back
 * to the loop head 0x6069, else ret.
 *
 * The mock's `call` POPS the return address (models the callee's `ret`); the routine's only control
 * transfer is a TAIL jp (no push16 of its own), so the tail m.call(0x6069) consumes the seated
 * CALLER_RET and the stack unwinds to the pre-seat baseline -- the stack-fidelity tooth.
 *
 * Path LOOP (B=2 -> 1, nz): tail-jp to 0x6069, T=57, pcSeq ends at 0x6069, SP back to baseline.
 * Path RET  (B=1 -> 0, z):  jp not taken, ret at 0x60fe, T=67, pc = seated caller.
 * TOOTH/POSITIVE CONTROL: this routine has no push16 to delete, so the control is a T-state
 * mutation -- mis-charge `add ix,de` as 11T (not 15T) and confirm the 57-T golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_60f2.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_60f2 } from "../loc_60f2.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x60f2, pcSeq: [],
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
    // The callee's `ret` pops the return address the transfer seated. loc_60f2 pushes nothing (its
    // only transfer is a tail jp), so the tail m.call(0x6069) pops the seated CALLER_RET here.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_60f2 Path LOOP: B>1 -> advance pointers, tail-jp back to 0x6069", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x02;
  m.regs.ix = 0x8c90;
  m.regs.hl = 0x8b70;

  loc_60f2(m);

  assert.equal(m.tstates, 57, "Path LOOP T-state total (10+15+7+11+4+10)");
  assert.deepEqual(m.pcSeq, [0x60f5, 0x60f7, 0x60f9, 0x60fa, 0x60fb, 0x6069],
    "step boundaries; tail jp visits the loop head 0x6069");
  assert.equal(m.pc, 0x6069, "tail jp lands on 0x6069");
  assert.deepEqual(m.calls, [0x6069], "tail to the loop head");
  assert.equal(m.regs.ix, 0x8c94, "IX += 4");
  assert.equal(m.regs.hl, 0x8b88, "HL += 0x18");
  assert.equal(m.regs.de, 0x0018, "DE = 0x0004 then ld e,0x18");
  assert.equal(m.regs.b, 0x01, "B decremented to 1");
  // Tail jp: loc_6069's ret pops the seated CALLER_RET, so the stack unwinds to baseline.
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline (tail call consumed CALLER_RET)");
});

test("loc_60f2 Path RET: B==1 -> B falls to 0, ret at 0x60fe", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x01;
  m.regs.ix = 0x8c90;
  m.regs.hl = 0x8b70;

  loc_60f2(m);

  assert.equal(m.tstates, 67, "Path RET T-state total (10+15+7+11+4+10+10)");
  assert.deepEqual(m.pcSeq, [0x60f5, 0x60f7, 0x60f9, 0x60fa, 0x60fb, 0x60fe, CALLER_RET],
    "jp nz not taken -> fall to 0x60fe -> ret to seated caller");
  assert.equal(m.pc, CALLER_RET, "ret at 0x60fe returns to the seated caller");
  assert.deepEqual(m.calls, [], "no tail -- B reached 0");
  assert.equal(m.regs.ix, 0x8c94, "IX += 4");
  assert.equal(m.regs.hl, 0x8b88, "HL += 0x18");
  assert.equal(m.regs.b, 0x00, "B decremented to 0");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline (ret consumed CALLER_RET)");
});

test("loc_60f2 MUTATION: `add ix,de` mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x60f7 ? 11 : cycles);
  seatCaller(m);
  m.regs.b = 0x02;
  m.regs.ix = 0x8c90;
  m.regs.hl = 0x8b70;

  loc_60f2(m);

  assert.equal(m.tstates, 53, "mutation loses 4 T (15 -> 11)");
  assert.throws(
    () => assert.equal(m.tstates, 57, "Path LOOP T-state total"),
    /57/,
    "the 57-T golden must fail on the mutant",
  );
});
