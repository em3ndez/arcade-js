// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_6505 (ROM 0x6505, Pooyan) -- rst-0x28 index-0 handler. Seeds
 * 0x8929=0x1c and 0x892b=0x08, then runs a fixed B=3 djnz loop: each pass swaps to the alt bank,
 * calls loc_6523, swaps back, bumps (ix+0x02), and steps IX by -0x18. After the loop it calls
 * loc_0f88 and rets. B is a routine constant, so there is a single control-flow path (the djnz
 * taken twice and not-taken once all occur within it).
 *
 * The mock's `call` POPS the return the call site pushed (modelling the callee's `ret`); a call site
 * missing its push16 desyncs the stack. Run: node --test games/pooyan/translated/test/loc_6505.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6505 } from "../loc_6505.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6505, pcSeq: [],
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

const GOLDEN = (10 + 10 + 10 + 7 + 7 + 10) // setup
  + 2 * (4 + 17 + 4 + 23 + 15 + 13)        // two full loop passes (djnz taken)
  + (4 + 17 + 4 + 23 + 15 + 8)             // last pass (djnz not taken)
  + (17 + 10);                             // call loc_0f88 + ret

test("loc_6505 Path: B=3 loop, three loc_6523 calls, loc_0f88, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8c78;

  loc_6505(m);

  assert.equal(m.tstates, GOLDEN, "full-path T-state total");
  assert.deepEqual(m.pcSeq, [
    0x6508, 0x650a, 0x650d, 0x650f, 0x6511, 0x6513,
    0x6514, 0x6523, 0x6518, 0x651b, 0x651d, 0x6513,
    0x6514, 0x6523, 0x6518, 0x651b, 0x651d, 0x6513,
    0x6514, 0x6523, 0x6518, 0x651b, 0x651d, 0x651f,
    0x0f88, CALLER_RET,
  ], "setup, three loop passes, tail call, ret");
  assert.equal(m.pc, CALLER_RET, "ret to the seated caller");
  assert.deepEqual(m.calls, [0x6523, 0x6523, 0x6523, 0x0f88]);
  assert.equal(m.mem.read8(0x8929), 0x1c, "0x8929 seeded 0x1c");
  assert.equal(m.mem.read8(0x892b), 0x08, "0x892b seeded 0x08");
  assert.equal(m.mem.read8(0x8c7a), 1, "(ix+2) bumped, pass 1");
  assert.equal(m.mem.read8(0x8c62), 1, "(ix+2) bumped, pass 2");
  assert.equal(m.mem.read8(0x8c4a), 1, "(ix+2) bumped, pass 3");
  assert.equal(m.regs.ix, 0x8c30, "IX -= 0x18 three times");
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_6505 MUTATION: the 0x6508 step mis-charged 9T (not 10T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x6508 ? 9 : cycles);
  seatCaller(m);
  m.regs.ix = 0x8c78;

  loc_6505(m);

  assert.equal(m.tstates, GOLDEN - 1, "mutation loses 1 T");
  assert.throws(() => assert.equal(m.tstates, GOLDEN, "full-path T-state total"), /full-path/);
});
