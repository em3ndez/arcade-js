// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_425c (ROM 0x425c, Pooyan) -- interior-entry mirror of loc_4221.
 * Points DE at the 0x4203 animation script, sets the 0x8d4b mode flag to 0xff, then `jr 0x4241`
 * lands on loc_423a's `jp 0x381e` and TAIL-jumps to loc_381e (arm animation). pcSeq visits 0x4241
 * then 0x381e. Pure tail-jp leaf: no push16 of its own; the mock's `call` POPS to model loc_381e's
 * `ret`, so the seated CALLER_RET is consumed and SP unwinds to the pre-seat baseline -- the stack
 * tooth for a frame-reusing tail jp.
 *
 * TEETH: mis-charge the `jr 0x4241` (12 T) as 7 T -> the 52-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_425c.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_425c } from "../loc_425c.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x425c, pcSeq: [],
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
    // The tail callee loc_381e ends in `ret`, which pops the seated CALLER_RET -- model that pop so
    // the stack stays balanced (a stray push16 here would then leave SP off by 2 at the assert).
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_425c: arm 0x4203 script, set 0x8d4b=0xff, jr into tail jp 0x381e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d4b, 0x00); // pre-seed to prove the 0xff write lands

  loc_425c(m);

  assert.equal(m.tstates, 52, "T = ld de(10) + ld a,n(7) + ld (nn),a(13) + jr(12) + jp(10)");
  assert.deepEqual(m.pcSeq, [0x425f, 0x4261, 0x4264, 0x4241, 0x381e], "jr lands on 0x4241 then jp to 0x381e");
  assert.equal(m.pc, 0x381e, "tail jp lands on 0x381e");
  assert.deepEqual(m.calls, [0x381e], "one tail call to loc_381e");
  assert.equal(m.regs.de, 0x4203, "DE points at the 0x4203 animation script");
  assert.equal(m.regs.a, 0xff, "A = 0xff");
  assert.equal(m.mem.read8(0x8d4b), 0xff, "0x8d4b mode flag set to 0xff");
  // Pure tail jp: loc_381e's ret pops the seated CALLER_RET, so SP unwinds to the pre-seat baseline.
  assert.equal(m.regs.sp, 0x8780, "stack unwound to pre-seat baseline (tail callee ret consumed CALLER_RET)");
});

test("loc_425c MUTATION: `jr 0x4241` mis-charged 7T (not 12T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x4241 ? 7 : cycles);
  seatCaller(m);

  loc_425c(m);

  assert.equal(m.tstates, 47, "mutation loses 5 T (12 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 52, "Path T-state total"),
    /52/,
    "the 52-T golden must fail on the mutant",
  );
});
