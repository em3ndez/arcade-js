// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_03c2 (ROM 0x03c2, Pooyan) -- 5-cell vertical gauge renderer.
 * Count at 0x8908 -> C = min(count-1, 5) filled tiles (0xb0) from base 0x863f climbing one row
 * per cell (HL += -0x20), then 5-C blank tiles (0x10). Self-contained mock machine (real Regs,
 * flat 64K RAM, step/call/ret). Every exit is a `ret`; a seated caller return proves each.
 *
 * Path3 (count=3) pins the full pcSeq + T with both loops. Path1 (count=1) hits the jr-z (no
 * filled tiles) branch; Path7 (count=7) hits the clamp + the "gauge full" ret z; Path0 the
 * empty ret z. TEETH: mis-charge the first `add hl,de` (11 T) as 7 T -> the 274-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_03c2.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_03c2 } from "../loc_03c2.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x03c2, pcSeq: [],
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

// count=3: C=2 filled (0xb0) then 5-2=3 blanks (0x10). Cells climb HL by -0x20 each.
const PC_3 = [
  0x03c5, 0x03c8, 0x03cb, 0x03cc, 0x03cd, 0x03ce, 0x03cf, 0x03d1, 0x03d3, 0x03d7, 0x03d8, 0x03d9,
  0x03db, 0x03dc, 0x03d9, // filled cell 1
  0x03db, 0x03dc, 0x03de, // filled cell 2 -> djnz falls out
  0x03e0, 0x03e1, 0x03e2, 0x03e3,
  0x03e5, 0x03e6, 0x03e3, // blank cell 1
  0x03e5, 0x03e6, 0x03e3, // blank cell 2
  0x03e5, 0x03e6, 0x03e8, // blank cell 3 -> djnz falls out
  CALLER_RET,
];

test("loc_03c2 count=3: 2 filled + 3 blank cells, full pcSeq + T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8908, 0x03);

  loc_03c2(m);

  assert.equal(m.tstates, 274, "count=3 T-state total");
  assert.deepEqual(m.pcSeq, PC_3, "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "ends via ret");
  assert.equal(m.mem.read8(0x863f), 0xb0, "filled cell 0");
  assert.equal(m.mem.read8(0x861f), 0xb0, "filled cell 1 (0x863f-0x20)");
  assert.equal(m.mem.read8(0x85ff), 0x10, "blank cell 0");
  assert.equal(m.mem.read8(0x85df), 0x10, "blank cell 1");
  assert.equal(m.mem.read8(0x85bf), 0x10, "blank cell 2");
  assert.equal(m.regs.hl, 0x859f, "HL parked past the last blank cell");
  assert.equal(m.regs.c, 0x02, "C = filled count");
});

test("loc_03c2 count=1: jr z branch -> 0 filled, 5 blank", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8908, 0x01);

  loc_03c2(m);

  assert.equal(m.tstates, 257, "count=1 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x03c5, 0x03c8, 0x03cb, 0x03cc, 0x03cd, 0x03ce, 0x03cf, 0x03de, 0x03e0, 0x03e1, 0x03e2, 0x03e3,
    0x03e5, 0x03e6, 0x03e3,
    0x03e5, 0x03e6, 0x03e3,
    0x03e5, 0x03e6, 0x03e3,
    0x03e5, 0x03e6, 0x03e3,
    0x03e5, 0x03e6, 0x03e8,
    CALLER_RET,
  ], "jr z skips the filled loop; 5 blanks drawn");
  assert.equal(m.mem.read8(0x863f), 0x10, "first cell is blank (no filled tiles)");
  assert.equal(m.regs.c, 0x00, "C=0 filled");
});

test("loc_03c2 count=7: clamp to 5 filled, then ret z (gauge full)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8908, 0x07);

  loc_03c2(m);

  assert.equal(m.tstates, 273, "count=7 T-state total (clamp + ret z)");
  assert.deepEqual(m.pcSeq, [
    0x03c5, 0x03c8, 0x03cb, 0x03cc, 0x03cd, 0x03ce, 0x03cf, 0x03d1, 0x03d3, 0x03d5, 0x03d7, 0x03d8, 0x03d9,
    0x03db, 0x03dc, 0x03d9,
    0x03db, 0x03dc, 0x03d9,
    0x03db, 0x03dc, 0x03d9,
    0x03db, 0x03dc, 0x03d9,
    0x03db, 0x03dc, 0x03de,
    0x03e0, 0x03e1, CALLER_RET, // sub c = 0 -> ret z
  ], "clamp branch (0x03d5) + 5 filled cells + ret z");
  assert.equal(m.regs.c, 0x05, "clamped to 5");
  assert.equal(m.mem.read8(0x85bf), 0xb0, "5th filled cell");
  assert.equal(m.regs.a, 0x00, "A = 5 - 5 = 0 at the ret z");
});

test("loc_03c2 count=0: empty gauge -> immediate ret z", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8908, 0x00);

  loc_03c2(m);

  assert.equal(m.tstates, 48, "T = 10+10+13+4+11");
  assert.deepEqual(m.pcSeq, [0x03c5, 0x03c8, 0x03cb, 0x03cc, CALLER_RET]);
  assert.equal(m.mem.read8(0x863f), 0x00, "nothing drawn");
});

test("loc_03c2 MUTATION: first `add hl,de` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  let first = true;
  m.step = (nextAddr, cycles) => {
    if (first && nextAddr === 0x03dc) { first = false; return realStep(nextAddr, 7); }
    return realStep(nextAddr, cycles);
  };
  seatCaller(m);
  m.mem.write8(0x8908, 0x03);

  loc_03c2(m);

  assert.equal(m.tstates, 270, "mutation loses 4 T (11 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 274, "count=3 T-state total"),
    /274/,
    "the 274-T golden must fail on the mutant",
  );
});
