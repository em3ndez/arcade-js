// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_6666 (ROM 0x6666, Pooyan) -- rst-0x28 index-2 handler. Runs a
 * fixed B=3 djnz loop: each pass swaps to the alt bank, calls loc_667c, swaps back, and steps IX by
 * -0x18. After the loop it loads IX=0x8c78 and calls loc_66a1, then rets. B is a routine constant,
 * so there is a single control-flow path (djnz taken twice and not-taken once all occur within it).
 *
 * The mock's `call` POPS the return the call site pushed (modelling the callee's `ret`); a call site
 * missing its push16 desyncs the stack. Run: node --test games/pooyan/translated/test/loc_6666.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6666 } from "../loc_6666.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6666, pcSeq: [],
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

const GOLDEN = (10 + 7)              // setup
  + 2 * (4 + 17 + 4 + 15 + 13)       // two full loop passes (djnz taken)
  + (4 + 17 + 4 + 15 + 8)            // last pass (djnz not taken)
  + (14 + 17 + 10);                  // ld ix + call loc_66a1 + ret

test("loc_6666 Path: B=3 loop, three loc_667c calls, loc_66a1, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8ae0;

  loc_6666(m);

  assert.equal(m.tstates, GOLDEN, "full-path T-state total");
  assert.deepEqual(m.pcSeq, [
    0x6669, 0x666b,
    0x666c, 0x667c, 0x6670, 0x6672, 0x666b,
    0x666c, 0x667c, 0x6670, 0x6672, 0x666b,
    0x666c, 0x667c, 0x6670, 0x6672, 0x6674,
    0x6678, 0x66a1, CALLER_RET,
  ], "setup, three loop passes, ld ix, tail call, ret");
  assert.equal(m.pc, CALLER_RET, "ret to the seated caller");
  assert.deepEqual(m.calls, [0x667c, 0x667c, 0x667c, 0x66a1]);
  assert.equal(m.regs.ix, 0x8c78, "IX reloaded 0x8c78 before the loc_66a1 call");
  assert.equal(m.regs.de, 0xffe8, "DE stride preserved across the exx pairs");
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_6666 MUTATION: the 0x6669 step mis-charged 9T (not 10T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x6669 ? 9 : cycles);
  seatCaller(m);
  m.regs.ix = 0x8ae0;

  loc_6666(m);

  assert.equal(m.tstates, GOLDEN - 1, "mutation loses 1 T");
  assert.throws(() => assert.equal(m.tstates, GOLDEN, "full-path T-state total"), /full-path/);
});
