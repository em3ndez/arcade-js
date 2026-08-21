// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_683a (ROM 0x683a, Pooyan). Advances an object record to its next
 * state: bumps (ix+0x02), zeros (ix+0x03)/(ix+0x05) via xor a, seats (ix+0x04)=0x08 and (ix+0x06)=
 * 0x1e, calls loc_381e with DE=0x68ef, seats (ix+0x09)=0x18, and rets. Straight-line -- one path.
 *
 * The mock's `call` POPS the return the call site pushed (modelling the callee's `ret`); a call site
 * missing its push16 desyncs the stack. Run: node --test games/pooyan/translated/test/loc_683a.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_683a } from "../loc_683a.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x683a, pcSeq: [],
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

const GOLDEN = 23 + 4 + 19 + 19 + 19 + 19 + 10 + 17 + 19 + 10;

test("loc_683a Path: state-advance writes, loc_381e call, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8ae0;

  loc_683a(m);

  assert.equal(m.tstates, GOLDEN, "straight-line T-state total");
  assert.deepEqual(m.pcSeq, [
    0x683d, 0x683e, 0x6841, 0x6844, 0x6848, 0x684c, 0x684f, 0x381e, 0x6856, CALLER_RET,
  ], "straight-line, call loc_381e, ret to caller");
  assert.equal(m.pc, CALLER_RET, "ret to the seated caller");
  assert.deepEqual(m.calls, [0x381e]);
  assert.equal(m.mem.read8(0x8ae2), 1, "(ix+0x02) bumped 0 -> 1");
  assert.equal(m.mem.read8(0x8ae3), 0, "(ix+0x03) zeroed by xor a");
  assert.equal(m.mem.read8(0x8ae5), 0, "(ix+0x05) zeroed by xor a");
  assert.equal(m.mem.read8(0x8ae4), 0x08, "(ix+0x04) = 0x08");
  assert.equal(m.mem.read8(0x8ae6), 0x1e, "(ix+0x06) = 0x1e");
  assert.equal(m.mem.read8(0x8ae9), 0x18, "(ix+0x09) = 0x18");
  assert.equal(m.regs.de, 0x68ef, "DE = 0x68ef param block");
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_683a MUTATION: the 0x683d step mis-charged 22T (not 23T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x683d ? 22 : cycles);
  seatCaller(m);
  m.regs.ix = 0x8ae0;

  loc_683a(m);

  assert.equal(m.tstates, GOLDEN - 1, "mutation loses 1 T");
  assert.throws(() => assert.equal(m.tstates, GOLDEN, "straight-line T-state total"), /straight-line/);
});
