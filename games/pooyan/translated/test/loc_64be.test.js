// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_64be (ROM 0x64be, Pooyan) -- terminator match-scan. Walks mem[DE]
 * (descending) against the table at (HL) (ascending): equal bytes advance; a differing byte (NZ)
 * bumps the counter at 0x8df9; a fetched table byte that decrements to zero ends the scan. Both
 * exits share the `pop af` / `ret` tail -- the pop DISCARDS the caller's return so control returns
 * to the caller's caller (skip-return). The mock seats TWO returns (PARENT + GRAND); `pop af`
 * drops PARENT and `ret` lands on GRAND, so the stack fully unwinds.
 *
 * Paths: MISMATCH (jr nz on byte 1 -> bump 0x8df9), and MATCH-then-TERMINATOR (one equal iteration
 * loops, the next hits a table byte == 1). TEETH: mis-charge `sub (hl)` (7 T) as 4 T -- the 67-T
 * golden catches it. POSITIVE CONTROL (pure leaf, no push16): the MUTATION test deletes 3 T and
 * confirms the golden throws; watched failing, then the real cost restores it.
 *
 * Run: node --test games/pooyan/translated/test/loc_64be.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_64be } from "../loc_64be.js";

const PARENT = 0xabcd; // dropped by `pop af`
const GRAND = 0x1234;  // the real return (skip-return)

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, tstates: 0, pc: 0x64be, pcSeq: [],
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
  };
}

function seat(m) {
  m.regs.sp = 0x8780;
  m.push16(GRAND);  // returned to by `ret`
  m.push16(PARENT); // discarded by `pop af`
}

test("loc_64be MISMATCH: first byte differs -> bump 0x8df9, skip-return", () => {
  const m = makeMachine();
  seat(m);
  m.regs.de = 0x9000;
  m.regs.hl = 0x9100;
  m.mem.write8(0x9000, 0x05);
  m.mem.write8(0x9100, 0x03);

  loc_64be(m);

  assert.equal(m.tstates, 67, "ld a,(de)7 + sub(hl)7 + jr nz12 + ld hl10 + inc(hl)11 + pop af10 + ret10");
  assert.deepEqual(m.pcSeq, [0x64bf, 0x64c0, 0x64ca, 0x64cd, 0x64ce, 0x64cf, GRAND], "mismatch path");
  assert.equal(m.mem.read8(0x8df9), 0x01, "mismatch counter bumped");
  assert.equal(m.pc, GRAND, "skip-return to caller's caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (pop af + ret consumed both seated words)");
});

test("loc_64be MATCH then TERMINATOR: equal byte loops, next table byte == 1 ends the scan", () => {
  const m = makeMachine();
  seat(m);
  m.regs.de = 0x9000;
  m.regs.hl = 0x9100;
  m.mem.write8(0x9000, 0x05);
  m.mem.write8(0x9100, 0x05); // iter1 equal
  m.mem.write8(0x9101, 0x07); // iter1 table byte (dec -> 0x06, not 1 -> loop); iter2 sub operand
  m.mem.write8(0x8fff, 0x07); // iter2 mem[de] (de walked to 0x8fff) equal to mem[0x9101]
  m.mem.write8(0x9102, 0x01); // iter2 table byte -> dec to 0 -> terminator

  loc_64be(m);

  assert.equal(m.tstates, 132, "iter1 loop (56) + iter2 terminator (76)");
  assert.deepEqual(m.pcSeq, [
    0x64bf, 0x64c0, 0x64c2, 0x64c3, 0x64c4, 0x64c5, 0x64c6, 0x64be, // iter1 equal -> loop
    0x64bf, 0x64c0, 0x64c2, 0x64c3, 0x64c4, 0x64c5, 0x64c6, 0x64ce, 0x64cf, GRAND, // iter2 terminator
  ], "loop then terminator path");
  assert.equal(m.mem.read8(0x8df9), 0x00, "no mismatch -> counter untouched");
  assert.equal(m.regs.de, 0x8ffe, "DE walked down twice");
  assert.equal(m.regs.hl, 0x9102, "HL walked up twice");
  assert.equal(m.pc, GRAND, "skip-return to caller's caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound");
});

test("loc_64be MUTATION: `sub (hl)` mis-charged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x64c0 ? 4 : cycles);
  seat(m);
  m.regs.de = 0x9000;
  m.regs.hl = 0x9100;
  m.mem.write8(0x9000, 0x05);
  m.mem.write8(0x9100, 0x03);

  loc_64be(m);

  assert.equal(m.tstates, 64, "mutation loses 3 T (7 -> 4)");
  assert.throws(() => assert.equal(m.tstates, 67, "golden"), /67/, "the 67-T golden must fail on the mutant");
});
