// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_6190 (ROM 0x6190, Pooyan) -- seat (ix+0x08)=0x01 and (ix+0x0a)=0xd0
 * on the matched target record, then tail-jump loc_6166 (reset the actor record).
 *
 * loc_6190 has no real CALL (no push16): its single exit is the tail-jump `jr loc_6166`. The mock's
 * `call` POPS the seated CALLER_RET, modelling the tail chain returning to loc_6190's caller, so SP
 * unwinds to the pre-seat baseline. There is no push16 to delete, so the positive control is the
 * T-state mutation tooth below (mis-charge `ld (ix+8),n` 19 T as 7 T -> the 50-T golden fails).
 *
 * Run: node --test games/pooyan/translated/test/loc_6190.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6190 } from "../loc_6190.js";

const CALLER_RET = 0xabcd;
const IX = 0x8b70;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6190, pcSeq: [],
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
    // Tail-jump chain rets to loc_6190's caller -- model that single net pop of the seated CALLER_RET.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.ix = IX;
}

test("loc_6190: seat (ix+8)/(ix+0x0a) then tail-jump loc_6166", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_6190(m);

  assert.equal(m.tstates, 50, "T = 19 + 19 + 12 (ld(ix+8),n + ld(ix+0xa),n + jr)");
  assert.deepEqual(m.pcSeq, [0x6194, 0x6198, 0x6166]);
  assert.equal(m.pc, 0x6166, "jr tail-jumps loc_6166");
  assert.deepEqual(m.calls, [0x6166]);
  assert.equal(m.mem.read8(IX + 0x08), 0x01, "(ix+0x08) = 0x01");
  assert.equal(m.mem.read8(IX + 0x0a), 0xd0, "(ix+0x0a) = 0xd0");
  assert.equal(m.regs.sp, 0x8780, "tail chain unwound CALLER_RET to baseline");
});

test("loc_6190 MUTATION: `ld (ix+8),n` mis-charged 7T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x6194 ? 7 : cycles);
  seatCaller(m);

  loc_6190(m);

  assert.equal(m.tstates, 38, "mutation loses 12 T (19 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 50, "golden"),
    /50/,
    "the 50-T golden must fail on the mutant",
  );
});
