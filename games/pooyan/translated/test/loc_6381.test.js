// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_6381 (ROM 0x6381, Pooyan) -- the scan setup: seed IX=0x887c,
 * B=3, HL=0x8be8, then fall through into loc_638a. The fall-through is a tail hand-off (no jump
 * instruction: the last ld's step lands on 0x638a, then m.call reuses the caller frame).
 *
 * The mock's `call` POPS (models loc_638a's eventual ret consuming the seated return). No push16
 * of its own, so the positive control is a T-state mutation: mis-charge ld ix,nn (14 -> 10) and
 * the 31-T golden must throw.
 *
 * Run: node --test games/pooyan/translated/test/loc_6381.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6381 } from "../loc_6381.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6381, pcSeq: [],
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
    // fall-through tail: loc_638a's ret pops the seated CALLER_RET (loc_6381 pushed nothing).
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_6381: seed IX/B/HL then fall through into loc_638a", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_6381(m);

  assert.equal(m.tstates, 31, "T = ld ix (14) + ld b (7) + ld hl (10)");
  assert.deepEqual(m.pcSeq, [0x6385, 0x6387, 0x638a], "step boundaries match the ROM bytes");
  assert.equal(m.pc, 0x638a, "falls into loc_638a");
  assert.equal(m.regs.ix, 0x887c, "IX seeded");
  assert.equal(m.regs.b, 0x03, "B = 3 slots");
  assert.equal(m.regs.hl, 0x8be8, "HL seeded");
  assert.deepEqual(m.calls, [0x638a], "tail hand-off to loc_638a");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline (tail reuses the caller frame)");
});

test("loc_6381 MUTATION: ld ix,nn mis-charged 10T (not 14T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x6385 ? 10 : cycles);
  seatCaller(m);

  loc_6381(m);

  assert.equal(m.tstates, 27, "mutation loses 4 T (14 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 31, "T total"),
    /31/,
    "the 31-T golden must fail on the mutant",
  );
});
