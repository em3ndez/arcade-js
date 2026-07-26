// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated loc_2934 (ROM 0x2934, The Pit) -- the second-entity
 * commit path (entered once the counter 0x80bd has rolled to zero).
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags, a
 * flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine) so the
 * routine runs in isolation without a ROM image. Every exit is a `ret`, so a known
 * caller return address is seated on the stack and the final PC proves which `ret`
 * fired. `pcSeq` records every step boundary so a deterministic path can be pinned
 * exactly (stepcheck).
 *
 * It pins, against the disassembly, four concrete paths:
 *   A. E = 0x97 (in [0x96,0x99]) -> the main-body table remap: neighbour tile is
 *      indexed E-0x96 into the 0x2dc3 table and written to (ix-0x01); ret (393 T).
 *      Full pcSeq stepcheck.
 *   B. E = 0xc1 -> loc_298a, sub-type (0x80c0)==2 -> arm 0x80b1=0x10 and write tile
 *      0x70 to (ix-0x02) via loc_29a9; ret (375 T).
 *   C. E = 0x95 -> loc_298a, sub-type (0x80c0)==1 (!=0,!=2) -> loc_299c remaps
 *      (ix-0x02)-0x96 through the 0x2dc3 table into (ix-0x02); ret (420 T).
 *   D. E = 0x50 (< 0x96) -> `ret c`, keeping (ix-0x01) as the just-written sprite id
 *      and (ix+0x00) = 0x70 (312 T). Pins the carry that drives `ret c`.
 *
 * TEETH (required mutation): mis-charge `ld ix,(0x80ba)` (DD 2A = 20 T) as the
 * `ld hl,(nn)` timing (16 T) -- a plausible copy error, same logic, wrong cycle
 * budget. Path A is re-run with that one step mis-charged and the golden T-state
 * assertion MUST catch it.
 *
 * Run: node --test games/thepit/translated/test/loc_2934.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2934 } from "../loc_2934.js";

const CALLER_RET = 0xabcd; // seated on the stack; any `ret` pops it into PC
const IX = 0x8200; // object pointer: (ix-2)=0x81fe, (ix-1)=0x81ff, (ix+0)=0x8200

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => {
      ram[a & 0xffff] = v & 0xff;
      ram[(a + 1) & 0xffff] = (v >> 8) & 0xff;
    },
  };
  return {
    regs,
    mem,
    ram,
    calls: [],
    tstates: 0,
    pc: 0x2934,
    pcSeq: [],
    step(nextAddr, cycles) {
      this.pc = nextAddr;
      this.tstates += cycles;
      this.pcSeq.push(nextAddr);
    },
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
    ret(cycles = 10) {
      this.step(this.pop16(), cycles);
    },
    call(addr) {
      this.calls.push(addr);
      return undefined; // no tail-jumps in this routine; present for surface parity
    },
  };
}

// Seat the caller's return address so any `ret` inside the routine pops a known value.
function seatCaller(m) {
  m.regs.sp = 0x8780; // inside work RAM (0x8000-0x87FF)
  m.push16(CALLER_RET);
}

// The placement scratch the entry block copies out; shared by every path.
function seatScratch(m) {
  m.mem.write16(0x80ba, IX);   // saved object pointer
  m.mem.write8(0x80b6, 0x2c);  // -> 0x80a9 / 0x80be
  m.mem.write8(0x80b9, 0x43);  // -> 0x80ac
  m.mem.write8(0x80bc, 0x14);  // -> 0x80b1 (entry), before any loc_298a override
  m.mem.write8(0x80bf, 0x9d);  // sprite id written to (ix-0x01)
}

function assertScratchCommitted(m) {
  const b = (a) => m.mem.read8(a);
  assert.equal(b(0x80aa), 0x30, "(0x80aa) = 0x30 commit state");
  assert.equal(b(0x80ab), 0x07, "(0x80ab) = 0x07");
  assert.equal(m.mem.read16(0x80af), IX, "(0x80af) = IX reloaded from 0x80ba");
  assert.equal(b(0x80a9), 0x2c, "(0x80a9) = (0x80b6)");
  assert.equal(b(0x80be), 0x2c, "(0x80be) = (0x80b6)");
  assert.equal(b(0x80ac), 0x43, "(0x80ac) = (0x80b9)");
}

// ---- Path A: E in [0x96,0x99] -> main-body 0x2dc3 table remap into (ix-0x01) ------
const EXPECTED_PC_SEQ_A = [
  0x2936, 0x2939, 0x293b, 0x293e, 0x2942, 0x2946, 0x2949, 0x294c, 0x294f, 0x2952,
  0x2955, 0x2958, 0x295b, 0x295e, 0x2961, 0x2964, 0x2966, 0x2969, 0x296a,
  0x296c, 0x296e, 0x2970, 0x2972, 0x2974, 0x2976, 0x2978, 0x2979, 0x297b, 0x297c,
  0x297e, 0x297f, 0x2981, 0x2984, 0x2985, 0x2986, 0x2989,
  CALLER_RET, // ret
];

function setupPathA(m) {
  seatCaller(m);
  seatScratch(m);
  m.regs.ix = 0x0000;            // proves IX is reloaded from 0x80ba, not preset
  m.mem.write8(0x81ff, 0x97);    // (ix-0x01) = E, in [0x96,0x99] -> table lookup arm
  m.mem.write8(0x2dc4, 0x88);    // 0x2dc3 table entry for index (0x97-0x96)=1
}

function assertPathAGolden(m) {
  const b = (a) => m.mem.read8(a);
  assert.equal(m.tstates, 393, "Path A T-state total");
  assert.equal(m.pc, CALLER_RET, "Path A ends via `ret` (popped caller address)");
  assert.deepEqual(m.calls, [], "Path A makes no calls / tail-jumps");
  assertScratchCommitted(m);
  assert.equal(b(0x80b1), 0x14, "(0x80b1) = (0x80bc) (no loc_298a override on this arm)");
  // the two writes to (ix-0x01): sprite id 0x9d first (0x2961), then the table value
  assert.equal(b(0x81ff), 0x88, "(ix-0x01) ends as the 0x2dc3 table value 0x88");
  assert.equal(b(0x8200), 0x70, "(ix+0x00) overwritten with 0x70");
  // control-path registers
  assert.equal(m.regs.e, 0x97, "E = OLD (ix-0x01) captured before the overwrite");
  assert.equal(m.regs.a, 0x88, "A = table value at ret");
  assert.equal(m.regs.hl, 0x2dc4, "HL = 0x2dc3 + 1 (index for tile 0x97)");
  assert.equal(m.regs.c, 0x01, "C = E - 0x96 = index 1");
  assert.equal(m.regs.b, 0x00, "B = 0x00");
}

test("loc_2934 Path A: E=0x97 -> 0x2dc3 table remap into (ix-0x01)", () => {
  const m = makeMachine();
  setupPathA(m);
  loc_2934(m);
  assertPathAGolden(m);
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ_A, "Path A step boundaries match the disassembly");
});

// ---- Path B: E=0xc1 -> loc_298a, sub-type 2 -> arm 0x80b1=0x10, tile 0x70 --------
test("loc_2934 Path B: E=0xc1, (0x80c0)==2 -> arm 0x80b1=0x10 + (ix-0x02)=0x70", () => {
  const m = makeMachine();
  seatCaller(m);
  seatScratch(m);
  m.mem.write8(0x81ff, 0xc1); // (ix-0x01) = E = 0xc1 -> first jr z to loc_298a
  m.mem.write8(0x80c0, 0x02); // sub-type 2

  loc_2934(m);

  const b = (a) => m.mem.read8(a);
  assert.equal(m.tstates, 375, "Path B T-state total");
  assert.equal(m.pc, CALLER_RET, "Path B ends via `ret` (via loc_29a9)");
  assert.deepEqual(m.calls, [], "Path B makes no calls / tail-jumps");
  assertScratchCommitted(m);
  assert.equal(b(0x80b1), 0x10, "(0x80b1) re-armed to 0x10 by the sub-type-2 arm");
  assert.equal(b(0x81fe), 0x70, "(ix-0x02) = 0x70");
  assert.equal(b(0x81ff), 0x9d, "(ix-0x01) = sprite id 0x9d (loc_298a does not touch it)");
  assert.equal(b(0x8200), 0x70, "(ix+0x00) = 0x70");
  assert.equal(m.regs.a, 0x70, "A = 0x70 at ret");
  assert.equal(m.regs.e, 0xc1, "E = OLD (ix-0x01)");
});

// ---- Path C: E=0x95 -> loc_298a, sub-type 1 -> loc_299c 0x2dc3 remap of (ix-0x02) --
test("loc_2934 Path C: E=0x95, (0x80c0)==1 -> loc_299c remaps (ix-0x02) via 0x2dc3", () => {
  const m = makeMachine();
  seatCaller(m);
  seatScratch(m);
  m.mem.write8(0x81ff, 0x95); // (ix-0x01) = E = 0x95 -> second jr z to loc_298a
  m.mem.write8(0x80c0, 0x01); // sub-type != 0 and != 2 -> jr nz to loc_299c
  m.mem.write8(0x81fe, 0x98); // (ix-0x02) neighbour tile -> index 0x98-0x96 = 2
  m.mem.write8(0x2dc5, 0x44); // 0x2dc3 table entry for index 2

  loc_2934(m);

  const b = (a) => m.mem.read8(a);
  assert.equal(m.tstates, 420, "Path C T-state total");
  assert.equal(m.pc, CALLER_RET, "Path C ends via `ret` (via loc_29a9)");
  assert.deepEqual(m.calls, [], "Path C makes no calls / tail-jumps");
  assertScratchCommitted(m);
  assert.equal(b(0x81fe), 0x44, "(ix-0x02) ends as the 0x2dc3 table value 0x44");
  assert.equal(b(0x81ff), 0x9d, "(ix-0x01) = sprite id 0x9d");
  assert.equal(m.regs.a, 0x44, "A = table value at ret");
  assert.equal(m.regs.hl, 0x2dc5, "HL = 0x2dc3 + 2 (index for tile 0x98)");
  assert.equal(m.regs.c, 0x02, "C = (ix-0x02) - 0x96 = 2");
});

// ---- Path D: E=0x50 (< 0x96) -> `ret c`, sprite id kept ----------------------------
test("loc_2934 Path D: E=0x50 -> `ret c` keeps (ix-0x01)=sprite id, (ix+0)=0x70", () => {
  const m = makeMachine();
  seatCaller(m);
  seatScratch(m);
  m.mem.write8(0x81ff, 0x50); // (ix-0x01) = E = 0x50, below 0x96 -> ret c

  loc_2934(m);

  const b = (a) => m.mem.read8(a);
  assert.equal(m.tstates, 312, "Path D T-state total");
  assert.equal(m.pc, CALLER_RET, "Path D ends via `ret c`");
  assert.deepEqual(m.calls, [], "Path D makes no calls / tail-jumps");
  assertScratchCommitted(m);
  assert.equal(b(0x81ff), 0x9d, "(ix-0x01) kept as sprite id 0x9d (no table remap)");
  assert.equal(b(0x8200), 0x70, "(ix+0x00) = 0x70");
  assert.equal(m.regs.a, 0x50, "A = E = 0x50 (cp does not change A)");
  assert.equal(m.regs.e, 0x50, "E = OLD (ix-0x01)");
  assert.equal(m.regs.fC, true, "carry set (0x50 < 0x96) -- the flag that drove `ret c`");
});

// ---- MUTATION: the Path A T-state total must have teeth ----------------------------
test("loc_2934 MUTATION: `ld ix,(0x80ba)` mis-charged 16T (not 20T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  // The first step target is 0x2942 (following `ld ix,(0x80ba)`); mis-charge it 16 T.
  let first = true;
  m.step = (nextAddr, cycles) => {
    if (first && nextAddr === 0x2942) { first = false; return realStep(nextAddr, 16); }
    return realStep(nextAddr, cycles);
  };

  setupPathA(m);
  loc_2934(m);

  assert.equal(m.tstates, 389, "mutation loses exactly 4 T (20 -> 16)");
  assert.throws(
    () => assertPathAGolden(m),
    /Path A T-state total/,
    "the golden T-state assertion must fail on the mutant",
  );
});
