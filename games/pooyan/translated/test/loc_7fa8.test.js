// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_7fa8 (ROM 0x7fa8, Pooyan) -- a shared tail. Calls sound helper
 * 0x0ecf, reads a count at (0x8e25); if zero it jr-z's straight to the loc_7fc7 latch; else it fills
 * B rows with A=0x10 (tile pointer 0x8e27 stepped by DE=0xffe0, IX record 0x8e1f stepped +1) via the
 * djnz loop at loc_7fbe, then falls into loc_7fc7. loc_7fc7 sets (0x8808)=0x80, clears (0x8e26),
 * sets (0x8e2a)=1, ret.
 *
 * The mock's `call` POPS the return the call site pushed (modelling 0x0ecf's ret), so a missing
 * push16 before the call would desync SP and the baseline assertion would fail. read16 composes two
 * bytes so the `ld hl,(nn)` / `ld ix,(nn)` loads resolve.
 *
 * Paths: LOOP ((0x8e25)=2 -> both djnz arms: taken then not-taken, two fills) and JRZ
 * ((0x8e25)=0 -> jr z to loc_7fc7, no fill). MUTATION: mis-charge `ld (ix+0),a` (19T) as 7T.
 *
 * Run: node --test games/pooyan/translated/test/loc_7fa8.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_7fa8 } from "../loc_7fa8.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x7fa8, pcSeq: [],
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
    // The callee's `ret` pops the return the call site pushed -- model that pop so a missing push16
    // desyncs SP. 0x0ecf writes nothing loc_7fa8 reads back, so its mock is a bare pop.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const HL0 = 0x8a00;
const IX0 = 0x9100;

test("loc_7fa8 Path LOOP: (0x8e25)=2 -> two fills (djnz taken then not) + loc_7fc7 latch", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8e25, 0x02);                 // count = 2 -> jr z NOT taken, B=2
  m.mem.write8(0x8e27, HL0 & 0xff);           // (0x8e27) -> HL
  m.mem.write8(0x8e28, (HL0 >> 8) & 0xff);
  m.mem.write8(0x8e1f, IX0 & 0xff);           // (0x8e1f) -> IX
  m.mem.write8(0x8e20, (IX0 >> 8) & 0xff);

  loc_7fa8(m);

  // 98 prologue + 60 (iter1, djnz taken) + 55 (iter2, djnz not taken) + 67 tail
  assert.equal(m.tstates, 280, "Path LOOP T-state total");
  assert.deepEqual(m.pcSeq, [
    0x0ecf, 0x7fae, 0x7faf, 0x7fb1, 0x7fb2, 0x7fb4, 0x7fb7, 0x7fba, 0x7fbe,
    0x7fbf, 0x7fc2, 0x7fc3, 0x7fc5, 0x7fbe,
    0x7fbf, 0x7fc2, 0x7fc3, 0x7fc5, 0x7fc7,
    0x7fca, 0x7fcc, 0x7fcd, 0x7fd0, 0x7fd2, 0x7fd5, CALLER_RET,
  ], "jr z not taken; djnz loops twice; ret to caller");
  assert.equal(m.pc, CALLER_RET, "ret to the seated caller");
  assert.deepEqual(m.calls, [0x0ecf], "one call: the sound helper");

  // fill writes: A=0x10 into two HL cells (stepped by -0x20) and two IX cells (stepped +1)
  assert.equal(m.mem.read8(HL0), 0x10, "iter1 (hl)=0x10");
  assert.equal(m.mem.read8((HL0 - 0x20) & 0xffff), 0x10, "iter2 (hl)=0x10");
  assert.equal(m.mem.read8(IX0), 0x10, "iter1 (ix+0)=0x10");
  assert.equal(m.mem.read8((IX0 + 1) & 0xffff), 0x10, "iter2 (ix+0)=0x10");
  // (HL stepped twice by DE=0xffe0 is proved by the iter2 fill at HL0-0x20; HL itself is then
  //  clobbered by the loc_7fc7 `ld hl,0x8808`, so assert IX -- which the tail leaves alone.)
  assert.equal(m.regs.ix, (IX0 + 2) & 0xffff, "IX incremented twice");
  assert.equal(m.regs.b, 0x00, "B counted down to 0");

  // loc_7fc7 latch
  assert.equal(m.mem.read8(0x8808), 0x80, "(0x8808)=0x80");
  assert.equal(m.mem.read8(0x8e26), 0x00, "(0x8e26) cleared");
  assert.equal(m.mem.read8(0x8e2a), 0x01, "(0x8e2a)=1");
  assert.equal(m.regs.a, 0x01, "A=1 at ret");
  assert.equal(m.regs.sp, 0x8780, "SP unwound to baseline");
});

test("loc_7fa8 Path JRZ: (0x8e25)=0 -> jr z to loc_7fc7, no fill", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8e25, 0x00);                 // count = 0 -> jr z taken

  loc_7fa8(m);

  // 17 call + 13 + 4 + 12 (jr z taken) + 67 tail
  assert.equal(m.tstates, 113, "Path JRZ T-state total");
  assert.deepEqual(m.pcSeq, [
    0x0ecf, 0x7fae, 0x7faf, 0x7fc7,
    0x7fca, 0x7fcc, 0x7fcd, 0x7fd0, 0x7fd2, 0x7fd5, CALLER_RET,
  ], "jr z taken -> straight to loc_7fc7, loop skipped");
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x0ecf]);
  assert.equal(m.mem.read8(0x8808), 0x80, "(0x8808)=0x80");
  assert.equal(m.mem.read8(0x8e26), 0x00, "(0x8e26) cleared");
  assert.equal(m.mem.read8(0x8e2a), 0x01, "(0x8e2a)=1");
  // no fill happened: IX/HL cells untouched
  assert.equal(m.mem.read8(HL0), 0x00, "no fill at HL0");
  assert.equal(m.regs.sp, 0x8780, "SP unwound to baseline");
});

test("loc_7fa8 MUTATION: `ld (ix+0),a` mis-charged 7T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  // mis-charge each ld (ix+0),a (steps to 0x7fc2) as 7T -> loses 12T per iteration, 2 iters
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x7fc2 ? 7 : cycles);
  seatCaller(m);
  m.mem.write8(0x8e25, 0x02);
  m.mem.write8(0x8e27, HL0 & 0xff);
  m.mem.write8(0x8e28, (HL0 >> 8) & 0xff);
  m.mem.write8(0x8e1f, IX0 & 0xff);
  m.mem.write8(0x8e20, (IX0 >> 8) & 0xff);

  loc_7fa8(m);

  assert.equal(m.tstates, 256, "mutation loses 24 T (12 x 2 iterations)");
  assert.throws(
    () => assert.equal(m.tstates, 280, "Path LOOP T-state total"),
    /280/,
    "the 280-T golden must fail on the mutant",
  );
});
