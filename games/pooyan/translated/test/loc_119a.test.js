// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_119a (ROM 0x119a, Pooyan) -- a spawned-actor initialiser. Returns
 * early (ret c) when the record is already active; otherwise seeds the IX record, queues an animation
 * (loc_381e), derives a facing byte + its negation and an attribute byte through two rst-0x20 table
 * lookups (loc_0020), and ends with `pop af; ret` -- a skip-return that DISCARDS its own caller's return
 * and returns one level higher.
 *
 * The mock's `call` POPS the pushed return (modelling each callee's `ret`); for the rst-0x20 handler it
 * also models loc_0020's effect (HL += A, then A = mem[HL]) since 119a reads A back. Because the routine
 * ends by popping the CALLER's return itself, the stack is seated TWO deep (grandparent below caller);
 * a missing push16 anywhere then makes the final ret land on the wrong frame -- the stack tooth.
 *
 * Run: node --test games/pooyan/translated/test/loc_119a.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_119a } from "../loc_119a.js";

const CALLER_RET = 0xabcd;      // the frame 119a discards via `pop af`
const GRANDPARENT_RET = 0x1234; // the frame 119a's `ret` actually returns to
const IX = 0x9000;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x119a, pcSeq: [],
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
    // Each callee's `ret` pops the return address the call site pushed -- model that pop so a missing
    // push16 desyncs the stack. loc_0020 (rst 0x20) additionally does HL += A then A = mem[HL]; loc_381e
    // writes only IX bytes 119a never reads back, so its mock is a bare pop.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x0020) {
        const sum = (regs.hl + regs.a) & 0xffff;
        regs.hl = sum;
        regs.a = mem.read8(sum);
      }
      return undefined;
    },
  };
}

function seatTwoDeep(m) {
  m.regs.sp = 0x8780;
  m.push16(GRANDPARENT_RET); // returned to after the skip
  m.push16(CALLER_RET);      // discarded by `pop af`
}

const PC_FULL = [
  // rst/call step to the TARGET; the pushed return address (0x11d1/0x11df/0x11ec) is never a step target,
  // so the next entry is the instruction AT that address (0x11d4/0x11e2/0x11ef).
  0x119d, 0x11a0, 0x11a1, 0x11a2, 0x11a3, 0x11a7, 0x11ab, 0x11ae, 0x11af, 0x11b2,
  0x11b5, 0x11b8, 0x11bb, 0x11bf, 0x11c2, 0x11c5, 0x11c8, 0x11ca, 0x11cc, 0x11ce,
  0x11d0, 0x0020, 0x11d4, 0x11d6, 0x11d9, 0x11dc, 0x381e, 0x11e2, 0x11e5, 0x11e7,
  0x11e9, 0x11eb, 0x0020, 0x11ef, 0x11f2, 0x11f3, 0x11f6, 0x11f7, 0x11f8, GRANDPARENT_RET,
];

function setupFull(m) {
  seatTwoDeep(m);
  m.regs.ix = IX;
  m.regs.c = 0x07;                            // -> B (internal, not stored)
  m.regs.e = 0x55;                            // -> (ix+4)
  m.mem.write8((IX + 0x00) & 0xffff, 0x00);   // id low
  m.mem.write8((IX + 0x01) & 0xffff, 0x00);   // id high -> OR bit0 clear -> ret c not taken
  m.mem.write8(0x8907, 0x00);                 // both lookups index 0
  m.mem.write8(0x1209, 0x03);                 // facing table[0]
  m.mem.write8(0x11f9, 0x50);                 // attribute table[0]
}

test("loc_119a FULL: inactive record -> seed + two lookups + skip-return to grandparent", () => {
  const m = makeMachine();
  setupFull(m);

  loc_119a(m);

  assert.equal(m.tstates, 495, "FULL T-state total");
  assert.deepEqual(m.pcSeq, PC_FULL, "step boundaries match the ROM bytes (rst/call visit the target)");
  assert.equal(m.pc, GRANDPARENT_RET, "skip-return: `ret` lands on the grandparent, not the caller");
  assert.deepEqual(m.calls, [0x0020, 0x381e, 0x0020], "two rst-0x20 lookups around one loc_381e call");
  // seeded state bytes
  assert.equal(m.mem.read8(IX + 0x00), 0x01, "(ix+0) = 1");
  assert.equal(m.mem.read8(IX + 0x02), 0x03, "(ix+2) = 3");
  assert.equal(m.mem.read8(IX + 0x04), 0x55, "(ix+4) = E");
  assert.equal(m.mem.read8(IX + 0x03), 0x00, "(ix+3) = 0");
  assert.equal(m.mem.read8(IX + 0x05), 0x00, "(ix+5) = 0");
  assert.equal(m.mem.read8(IX + 0x06), 0x00, "(ix+6) = 0");
  assert.equal(m.mem.read8(IX + 0x08), 0x00, "(ix+8) = 0");
  assert.equal(m.mem.read8(IX + 0x07), 0x01, "(ix+7) = 1");
  assert.equal(m.mem.read8(IX + 0x0b), 0x00, "(ix+0b) = 0");
  // lookups: facing = table[0] = 0x03, its neg = 0xfd, attribute = 0x50
  assert.equal(m.mem.read8(IX + 0x09), 0x03, "(ix+9) = facing table[0]");
  assert.equal(m.mem.read8(IX + 0x0a), 0xfd, "(ix+0a) = -facing");
  assert.equal(m.mem.read8(0x8d07), 0x50, "attribute stored");
  assert.equal(m.mem.read8(0x8f5f), 0x01, "0x8f5f bumped");
  assert.equal(m.mem.read8(0x8d40), 0x01, "0x8d40 bumped");
  // pop af discarded CALLER_RET, ret popped GRANDPARENT_RET -> both off the stack
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to the pre-seat baseline");
});

test("loc_119a ret c: record already active -> return to the immediate caller", () => {
  const m = makeMachine();
  seatTwoDeep(m);
  m.regs.ix = IX;
  m.mem.write8((IX + 0x00) & 0xffff, 0x01); // OR bit0 set -> rrca carry -> ret c

  loc_119a(m);

  assert.equal(m.tstates, 19 + 19 + 4 + 11, "ld + or + rrca + ret c");
  assert.deepEqual(m.pcSeq, [0x119d, 0x11a0, 0x11a1, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "early ret c returns to the immediate caller (no skip)");
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x877e, "only CALLER_RET popped; GRANDPARENT_RET still seated");
});

test("loc_119a MUTATION: `or (ix+1)` mis-charged 7T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x11a0 ? 7 : cycles);
  setupFull(m);

  loc_119a(m);

  assert.equal(m.tstates, 483, "mutation loses 12 T (19 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 495, "FULL T-state total"),
    /495/,
    "the 495-T golden must fail on the mutant",
  );
});
