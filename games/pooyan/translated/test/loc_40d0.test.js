// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for translated loc_40d0 (ROM 0x40d0, Pooyan) -- the IX-object state dispatcher.
 * Two `ret nc` gates guard a rst-0x28 tail dispatch: (ix+0)|(ix+1) must be even (bit0 clear) and the
 * state (ix+2)&0x1f must be < 0x11, else return; otherwise rst 0x28 pushes the inline table base 0x40e1
 * and dispatches through loc_0028.
 *
 * Paths: INACTIVE (OR odd... no -- OR bit0=0 -> rrca carry clear -> ret nc #1 taken), OUTOFRANGE
 * (OR odd -> #1 falls through; state 0x15 >= 0x11 -> ret nc #2 taken), DISPATCH (OR odd, state 0x05 <
 * 0x11 -> rst 0x28). The mock's `call` does NOT pop for 0x0028 (loc_0028 consumes the pushed table
 * base via its own `pop hl`, not a `ret`) -- so DISPATCH asserts the table base sits on top of the
 * stack, which a missing push16 at the rst site would break. T-STATE TOOTH: mis-charge `or (ix+1)`.
 *
 * Run: node --test games/pooyan/translated/test/loc_40d0.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_40d0 } from "../loc_40d0.js";

const CALLER_RET = 0xabcd;
const IXB = 0x8b00;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x40d0, pcSeq: [],
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
    // rst 0x28 -> loc_0028: the trampoline `pop hl`s the pushed table base and `jp (hl)`s away; it does
    // NOT `ret`, so the mock must not pop for 0x0028 (the base stays on the stack for the DISPATCH tooth).
    call(addr) { this.calls.push(addr); if (addr !== 0x0028) this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.ix = IXB;
}

test("loc_40d0 INACTIVE: (ix+0)|(ix+1) even -> ret nc #1", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IXB + 0x00, 0x02);
  m.mem.write8(IXB + 0x01, 0x04); // OR = 0x06, bit0 clear -> rrca carry clear -> ret nc taken

  loc_40d0(m);

  assert.equal(m.tstates, 19 + 19 + 4 + 11, "ld + or + rrca + ret nc taken");
  assert.deepEqual(m.pcSeq, [0x40d3, 0x40d6, 0x40d7, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret nc #1 to seated caller");
  assert.deepEqual(m.calls, [], "no dispatch");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_40d0 OUTOFRANGE: OR odd, state 0x15 >= 0x11 -> ret nc #2", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IXB + 0x00, 0x01); // OR bit0 set -> rrca carry set -> ret nc #1 NOT taken
  m.mem.write8(IXB + 0x01, 0x00);
  m.mem.write8(IXB + 0x02, 0x15); // & 0x1f = 0x15; cp 0x11 -> carry clear -> ret nc #2 taken

  loc_40d0(m);

  assert.equal(m.tstates, 19 + 19 + 4 + 5 + 19 + 7 + 7 + 11, "both gates evaluated, ret nc #2 taken");
  assert.deepEqual(m.pcSeq, [0x40d3, 0x40d6, 0x40d7, 0x40d8, 0x40db, 0x40dd, 0x40df, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret nc #2 to seated caller");
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_40d0 DISPATCH: OR odd, state 0x05 < 0x11 -> rst 0x28 tail dispatch", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IXB + 0x00, 0x01); // OR bit0 set -> ret nc #1 NOT taken
  m.mem.write8(IXB + 0x01, 0x00);
  m.mem.write8(IXB + 0x02, 0x05); // & 0x1f = 0x05; cp 0x11 -> carry set -> ret nc #2 NOT taken

  loc_40d0(m);

  assert.equal(m.tstates, 19 + 19 + 4 + 5 + 19 + 7 + 7 + 5 + 11, "both gates fall through, rst 0x28");
  assert.deepEqual(m.pcSeq, [0x40d3, 0x40d6, 0x40d7, 0x40d8, 0x40db, 0x40dd, 0x40df, 0x40e0, 0x0028]);
  assert.equal(m.pc, 0x0028, "rst 0x28 transfers to the trampoline");
  assert.deepEqual(m.calls, [0x0028], "single dispatch to loc_0028");
  assert.equal(m.regs.a, 0x05, "A = state index for the jump-table dispatch");
  // STACK TOOTH: the rst pushed the inline table base 0x40e1 and loc_0028 has not yet popped it,
  // so it sits on top with the seated CALLER_RET directly below. A missing push16 breaks this.
  assert.equal(m.regs.sp, 0x877c, "SP = seat - 2 (table base pushed, not yet consumed)");
  assert.equal(m.mem.read16(m.regs.sp), 0x40e1, "inline table base on top of the stack");
  assert.equal(m.mem.read16((m.regs.sp + 2) & 0xffff), CALLER_RET, "seated caller return below the base");
});

test("loc_40d0 MUTATION: `or (ix+1)` mis-charged 7T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x40d6 ? 7 : cycles);
  seatCaller(m);
  m.mem.write8(IXB + 0x00, 0x01);
  m.mem.write8(IXB + 0x01, 0x00);
  m.mem.write8(IXB + 0x02, 0x05);

  loc_40d0(m);

  assert.equal(m.tstates, 96 - 12, "mutation loses 12 T (19 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 96, "DISPATCH T-state total"),
    /96/,
    "the 96-T golden must fail on the mutant",
  );
});
