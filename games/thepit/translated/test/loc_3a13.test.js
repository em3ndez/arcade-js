// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_3a13 (ROM 0x3a13-0x3a4b + fall-through into
// loc_3a4c), The Pit.
//
// Runs the routine on a lightweight machine built from the REAL thepit address
// space (boards/thepit/memory.js) + Io + the shared Z80 Regs. The callees are
// stubbed as "pop-and-return" routines that balance the stack and add NO cycles,
// so the asserted T-state total is loc_3a13's OWN instruction cost. The loc_319d
// stub also ADDS 0x10 to each of the 17 scratch bytes at 0x8083, so the
// copy->drive->copy-back round-trip is observable in the record it leaves behind.
//
// Two paths are exercised:
//   * gate 0x8078 != 0  -> BOTH records processed, ends by fall-through tail-call
//   * gate 0x8078 == 0  -> only record 1, `jp z` taken tail-jump to loc_3a4c
// The load-bearing control-flow claim is that loc_3a4c's ret lands on loc_3a13's
// OWN caller in both cases (tail-call: no push, no trailing ret). A deliberate
// mutation (the `jp z` gate inverted, fZ -> fNZ) is asserted to be caught.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_3a13 } from "../loc_3a13.js";

const SENTINEL = 0xbeef; // caller return addr the loc_3a4c tail-call must land on
const REC1 = 0x810a; // record 1 base (always processed)
const REC2 = 0x811b; // record 2 base (processed only when 0x8078 != 0)
const SCRATCH = 0x8083; // shared working block loc_319d drives
const LEN = 0x11; // 17 bytes per record / ldir count
const XFORM = 0x10; // what the loc_319d stub adds to each scratch byte

// Distinct seed patterns so a mis-copy between records is visible.
const rec1Seed = (i) => (0xa0 + i) & 0xff;
const rec2Seed = (i) => (0x50 + i) & 0xff;

// -- minimal machine: real mem/io/regs + the step/call/ldir seam ---------------
class TestMachine {
  constructor() {
    this.io = new Io();
    this.mem = new AddressSpace(new Uint8Array(0x5000), this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x3a13;
    this.calls = [];
    this.regs.sp = 0x8780; // inside work RAM (0x8000-0x87ff) so pushes are mapped
  }
  step(nextAddr, t) {
    this.pc = nextAddr;
    this.cycles += t;
  }
  push16(v) {
    this.regs.sp = (this.regs.sp - 2) & 0xffff;
    this.mem.write8(this.regs.sp, v & 0xff);
    this.mem.write8((this.regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
  }
  pop16() {
    const lo = this.mem.read8(this.regs.sp);
    const hi = this.mem.read8((this.regs.sp + 1) & 0xffff);
    this.regs.sp = (this.regs.sp + 2) & 0xffff;
    return lo | (hi << 8);
  }
  // Stubbed callee: record it, then behave as a bare `ret` (pop whatever the site
  // left on the stack), adding NO cycles. For the two mid-routine CALLs that pops
  // the pushed return; for the FALL-THROUGH / jp-z tail-call (no push) it pops the
  // SENTINEL -- the whole point: loc_3a4c returns to loc_3a13's caller.
  // loc_319d additionally +0x10s the scratch block so the round-trip is observable.
  call(addr) {
    this.calls.push(addr);
    if (addr === 0x319d) {
      for (let i = 0; i < LEN; i++) {
        this.mem.write8(SCRATCH + i, (this.mem.read8(SCRATCH + i) + XFORM) & 0xff);
      }
    }
    this.pc = this.pop16();
    return undefined;
  }
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }
  // Byte-for-byte the machine.js semantics: 21 T per repeating iter, 16 on exit.
  ldirAt(self, nextAddr) {
    const { regs, mem } = this;
    for (;;) {
      mem.write8(regs.de, mem.read8(regs.hl));
      regs.hl = (regs.hl + 1) & 0xffff;
      regs.de = (regs.de + 1) & 0xffff;
      regs.bc = (regs.bc - 1) & 0xffff;
      if (regs.bc === 0) {
        this.step(nextAddr, 16);
        return;
      }
      this.step(self, 21);
    }
  }
}

function seed(m, gate) {
  for (let i = 0; i < LEN; i++) {
    m.mem.write8(REC1 + i, rec1Seed(i));
    m.mem.write8(REC2 + i, rec2Seed(i));
  }
  m.mem.write8(0x8078, gate); // the second-record gate
}

function run(fn, gate) {
  const m = new TestMachine();
  seed(m, gate);
  m.push16(SENTINEL); // the caller's return address
  fn(m);
  return {
    cycles: m.cycles,
    rec1: Array.from({ length: LEN }, (_, i) => m.mem.read8(REC1 + i)),
    rec2: Array.from({ length: LEN }, (_, i) => m.mem.read8(REC2 + i)),
    calls: m.calls,
    pc: m.pc,
    sp: m.regs.sp,
    hl: m.regs.hl,
    de: m.regs.de,
    bc: m.regs.bc,
  };
}

// Expected records after each is round-tripped through loc_319d (+0x10 per byte).
const rec1Done = Array.from({ length: LEN }, (_, i) => (rec1Seed(i) + XFORM) & 0xff);
const rec2Done = Array.from({ length: LEN }, (_, i) => (rec2Seed(i) + XFORM) & 0xff);
const rec2Raw = Array.from({ length: LEN }, (_, i) => rec2Seed(i));

// -- full path: gate != 0, BOTH records processed, fall-through tail-call -------
// T-states (own instructions only; callees add 0):
//   record 1: 3x ld dd,nn (30) + ldir 0x11 (352) + call (17) + 3x ld dd,nn (30)
//             + ldir (352)                                              = 781
//   gate:     ld a,(nn) (13) + or a (4) + jp z not-taken (10)           = 27
//   record 2: 3x ld dd,nn (30) + ldir (352) + call (17) + 3x ld dd,nn (30)
//             + ldir (352)                                              = 781
//   total = 781 + 27 + 781 = 1589
function checkFull(res) {
  assert.equal(res.cycles, 1589, "T-state total (both records, own instructions)");
  assert.deepEqual(res.rec1, rec1Done, "record 1 round-tripped through loc_319d");
  assert.deepEqual(res.rec2, rec2Done, "record 2 round-tripped through loc_319d");
  assert.deepEqual(res.calls, [0x319d, 0x319d, 0x3a4c], "call sequence: 319d,319d,tail 3a4c");
  assert.equal(res.pc, SENTINEL, "fall-through tail-call: loc_3a4c ret lands on caller");
  assert.equal(res.sp, 0x8780, "stack balanced (no double-push from the tail-call)");
  assert.equal(res.hl, 0x8094, "HL = 0x8083 + 0x11 after the last ldir");
  assert.equal(res.de, 0x812c, "DE = 0x811b + 0x11 after the last ldir");
  assert.equal(res.bc, 0x0000, "BC = 0 after the last ldir");
}

test("loc_3a13: gate!=0 processes both records, 1589 T, fall-through tail-call", () => {
  checkFull(run(loc_3a13, 0x01));
});

// -- gated path: gate == 0, `jp z` taken -> only record 1, tail-jump to 3a4c ----
// T-states: record 1 (781) + gate ld a/or a (17) + jp z taken (10) = 808
function checkGated(res) {
  assert.equal(res.cycles, 808, "T-state total (record 1 only + taken jp z)");
  assert.deepEqual(res.rec1, rec1Done, "record 1 round-tripped through loc_319d");
  assert.deepEqual(res.rec2, rec2Raw, "record 2 UNTOUCHED (gate closed)");
  assert.deepEqual(res.calls, [0x319d, 0x3a4c], "call sequence: 319d, tail 3a4c");
  assert.equal(res.pc, SENTINEL, "jp z tail-jump: loc_3a4c ret lands on caller");
  assert.equal(res.sp, 0x8780, "stack balanced");
}

test("loc_3a13: gate==0 skips record 2 via jp z, 808 T", () => {
  checkGated(run(loc_3a13, 0x00));
});

// -- MUTATION: the `jp z` gate inverted (fZ -> fNZ). Now gate!=0 TAKES the jump
// (skips record 2) and gate==0 falls through (processes it) -- the exact opposite
// of the ROM. Run on gate!=0, the mutant leaves record 2 untouched, calls 319d
// once, and totals 808 T instead of 1589, so the full-path spec must reject it.
function loc_3a13_mut(m) {
  const { regs, mem } = m;
  regs.hl = 0x810a; m.step(0x3a16, 10);
  regs.de = 0x8083; m.step(0x3a19, 10);
  regs.bc = 0x0011; m.step(0x3a1c, 10);
  m.ldirAt(0x3a1c, 0x3a1e);
  m.push16(0x3a21); m.step(0x319d, 17); m.call(0x319d);
  regs.hl = 0x8083; m.step(0x3a24, 10);
  regs.de = 0x810a; m.step(0x3a27, 10);
  regs.bc = 0x0011; m.step(0x3a2a, 10);
  m.ldirAt(0x3a2a, 0x3a2c);
  regs.a = mem.read8(0x8078); m.step(0x3a2f, 13);
  regs.or(regs.a); m.step(0x3a30, 4);
  if (regs.fNZ) { // BUG: condition inverted (should be fZ)
    m.step(0x3a4c, 10);
    return m.call(0x3a4c);
  }
  m.step(0x3a33, 10);
  regs.hl = 0x811b; m.step(0x3a36, 10);
  regs.de = 0x8083; m.step(0x3a39, 10);
  regs.bc = 0x0011; m.step(0x3a3c, 10);
  m.ldirAt(0x3a3c, 0x3a3e);
  m.push16(0x3a41); m.step(0x319d, 17); m.call(0x319d);
  regs.hl = 0x8083; m.step(0x3a44, 10);
  regs.de = 0x811b; m.step(0x3a47, 10);
  regs.bc = 0x0011; m.step(0x3a4a, 10);
  m.ldirAt(0x3a4a, 0x3a4c);
  return m.call(0x3a4c);
}

test("mutation (jp z gate inverted) is caught by the full-path spec", () => {
  // Sanity: on gate!=0 the mutant really diverges (record 2 untouched, 808 T).
  const bad = run(loc_3a13_mut, 0x01);
  assert.deepEqual(bad.rec2, rec2Raw, "mutant skips record 2 on gate!=0");
  assert.equal(bad.cycles, 808, "mutant is 781 T short (one record skipped)");
  assert.deepEqual(bad.calls, [0x319d, 0x3a4c], "mutant calls 319d once");
  // The spec the real routine passes MUST reject the mutant.
  assert.throws(() => checkFull(bad), /T-state total|record 2|call sequence/);
});
