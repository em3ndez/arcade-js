// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5fa2 (ROM 0x5fa2, Pooyan) -- one pass of the 6-slot overlap scan.
 * Empty / non-type-5 slots tail-jump loc_6018; otherwise |dx|,|dy| between slot (IX) and target (IY)
 * are thresholded (X 0x10/0x08, Y 0x12/0x08, the tighter value when C==3) and any miss tail-jumps
 * loc_6018. On a full hit: C==3 -> loc_6025 (mark 0x8d45, tail-jump boundary 0x613d); else flag two
 * cells, call loc_0f01, then `pop af`+`ret` return TWO frames up.
 *
 * The mock's `call` POPS the return address the call site pushed (loc_0f01's `ret`), and pops the single
 * seated frame for a tail jump (loc_6018 / 0x613d) so SP unwinds to the pre-seat baseline. The hit path
 * seats TWO frames: `pop af` discards the caller frame, `ret` returns to the outer one -- a missing
 * push16 before `call 0x0f01` then desyncs the stack and misses the outer return (the balance tooth).
 *
 * Cases exercise every branch edge: empty (A), non-type-5 (B), full hit to the two-frame return with
 * both 6006 edges (C: X=0x48 latch / C2: e=0xfb + 0x8ca9 branch), the four threshold misses (D:X>=0x10,
 * E:X>=0x08 via neg, F:Y>=0x12, G:Y>=0x08 via neg), and the C==3 hit -> 0x613d (H).
 * TEETH: mis-charge `ld a,(ix+0)` (19 T) as 15 T -> Path C's 469-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_5fa2.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5fa2 } from "../loc_5fa2.js";

const BASELINE = 0x8780;
const CALLER_RET = 0xabcd;   // single seated frame (tail-jump paths)
const OUTER_RET = 0x1234;    // deep-return path: what `ret` lands on
const IMMEDIATE_RET = 0x5678; // deep-return path: what `pop af` discards

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5fa2, pcSeq: [],
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
    // A callee's `ret` pops the return address the call site pushed; a tail jump pushes none, so the pop
    // consumes the seated caller frame instead. Either way the stack must balance.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatOne(m) { m.regs.sp = BASELINE; m.push16(CALLER_RET); }
function seatTwo(m) { m.regs.sp = BASELINE; m.push16(OUTER_RET); m.push16(IMMEDIATE_RET); }

// Common slot/target setup for the deep paths. HL=0x8ae0 (type=1, byte[+2]=5 to pass the two gates).
function seatSlot(m, { c, ix = 0x8850, iy = 0x8848, s881f = 0x01, slotX, slotY, tgtX, tgtY }) {
  m.regs.hl = 0x8ae0;
  m.mem.write8(0x8ae0, 0x01);
  m.mem.write8(0x8ae2, 0x05);
  m.regs.c = c;
  m.regs.ix = ix;
  m.regs.iy = iy;
  m.mem.write8(0x881f, s881f);
  if (slotX !== undefined) m.mem.write8((ix + 0) & 0xffff, slotX);
  if (slotY !== undefined) m.mem.write8((ix + 2) & 0xffff, slotY);
  if (tgtX !== undefined) m.mem.write8((iy + 0) & 0xffff, tgtX);
  if (tgtY !== undefined) m.mem.write8((iy + 2) & 0xffff, tgtY);
}

const PRE_DX = [
  0x5fa3, 0x5fa4, 0x5fa6, 0x5fa7, 0x5fa8, 0x5fa9, 0x5faa, 0x5fab, 0x5fad, 0x5faf,
  0x5fb1, 0x5fb4, 0x5fb5, 0x5fb9, 0x5fbc, 0x5fbd, 0x5fbe, 0x5fc1, 0x5fc3, 0x5fc4, 0x5fc7, 0x5fc8,
];

test("loc_5fa2 Path A: empty slot -> tail-jump loc_6018", () => {
  const m = makeMachine();
  seatOne(m);
  m.regs.hl = 0x8ae0;
  m.mem.write8(0x8ae0, 0x00); // (hl)==0 -> jr z

  loc_5fa2(m);

  assert.equal(m.tstates, 23, "Path A T total");
  assert.deepEqual(m.pcSeq, [0x5fa3, 0x5fa4, 0x6018]);
  assert.equal(m.pc, 0x6018);
  assert.deepEqual(m.calls, [0x6018]);
  assert.equal(m.regs.sp, BASELINE, "tail jump unwinds to baseline");
});

test("loc_5fa2 Path B: non-type-5 slot -> tail-jump loc_6018", () => {
  const m = makeMachine();
  seatOne(m);
  m.regs.hl = 0x8ae0;
  m.mem.write8(0x8ae0, 0x01);
  m.mem.write8(0x8ae2, 0x04); // byte[+2] != 5 -> jr nz

  loc_5fa2(m);

  assert.equal(m.tstates, 60, "Path B T total");
  assert.deepEqual(m.pcSeq, [
    0x5fa3, 0x5fa4, 0x5fa6, 0x5fa7, 0x5fa8, 0x5fa9, 0x5faa, 0x5fab, 0x5fad, 0x6018,
  ]);
  assert.equal(m.pc, 0x6018);
  assert.deepEqual(m.calls, [0x6018]);
  assert.equal(m.regs.sp, BASELINE);
});

test("loc_5fa2 Path C: full hit (C!=3), X-low=0x48 latch -> loc_0f01 then return two frames up", () => {
  const m = makeMachine();
  seatTwo(m);
  // e=0x06 (881f!=0). dx: (iy+0) - ((ix+0)+6) = 0x16-0x16 = 0. dy: (iy+2)-(ix+2) = 0. C=0.
  // iy=0x8848 -> X-low byte 0x48 -> jr z at 0x6006 keeps HL=0x8c91.
  seatSlot(m, { c: 0x00, iy: 0x8848, slotX: 0x10, slotY: 0x20, tgtX: 0x16, tgtY: 0x20 });

  loc_5fa2(m);

  assert.equal(m.tstates, 469, "Path C T total");
  assert.deepEqual(m.pcSeq, [
    ...PRE_DX,
    0x5fcc, 0x5fcd, 0x5fce, 0x5fd0, 0x5fd1, 0x5fd9, 0x5fdb, 0x5fdd, 0x5fe0, 0x5fe2, 0x5fe3,
    0x5fe7, 0x5fe8, 0x5fe9, 0x5feb, 0x5fec, 0x5ff4, 0x5ff6, 0x5ff8, 0x5ff9, 0x5ffb,
    0x5ffd, 0x5fff, 0x6000, 0x6001, 0x6004, 0x6006, 0x600b, 0x600d, 0x6010, 0x6011, 0x6013,
    0x0f01, 0x6017, OUTER_RET,
  ]);
  assert.equal(m.pc, OUTER_RET, "ret lands on the outer frame");
  assert.deepEqual(m.calls, [0x0f01], "one loc_0f01 call");
  assert.equal(m.regs.af, IMMEDIATE_RET, "pop af discarded the caller frame");
  assert.equal(m.mem.read8(0x8c91), 0x01, "first record cell flagged");
  assert.equal(m.mem.read8(0x8c97), 0x01, "second cell (0x8c91+6) flagged");
  assert.equal(m.regs.sp, BASELINE, "both seated frames consumed -> baseline");
});

test("loc_5fa2 Path C2: full hit, 881f==0 (e=0xfb) + X-low!=0x48 -> 0x8ca9 branch", () => {
  const m = makeMachine();
  seatTwo(m);
  // e=0xfb (881f==0). dx: (iy+0) - ((ix+0)+0xfb) = 0x0b-0x0b = 0. dy = 0. C=0.
  // iy=0x8b00 -> X-low 0x00 != 0x48 -> jr z not taken -> HL=0x8ca9.
  seatSlot(m, { c: 0x00, iy: 0x8b00, s881f: 0x00, slotX: 0x10, slotY: 0x20, tgtX: 0x0b, tgtY: 0x20 });

  loc_5fa2(m);

  assert.equal(m.tstates, 476, "Path C2 T total");
  assert.deepEqual(m.pcSeq, [
    0x5fa3, 0x5fa4, 0x5fa6, 0x5fa7, 0x5fa8, 0x5fa9, 0x5faa, 0x5fab, 0x5fad, 0x5faf,
    0x5fb1, 0x5fb4, 0x5fb5, 0x5fb7, 0x5fb9, 0x5fbc, 0x5fbd, 0x5fbe, 0x5fc1, 0x5fc3, 0x5fc4, 0x5fc7, 0x5fc8,
    0x5fcc, 0x5fcd, 0x5fce, 0x5fd0, 0x5fd1, 0x5fd9, 0x5fdb, 0x5fdd, 0x5fe0, 0x5fe2, 0x5fe3,
    0x5fe7, 0x5fe8, 0x5fe9, 0x5feb, 0x5fec, 0x5ff4, 0x5ff6, 0x5ff8, 0x5ff9, 0x5ffb,
    0x5ffd, 0x5fff, 0x6000, 0x6001, 0x6004, 0x6006, 0x6008, 0x600b, 0x600d, 0x6010, 0x6011, 0x6013,
    0x0f01, 0x6017, OUTER_RET,
  ]);
  assert.equal(m.pc, OUTER_RET);
  assert.deepEqual(m.calls, [0x0f01]);
  assert.equal(m.mem.read8(0x8ca9), 0x01, "0x8ca9 branch cell flagged");
  assert.equal(m.mem.read8(0x8caf), 0x01, "0x8ca9+6 flagged");
  assert.equal(m.regs.sp, BASELINE);
});

test("loc_5fa2 Path D: C==3, dx>=0x10 -> miss at 0x5fd5", () => {
  const m = makeMachine();
  seatOne(m);
  // dx = (iy+0)-((ix+0)+6) = 0x36-0x16 = 0x20 (nc, no neg). C=3 -> cp 0x10 -> nc -> exit.
  seatSlot(m, { c: 0x03, slotX: 0x10, tgtX: 0x36 });

  loc_5fa2(m);

  assert.equal(m.tstates, 228, "Path D T total");
  assert.deepEqual(m.pcSeq, [
    ...PRE_DX, 0x5fcc, 0x5fcd, 0x5fce, 0x5fd0, 0x5fd1, 0x5fd3, 0x5fd5, 0x6018,
  ]);
  assert.equal(m.pc, 0x6018);
  assert.deepEqual(m.calls, [0x6018]);
  assert.equal(m.regs.sp, BASELINE);
});

test("loc_5fa2 Path E: C!=3, dx>=0x08 via neg -> miss at 0x5fdb", () => {
  const m = makeMachine();
  seatOne(m);
  // sub e borrows -> neg. dx = |0x16-0x26| = 0x10 (>=8). C=0 -> cp 0x08 -> nc -> exit.
  seatSlot(m, { c: 0x00, slotX: 0x20, tgtX: 0x16 });

  loc_5fa2(m);

  assert.equal(m.tstates, 236, "Path E T total");
  assert.deepEqual(m.pcSeq, [
    ...PRE_DX, 0x5fca, 0x5fcc, 0x5fcd, 0x5fce, 0x5fd0, 0x5fd1, 0x5fd9, 0x5fdb, 0x6018,
  ]);
  assert.equal(m.pc, 0x6018);
  assert.deepEqual(m.calls, [0x6018]);
  assert.equal(m.regs.sp, BASELINE);
});

test("loc_5fa2 Path F: C==3, dy>=0x12 -> miss at 0x5ff0", () => {
  const m = makeMachine();
  seatOne(m);
  // dx=0 (pass, C==3 cp 0x10 borrow -> jr 5fdd). dy=(iy+2)-(ix+2)=0x40-0x20=0x20 (nc) >=0x12 -> exit.
  seatSlot(m, { c: 0x03, slotX: 0x10, slotY: 0x20, tgtX: 0x16, tgtY: 0x40 });

  loc_5fa2(m);

  assert.equal(m.tstates, 322, "Path F T total");
  assert.deepEqual(m.pcSeq, [
    ...PRE_DX,
    0x5fcc, 0x5fcd, 0x5fce, 0x5fd0, 0x5fd1, 0x5fd3, 0x5fd5, 0x5fd7, 0x5fdd, 0x5fe0, 0x5fe2, 0x5fe3,
    0x5fe7, 0x5fe8, 0x5fe9, 0x5feb, 0x5fec, 0x5fee, 0x5ff0, 0x6018,
  ]);
  assert.equal(m.pc, 0x6018);
  assert.deepEqual(m.calls, [0x6018]);
  assert.equal(m.regs.sp, BASELINE);
});

test("loc_5fa2 Path G: C!=3, dy>=0x08 via neg -> miss at 0x5ff6", () => {
  const m = makeMachine();
  seatOne(m);
  // dx=0 (pass, C!=3 cp 0x08 borrow -> 5fdd). dy: (iy+2)+8-((ix+2)+8) borrows -> neg -> 0x10 >=8 -> exit.
  seatSlot(m, { c: 0x00, slotX: 0x10, slotY: 0x30, tgtX: 0x16, tgtY: 0x20 });

  loc_5fa2(m);

  assert.equal(m.tstates, 323, "Path G T total");
  assert.deepEqual(m.pcSeq, [
    ...PRE_DX,
    0x5fcc, 0x5fcd, 0x5fce, 0x5fd0, 0x5fd1, 0x5fd9, 0x5fdb, 0x5fdd, 0x5fe0, 0x5fe2, 0x5fe3, 0x5fe5,
    0x5fe7, 0x5fe8, 0x5fe9, 0x5feb, 0x5fec, 0x5ff4, 0x5ff6, 0x6018,
  ]);
  assert.equal(m.pc, 0x6018);
  assert.deepEqual(m.calls, [0x6018]);
  assert.equal(m.regs.sp, BASELINE);
});

test("loc_5fa2 Path H: C==3 full hit -> loc_6025 marks 0x8d45, tail-jump boundary 0x613d", () => {
  const m = makeMachine();
  seatOne(m);
  // dx=0, dy=0, C=3 -> reach 0x5ff8; cp 0x03 == Z -> jr z 0x6025.
  seatSlot(m, { c: 0x03, slotX: 0x10, slotY: 0x20, tgtX: 0x16, tgtY: 0x20 });
  m.mem.write8(0x8d45, 0x07);

  loc_5fa2(m);

  assert.equal(m.tstates, 408, "Path H T total");
  assert.deepEqual(m.pcSeq, [
    ...PRE_DX,
    0x5fcc, 0x5fcd, 0x5fce, 0x5fd0, 0x5fd1, 0x5fd3, 0x5fd5, 0x5fd7, 0x5fdd, 0x5fe0, 0x5fe2, 0x5fe3,
    0x5fe7, 0x5fe8, 0x5fe9, 0x5feb, 0x5fec, 0x5fee, 0x5ff0, 0x5ff2, 0x5ff8, 0x5ff9, 0x5ffb,
    0x6025, 0x6026, 0x6028, 0x602b, 0x602c, 0x613d,
  ]);
  assert.equal(m.pc, 0x613d, "tail-jump to the untranslated boundary");
  assert.deepEqual(m.calls, [0x613d]);
  assert.equal(m.regs.iy, 0x8ae0, "pop iy loaded HL (the slot ptr) into IY");
  assert.equal(m.mem.read8(0x8d45), 0x08, "0x8d45 incremented");
  assert.equal(m.regs.sp, BASELINE, "tail jump unwinds to baseline");
});

test("loc_5fa2 MUTATION: `ld a,(ix+0)` mis-charged 15T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5fbc ? 15 : cycles);
  seatTwo(m);
  seatSlot(m, { c: 0x00, iy: 0x8848, slotX: 0x10, slotY: 0x20, tgtX: 0x16, tgtY: 0x20 });

  loc_5fa2(m);

  assert.equal(m.tstates, 465, "mutation loses 4 T (19 -> 15)");
  assert.throws(
    () => assert.equal(m.tstates, 469, "Path C T total"),
    /469/,
    "the 469-T golden must fail on the mutant",
  );
});
