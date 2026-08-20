// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for translated loc_22b1 (Pooyan ROM 0x22b1-0x22cf) -- runs the animation stepper
 * loc_22e6 over four actor records (IX = 0x8a80, 0x8a98, 0x8ab0, 0x8ac8; stride 0x18). Gated on
 * (0x8d32)==0. loc_22e6 leaves IX/DE untouched, so the +0x18 stride add is re-applied between calls.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling loc_22e6's `ret`); a
 * missing push16 desyncs the stack and the closing `ret` misses CALLER_RET.
 *
 * Paths: GATE ((0x8d32)!=0 -> ret nz, 28 T); FULL (four loc_22e6 calls, IX ends 0x8ac8, 169 T).
 * TEETH: mis-charge `add ix,de` (DD 19 = 15 T) as 11 T; the 169-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_22b1.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_22b1 } from "../loc_22b1.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x22b1, pcSeq: [],
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
    // loc_22e6's `ret` pops the return address this call site pushed; it leaves IX/DE untouched.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_22b1 GATE: (0x8d32)!=0 -> ret nz immediately", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d32, 0x01);

  loc_22b1(m);

  assert.equal(m.tstates, 28, "GATE T = ld(13)+and(4)+ret nz(11)");
  assert.deepEqual(m.pcSeq, [0x22b4, 0x22b5, CALLER_RET]);
  assert.deepEqual(m.calls, [], "gate closed -- no stepper calls");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_22b1 FULL: (0x8d32)==0 -> four loc_22e6 calls over 0x8a80..0x8ac8", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d32, 0x00);

  loc_22b1(m);

  assert.equal(m.tstates, 169, "FULL T-state total");
  assert.deepEqual(m.pcSeq, [
    0x22b4, 0x22b5, 0x22b6, 0x22ba,
    0x22e6,          // call#1 -> target
    0x22c0, 0x22c2,  // ld de,0x18 ; add ix,de
    0x22e6,          // call#2
    0x22c7,          // add ix,de
    0x22e6,          // call#3
    0x22cc,          // add ix,de
    0x22e6,          // call#4
    CALLER_RET,
  ]);
  assert.deepEqual(m.calls, [0x22e6, 0x22e6, 0x22e6, 0x22e6], "one stepper call per record");
  assert.equal(m.regs.ix, 0x8ac8, "IX walked 3 strides to the 4th record");
  assert.equal(m.regs.de, 0x0018, "stride retained");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "every push16 matched a callee ret pop");
});

test("loc_22b1 MUTATION: `add ix,de` mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  let hit = false;
  m.step = (nextAddr, cycles) => {
    if (!hit && nextAddr === 0x22c2) { hit = true; return realStep(nextAddr, 11); }
    return realStep(nextAddr, cycles);
  };
  seatCaller(m);
  m.mem.write8(0x8d32, 0x00);

  loc_22b1(m);

  assert.equal(m.tstates, 165, "mutation loses 4 T (15 -> 11)");
  assert.throws(() => assert.equal(m.tstates, 169, "FULL T-state total"), /FULL/);
});
