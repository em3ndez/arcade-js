// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_423a (ROM 0x423a, Pooyan) -- interior-entry mirror of loc_4221.
 * Points DE at the 0x4212 animation script, clears the 0x8d4b mode flag, then TAIL-jumps to loc_381e
 * (arm animation). Pure tail-jp leaf: no push16 of its own; the mock's `call` POPS to model loc_381e's
 * `ret`, so the seated CALLER_RET is consumed and SP unwinds to the pre-seat baseline -- the stack
 * tooth for a frame-reusing tail jp. A stray push16 (or a missing pop model) would leave SP off by 2.
 *
 * TEETH: mis-charge `ld (0x8d4b),a` (13 T) as 7 T -> the 37-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_423a.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_423a } from "../loc_423a.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x423a, pcSeq: [],
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

test("loc_423a: arm 0x4212 script, clear 0x8d4b, tail jp 0x381e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d4b, 0x5a); // pre-seed to prove the xor-a write clears it

  loc_423a(m);

  assert.equal(m.tstates, 37, "T = ld de(10) + xor a(4) + ld (nn),a(13) + jp(10)");
  assert.deepEqual(m.pcSeq, [0x423d, 0x423e, 0x4241, 0x381e], "step boundaries match ROM bytes");
  assert.equal(m.pc, 0x381e, "tail jp lands on 0x381e");
  assert.deepEqual(m.calls, [0x381e], "one tail call to loc_381e");
  assert.equal(m.regs.de, 0x4212, "DE points at the 0x4212 animation script");
  assert.equal(m.regs.a, 0x00, "xor a cleared A");
  assert.equal(m.mem.read8(0x8d4b), 0x00, "0x8d4b mode flag cleared");
  // Pure tail jp: loc_381e's ret pops the seated CALLER_RET, so SP unwinds to the pre-seat baseline.
  assert.equal(m.regs.sp, 0x8780, "stack unwound to pre-seat baseline (tail callee ret consumed CALLER_RET)");
});

test("loc_423a MUTATION: `ld (0x8d4b),a` mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x4241 ? 7 : cycles);
  seatCaller(m);

  loc_423a(m);

  assert.equal(m.tstates, 31, "mutation loses 6 T (13 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 37, "Path T-state total"),
    /37/,
    "the 37-T golden must fail on the mutant",
  );
});
