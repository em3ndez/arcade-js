// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_6a98 (ROM 0x6a98, Pooyan) -- per-object state handler. Inactive
 * slots ((ix+1)==0) ret immediately; otherwise it computes the selector ((ix+2)-1 & 3) and tail-
 * dispatches through the rst-0x28 trampoline (loc_0028) into the inline table at 0x6aa4.
 *
 * The mock's `call` POPS the pushed return (models the callee ret) = the stack tooth. For the tail
 * rst-0x28, the machine pushes the inline table base 0x6aa4 and the loc_0028 seam pops it; the
 * caller's own return stays seated (the dispatched handler, not loc_6a98, consumes it), so SP lands
 * one word BELOW the pre-seat baseline. Paths cover the inactive ret-z exit and the dispatch with
 * both selector 0 and selector 1; plus a ld-a,(ix+d) T-state mutation. regs.a pins the selector.
 *
 * Run: node --test games/pooyan/translated/test/loc_6a98.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6a98 } from "../loc_6a98.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6a98, pcSeq: [],
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
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_6a98 Path A: inactive slot ((ix+1)==0) -> ret z", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x9001, 0x00); // (ix+1) == 0

  loc_6a98(m);

  assert.equal(m.tstates, 34, "Path A T-state total");
  assert.deepEqual(m.pcSeq, [0x6a9b, 0x6a9c, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780, "ret z consumed the caller return -> baseline");
});

test("loc_6a98 Path B: active, state 2 -> selector 1 -> rst 0x28 tail dispatch", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x9001, 0x01); // active
  m.mem.write8(0x9002, 0x02); // state -> selector (2-1)&3 = 1 (table[1] = 0x67df)

  loc_6a98(m);

  assert.equal(m.tstates, 69, "Path B T-state total");
  assert.deepEqual(m.pcSeq, [0x6a9b, 0x6a9c, 0x6a9d, 0x6aa0, 0x6aa1, 0x6aa3, 0x0028]);
  assert.equal(m.pc, 0x0028);
  assert.deepEqual(m.calls, [0x0028]);
  assert.equal(m.regs.a, 0x01, "dispatch selector = (state-1) & 3");
  assert.equal(m.regs.sp, 0x877e, "table base popped; caller return still seated (tail)");
});

test("loc_6a98 Path C: active, state 1 -> selector 0 (table[0] = 0x6aa8)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x9001, 0x01);
  m.mem.write8(0x9002, 0x01); // state -> selector (1-1)&3 = 0

  loc_6a98(m);

  assert.equal(m.tstates, 69, "Path C T-state total");
  assert.deepEqual(m.pcSeq, [0x6a9b, 0x6a9c, 0x6a9d, 0x6aa0, 0x6aa1, 0x6aa3, 0x0028]);
  assert.deepEqual(m.calls, [0x0028]);
  assert.equal(m.regs.a, 0x00, "dispatch selector = 0");
  assert.equal(m.regs.sp, 0x877e, "tail dispatch stack shape");
});

test("loc_6a98 MUTATION: ld a,(ix+1) mis-charged 13T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x6a9b ? 13 : cycles);
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x9001, 0x01);
  m.mem.write8(0x9002, 0x02);

  loc_6a98(m);

  assert.equal(m.tstates, 63, "mutation loses 6 T");
  assert.throws(() => assert.equal(m.tstates, 69, "Path B T-state total"), /Path B/);
});
