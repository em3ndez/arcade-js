// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_05b2 (ROM 0x05b2, Pooyan) -- the table-indexed field
 * renderer. Self-contained mock machine (real Regs for exact flags, flat 64K RAM,
 * step/call/ret/push16/pop16). loc_05b2 has no calls; every exit is `ret z`, so the mock
 * seats a known caller return so the final PC proves the ret. Path A pins digit mode with
 * a full pcSeq stepcheck; Path B pins blank mode (jr-c branch, scf latch, 0x10 fill).
 * TEETH: mis-charge `add hl,de` (0x05bc, 11 T) as 7 T; the 421-T golden must catch it.
 * Run: node --test games/pooyan/translated/test/loc_05b2.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_05b2 } from "../loc_05b2.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x05b2, pcSeq: [],
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
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const PC_A = [
  0x05b3, 0x05b4, 0x05b7, 0x05b9, 0x05ba, 0x05bc, 0x05bd, 0x05be, 0x05bf, 0x05c0, 0x05c1, 0x05c2,
  0x05c3, 0x05c4, 0x05c5, 0x05c6, 0x05c7, 0x05ca, 0x05cc,
  0x05cd, 0x05cf, 0x05d1, 0x05d3, 0x05d4, 0x05d6, 0x05d7, 0x05d8, 0x05d9, 0x05cc, // digit '3'
  0x05cd, 0x05cf, 0x05d1, 0x05d3, 0x05d4, 0x05d6, 0x05d7, 0x05d8, 0x05d9, 0x05cc, // digit '5'
  0x05cd, 0x05cf, 0x05dc,                                                        // digit '.'
  0x05dd, 0x05de, 0x05c2,
  0x05c3, 0x05c4, 0x05c5, 0x05c6, 0x05c7, 0x05ca, 0x05cc,
  0x05cd, 0x05cf, 0x05d1, 0x05d3, CALLER_RET,                                    // digit '?' -> ret
];

function setupPathA(m) {
  seatCaller(m);
  m.regs.a = 0x02; // doubled -> 0x04, carry clear -> digit mode
  m.mem.write8(0x7a11, 0x00); // pointer-table[0x04] = 0x8100
  m.mem.write8(0x7a12, 0x81);
  m.mem.write8(0x8100, 0x00); // record 1 dest = 0x8400
  m.mem.write8(0x8101, 0x84);
  m.mem.write8(0x8102, 0x33); // '3'
  m.mem.write8(0x8103, 0x35); // '5'
  m.mem.write8(0x8104, 0x2e); // '.'
  m.mem.write8(0x8105, 0x00); // record 2 dest = 0x8500
  m.mem.write8(0x8106, 0x85);
  m.mem.write8(0x8107, 0x3f); // '?'
}

function assertPathAGolden(m) {
  assert.equal(m.tstates, 421, "Path A T-state total");
  assert.equal(m.pc, CALLER_RET, "Path A ends via `ret z` (popped caller address)");
  assert.deepEqual(m.calls, [], "Path A makes no calls");
  assert.equal(m.mem.read8(0x8400), 0x03, "'3'-'0' written to dest");
  assert.equal(m.mem.read8(0x83e0), 0x05, "'5'-'0' written one row up (0x8400+0xffe0)");
  assert.equal(m.mem.read8(0x8500), 0x00, "record 2 hit '?' immediately -> nothing drawn");
  assert.equal(m.regs.a, 0x3f, "A = last char read ('?')");
  assert.equal(m.regs.de, 0x8107, "DE parked at the '?' byte");
}

test("loc_05b2 Path A: digit mode, two records, ret on '?'", () => {
  const m = makeMachine();
  setupPathA(m);
  loc_05b2(m);
  assertPathAGolden(m);
  assert.deepEqual(m.pcSeq, PC_A, "Path A step boundaries match the ROM bytes");
});

test("loc_05b2 Path B: origA bit7 set -> blank mode, scf re-arm, 0x10 fill", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x80; // add a,a carries -> blank mode latched
  m.mem.write8(0x7a0d, 0x00); // pointer-table[0] = 0x8200
  m.mem.write8(0x7a0e, 0x82);
  m.mem.write8(0x8200, 0x00); // record 1 dest = 0x8600
  m.mem.write8(0x8201, 0x86);
  m.mem.write8(0x8202, 0x41); // any non-delimiter -> one blank tile
  m.mem.write8(0x8203, 0x2e); // '.' (scf keeps blank mode)
  m.mem.write8(0x8204, 0x00); // record 2 dest = 0x8700
  m.mem.write8(0x8205, 0x87);
  m.mem.write8(0x8206, 0x3f); // '?'

  loc_05b2(m);

  assert.equal(m.tstates, 355, "Path B T-state total");
  assert.equal(m.pc, CALLER_RET, "Path B ends via `ret z`");
  assert.deepEqual(m.calls, [], "no calls");
  assert.equal(m.mem.read8(0x8600), 0x10, "blank tile 0x10 written (mode = carry set)");
  assert.equal(m.mem.read8(0x8700), 0x00, "record 2 hit '?' immediately");
  // 355 T proves the 2nd record also took the jr-c (blank) branch; the final cp 0x3f clears carry.
  assert.equal(m.regs.fC, false, "carry cleared by the final cp 0x3f");
  assert.equal(m.regs.a, 0x3f, "A = '?' terminator");
  assert.equal(m.regs.de, 0x8206, "DE parked at the '?' byte");
});

test("loc_05b2 MUTATION: `add hl,de` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  let first = true;
  m.step = (nextAddr, cycles) => {
    if (first && nextAddr === 0x05bd) { first = false; return realStep(nextAddr, 7); }
    return realStep(nextAddr, cycles);
  };
  setupPathA(m);
  loc_05b2(m);
  assert.equal(m.tstates, 417, "mutation loses exactly 4 T (11 -> 7)");
  assert.throws(() => assertPathAGolden(m), /Path A T-state total/,
    "the 421-T golden must fail on the mutant");
});
