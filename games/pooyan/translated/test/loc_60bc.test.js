// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_60bc (ROM 0x60bc, Pooyan) -- the tail of loc_6080's hit handler,
 * running on loc_6080's frame. It scans the record table at IY (stride DE, count C) for a byte at
 * +0x14 matching A. On a match whose state byte +0x16 has bit1 set AND 0x8d44 == 3 it flags the
 * I-parity-selected 0x8c90/0x8ca8 pair (loc_0f01) and SKIP-RETURNS one frame above loc_6080 (`pop af`
 * drops loc_6080's return). Every other outcome falls to the main path: HL -= 0x14, mark the I-parity
 * 0x8d1c slot, run loc_619f, tail-jump loc_611f (no push16 -- frame reuse).
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`); none
 * of loc_619f/loc_0f01/loc_611f leave a register loc_60bc reads afterward, so they are pop-only. Because
 * the mock pops, a call site missing its push16 desyncs the stack -- so the SP/pc teeth below bite.
 *
 * SKIP-A (match, bit1 set, 0x8d44!=3, I!=0 -> ix=0x8ca8): full 0x60ff branch, two-frame skip-return. T=209.
 * SKIP-B (same, I==0 -> ix=0x8c90): the other ld-a,i branch. T=200.
 * MAIN-SCAN (no match, 6 records exhausted, I!=0 keeps 0x8d1c): scan loop x6 + tail jp 0x611f. T=473.
 * MAIN-BITCLR (match, bit1 clear, I==0 -> dec iy to 0x8d1b): main via jr z + dec-iy branch. T=192.
 * MAIN-CP3 (match, bit1 set, 0x8d44==3): jr nz not taken, main path fall-through. T=209.
 * TOOTH: mis-charge `bit 1,(iy+0x16)` (20 T) as 12 T -> the 192-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_60bc.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_60bc } from "../loc_60bc.js";

const CALLER_RET = 0x608a; // loc_6080's return address on the shared frame; `pop af` discards it
const GRANDRET = 0xabcd;   // one level above loc_6080; the skip-return `ret` lands here
const IY0 = 0x8ae0;        // record table base (set by loc_6080)
const STRIDE = 0x0018;     // DE at entry (d=0x00, e=0x18)

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x60bc, pcSeq: [],
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
    // The callee's `ret` pops the return address the call site pushed -- model that pop so the stack
    // stays balanced (a missing push16 then desyncs SP/pc). loc_619f/loc_0f01/loc_611f are pop-only:
    // loc_60bc reads no register they return.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      return undefined;
    },
  };
}

// Entry state loc_6080 leaves: IY=table base, DE=stride, C=6 records, A=compare byte, HL for the main
// path's `add hl,0xffec`. `i` drives every `ld a,i` (Z when I==0). Seat one frame for a tail-jp path.
function seatEntry(m, { a, hl = 0x9000, i = 0x00, twoFrames = false }) {
  m.regs.sp = 0x8780;
  if (twoFrames) m.push16(GRANDRET); // deeper: the skip-return `ret` lands here
  m.push16(CALLER_RET);              // top: loc_6080's return, `pop af`/tail-callee `ret` consumes it
  m.regs.iy = IY0;
  m.regs.de = STRIDE;
  m.regs.c = 0x06;
  m.regs.a = a;
  m.regs.hl = hl;
  m.regs.i = i;
}

const rec = (n) => (IY0 + n * STRIDE) & 0xffff;

test("loc_60bc SKIP-A: match, bit1 set, 0x8d44!=3, I!=0 -> ix=0x8ca8, two-frame skip-return", () => {
  const m = makeMachine();
  seatEntry(m, { a: 0x42, i: 0x40, twoFrames: true }); // I!=0 -> ld a,i NZ
  m.mem.write8(rec(0) + 0x14, 0x42); // record 0 matches on iteration 1
  m.mem.write8(rec(0) + 0x16, 0x02); // state bit1 set
  m.mem.write8(0x8d44, 0x05);        // != 3 -> jr nz to 0x60ff

  loc_60bc(m);

  assert.equal(m.tstates, 209, "SKIP-A T-state total");
  assert.deepEqual(m.pcSeq, [
    0x60bf, 0x60c8, 0x60cc, 0x60ce, 0x60d1, 0x60d3, 0x60ff,
    0x6103, 0x6105, 0x6107, 0x610b, 0x610f, 0x6113,
    0x0f01,      // call 0x0f01 -> target
    0x6117,      // pop af (drops CALLER_RET)
    GRANDRET,    // ret lands one frame above loc_6080
  ], "0x60ff branch, ld a,i NZ keeps ix=0x8ca8, skip-return to GRANDRET");
  assert.equal(m.pc, GRANDRET, "skip-return lands one frame above loc_6080");
  assert.deepEqual(m.calls, [0x0f01], "only loc_0f01");
  assert.equal(m.mem.read8(0x8ca9), 0x01, "(ix+0x01)=1 on 0x8ca8");
  assert.equal(m.mem.read8(0x8caf), 0x01, "(ix+0x07)=1 on 0x8ca8");
  assert.equal(m.mem.read8(0x8c91), 0x00, "0x8c90 pair untouched");
  // pop af discarded CALLER_RET; the final ret consumed GRANDRET -> both frames gone, SP at baseline.
  assert.equal(m.regs.sp, 0x8780, "two frames consumed -> stack back to pre-seat baseline");
});

test("loc_60bc SKIP-B: same match, I==0 -> ld a,i Z keeps ix=0x8c90", () => {
  const m = makeMachine();
  seatEntry(m, { a: 0x42, i: 0x00, twoFrames: true }); // I==0 -> ld a,i Z
  m.mem.write8(rec(0) + 0x14, 0x42);
  m.mem.write8(rec(0) + 0x16, 0x02);
  m.mem.write8(0x8d44, 0x05);

  loc_60bc(m);

  assert.equal(m.tstates, 200, "SKIP-B T-state total (jr z,0x610b taken)");
  assert.deepEqual(m.pcSeq, [
    0x60bf, 0x60c8, 0x60cc, 0x60ce, 0x60d1, 0x60d3, 0x60ff,
    0x6103, 0x6105, 0x610b, 0x610f, 0x6113,
    0x0f01, 0x6117, GRANDRET,
  ], "ld a,i Z takes jr z,0x610b -> ix stays 0x8c90");
  assert.equal(m.pc, GRANDRET);
  assert.equal(m.mem.read8(0x8c91), 0x01, "(ix+0x01)=1 on 0x8c90");
  assert.equal(m.mem.read8(0x8c97), 0x01, "(ix+0x07)=1 on 0x8c90");
  assert.equal(m.mem.read8(0x8ca9), 0x00, "0x8ca8 pair untouched");
  assert.equal(m.regs.sp, 0x8780, "two frames consumed -> baseline");
});

test("loc_60bc MAIN-SCAN: no match, 6 records exhausted, I!=0 keeps 0x8d1c, tail jp 0x611f", () => {
  const m = makeMachine();
  seatEntry(m, { a: 0xff, hl: 0x9000, i: 0x40 }); // no record's +0x14 byte is 0xff (RAM defaults 0)
  // one seated frame (tail path); records left zero so `cp (iy+0x14)` never hits Z

  loc_60bc(m);

  assert.equal(m.tstates, 473, "MAIN-SCAN T-state total (5 loop-backs + exhausting iter + main)");
  assert.deepEqual(m.pcSeq, [
    0x60bf, 0x60c1, 0x60c3, 0x60c4, 0x60bc,
    0x60bf, 0x60c1, 0x60c3, 0x60c4, 0x60bc,
    0x60bf, 0x60c1, 0x60c3, 0x60c4, 0x60bc,
    0x60bf, 0x60c1, 0x60c3, 0x60c4, 0x60bc,
    0x60bf, 0x60c1, 0x60c3, 0x60c4, 0x60bc,
    0x60bf, 0x60c1, 0x60c3, 0x60c4, 0x60c6, 0x60d5, // 6th iter: dec c -> 0, jr 0x60d5
    0x60d8, 0x60d9, 0x60dd, 0x60df, 0x60e3, 0x60e7, 0x60ea,
    0x619f, 0x60f0, 0x611f,
  ], "full 6-record scan then main path, ld a,i NZ skips dec iy");
  assert.equal(m.pc, 0x611f, "tail jp lands on 0x611f");
  assert.deepEqual(m.calls, [0x619f, 0x611f], "loc_619f then tail loc_611f");
  assert.equal(m.regs.c, 0x00, "C decremented to 0 over 6 records");
  assert.equal(m.mem.read8(0x8d1c), 0x01, "(iy+0)=1 with iy kept at 0x8d1c");
  assert.equal(m.mem.read8(0x8d1b), 0x00, "no dec iy");
  assert.equal(m.regs.hl, 0x8fec, "HL backed up 0x14 (0x9000 + 0xffec)");
  assert.equal(m.regs.de, 0xfffd, "DE = 0xfffd loaded before the tail jump");
  // Tail jp 0x611f: loc_611f's ret pops the single seated CALLER_RET -> SP to the pre-seat baseline.
  assert.equal(m.regs.sp, 0x8780, "one frame consumed by the tail callee's ret -> pre-seat baseline");
});

test("loc_60bc MAIN-BITCLR: match, bit1 clear -> jr z main, I==0 -> dec iy to 0x8d1b", () => {
  const m = makeMachine();
  seatEntry(m, { a: 0x42, hl: 0x9000, i: 0x00 }); // I==0 -> ld a,i Z -> dec iy
  m.mem.write8(rec(0) + 0x14, 0x42); // match iteration 1
  m.mem.write8(rec(0) + 0x16, 0x00); // bit1 clear -> jr z,0x60d5

  loc_60bc(m);

  assert.equal(m.tstates, 192, "MAIN-BITCLR T-state total");
  assert.deepEqual(m.pcSeq, [
    0x60bf, 0x60c8, 0x60cc, 0x60d5,
    0x60d8, 0x60d9, 0x60dd, 0x60df, 0x60e1, 0x60e3, 0x60e7, 0x60ea,
    0x619f, 0x60f0, 0x611f,
  ], "bit1 clear -> main; ld a,i Z -> dec iy branch");
  assert.equal(m.pc, 0x611f);
  assert.equal(m.mem.read8(0x8d1b), 0x01, "(iy+0)=1 with iy decremented to 0x8d1b");
  assert.equal(m.mem.read8(0x8d1c), 0x00, "0x8d1c not written (iy was decremented)");
  assert.equal(m.regs.sp, 0x8780, "tail callee consumed the seated frame -> baseline");
});

test("loc_60bc MAIN-CP3: match, bit1 set, 0x8d44==3 -> jr nz not taken, main fall-through", () => {
  const m = makeMachine();
  seatEntry(m, { a: 0x42, hl: 0x9000, i: 0x40 }); // I!=0 -> keep 0x8d1c
  m.mem.write8(rec(0) + 0x14, 0x42);
  m.mem.write8(rec(0) + 0x16, 0x02); // bit1 set
  m.mem.write8(0x8d44, 0x03);        // == 3 -> jr nz NOT taken -> fall to 0x60d5

  loc_60bc(m);

  assert.equal(m.tstates, 209, "MAIN-CP3 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x60bf, 0x60c8, 0x60cc, 0x60ce, 0x60d1, 0x60d3, 0x60d5,
    0x60d8, 0x60d9, 0x60dd, 0x60df, 0x60e3, 0x60e7, 0x60ea,
    0x619f, 0x60f0, 0x611f,
  ], "0x8d44==3 falls through to the main path");
  assert.equal(m.pc, 0x611f);
  assert.deepEqual(m.calls, [0x619f, 0x611f]);
  assert.equal(m.mem.read8(0x8d1c), 0x01, "(iy+0)=1, iy kept at 0x8d1c");
  assert.equal(m.regs.sp, 0x8780, "baseline");
});

test("loc_60bc MUTATION: `bit 1,(iy+0x16)` mis-charged 12T (not 20T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x60cc ? 12 : cycles);
  seatEntry(m, { a: 0x42, hl: 0x9000, i: 0x00 });
  m.mem.write8(rec(0) + 0x14, 0x42);
  m.mem.write8(rec(0) + 0x16, 0x00);

  loc_60bc(m);

  assert.equal(m.tstates, 184, "mutation loses 8 T (20 -> 12)");
  assert.throws(
    () => assert.equal(m.tstates, 192, "MAIN-BITCLR T-state total"),
    /192/,
    "the 192-T golden must fail on the mutant",
  );
});
