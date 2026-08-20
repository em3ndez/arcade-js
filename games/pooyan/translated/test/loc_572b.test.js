// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_572b (ROM 0x572b, Pooyan) -- spawn-one-actor-per-scan.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`), so
 * a missing push16 desyncs the stack and the skip-return teeth below fail. It also models the two
 * helpers loc_572b consumes downstream: rst 0x20 -> loc_0020 (HL += A 16-bit; A = mem[HL]) whose
 * result feeds the (ix+9)/(ix+0a) writes, and loc_381e (writes ix+0c/0d/0e). loc_57b4 and loc_57c3
 * are black boxes (loc_57b4 is set up to bail without touching C; loc_57c3's effect is irrelevant
 * once loc_572b decides to abort the loop).
 *
 * SKIP-RETURN: after initialising a slot, loc_572b does `pop af` (discarding its OWN return address)
 * then `ret` -- returning ONE frame up to abort the caller's djnz spawn loop. The stack is seated with
 * GRAND_RET below CALLER_RET; the full paths consume BOTH (SP back to baseline, pc=GRAND_RET), while
 * the `ret c` early-out consumes only CALLER_RET (normal return, loop continues).
 *
 * Paths: FULL_A (0x8907=0, call z taken, jr-c taken twice, 57a3 branch) T=640; FULL_B (0x8907=1,
 * call z not taken, the add/clamp branches) T=643; RETC (slot live -> ret c) T=53.
 * TEETH: mis-charge `inc (hl)` (11 T) as 7 T -> the 640-T golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_572b.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_572b } from "../loc_572b.js";

const CALLER_RET = 0xabcd;
const GRAND_RET = 0x1234;
const IX = 0x8ae0;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x572b, pcSeq: [],
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
    // Each callee's ret pops the return address loc_572b pushed at the call site (or, for a missing
    // push16, the wrong word -- desyncing the stack). rst 0x20 -> loc_0020 and loc_381e are modelled
    // because loc_572b consumes their effects; loc_57b4/loc_57c3 stay opaque.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x0020) {
        const t = (regs.hl + regs.a) & 0xffff;
        regs.hl = t;
        regs.a = mem.read8(t);
      } else if (addr === 0x381e) {
        mem.write8((regs.ix + 0x0c) & 0xffff, regs.e);
        mem.write8((regs.ix + 0x0d) & 0xffff, regs.d);
        mem.write8((regs.ix + 0x0e) & 0xffff, 0x00);
      }
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(GRAND_RET);
  m.push16(CALLER_RET);
}

const PC_FULL_A = [
  0x572e, 0x5731, 0x5732, 0x5733, 0x5734, 0x5738, 0x573c, 0x573f, 0x5740, 0x5743,
  0x5746, 0x5749, 0x574c, 0x5750, 0x5753, 0x5756, 0x5759, 0x575b, 0x575d, 0x5760,
  0x5763, 0x5765, 0x5769, 0x576a, 0x576d, 0x576f, 0x5776, 0x5779, 0x577b, 0x57b4,
  0x5781, 0x5782, 0x5783, 0x5785, 0x5789, 0x578a, 0x0020, 0x578e, 0x5790, 0x5793,
  0x5796, 0x381e, 0x579c, 0x579f, 0x57a1, 0x57a3, 0x57a6, 0x57a7, 0x0020, 0x57ab,
  0x57ae, 0x57af, 0x57c3, 0x57b3, GRAND_RET,
];

function setupFullA(m) {
  seatCaller(m);
  m.regs.c = 0x40;
  m.regs.e = 0x1d;
  m.regs.ix = IX;
  m.mem.write8(IX + 0x00, 0x00);
  m.mem.write8(IX + 0x01, 0x00); // (ix+0)|(ix+1) = 0 -> rrca carry clear -> not ret c
  m.mem.write8(0x8907, 0x00);    // and 0x01 -> 0 -> 575d branch; bit 0 -> Z -> call z taken; 57a3 branch
  m.mem.write8(0x8820, 0x01);    // < 3 -> jr c taken (5769)
  m.mem.write8(0x8908, 0x02);    // < 4 -> jr c taken (5776), skip the 0x8d4c bias -> C = 1
  m.mem.write8(0x8901, 0x05);    // >= 3 -> loc_57b4 bails, C untouched
  m.mem.write8(0x5903, 0x08);    // rst 0x20 #1: hl 0x5902 + A(1) = 0x5903 -> A = 0x08
  m.mem.write8(0x58c1, 0x11);    // rst 0x20 #2: hl 0x58c0 + A(1) = 0x58c1 -> A = 0x11
  m.mem.write8(0x8d40, 0x00);
}

test("loc_572b FULL_A: empty slot -> init + skip-return (0x8907=0)", () => {
  const m = makeMachine();
  setupFullA(m);

  loc_572b(m);

  assert.equal(m.tstates, 640, "FULL_A T-state total");
  assert.deepEqual(m.pcSeq, PC_FULL_A, "step boundaries match the ROM bytes");
  assert.equal(m.pc, GRAND_RET, "skip-return lands one frame up");
  assert.deepEqual(m.calls, [0x57b4, 0x0020, 0x381e, 0x0020, 0x57c3], "call z taken + two rst + set-anim + state head");
  // slot init
  assert.equal(m.mem.read8(IX + 0x00), 0x01, "ix+0 <- 1 (slot live)");
  assert.equal(m.mem.read8(IX + 0x02), 0x03, "ix+2 <- 3");
  assert.equal(m.mem.read8(IX + 0x04), 0x1d, "ix+4 <- E");
  assert.equal(m.mem.read8(IX + 0x03), 0x00, "ix+3 <- 0");
  assert.equal(m.mem.read8(IX + 0x07), 0x01, "ix+7 <- 1");
  assert.equal(m.mem.read8(IX + 0x0b), 0x00, "ix+0b <- 0");
  assert.equal(m.mem.read8(IX + 0x09), 0x08, "ix+9 <- rst-lookup A");
  assert.equal(m.mem.read8(IX + 0x0a), 0xf8, "ix+0a <- neg(A) = 0x100-0x08");
  assert.equal(m.mem.read8(IX + 0x0c), 0x29, "ix+0c <- E from loc_381e (de=0x3829)");
  assert.equal(m.mem.read8(IX + 0x0d), 0x38, "ix+0d <- D from loc_381e");
  assert.equal(m.mem.read8(IX + 0x0e), 0x00, "ix+0e <- 0 from loc_381e");
  assert.equal(m.mem.read8(0x8d07), 0x11, "0x8d07 <- rst-lookup #2");
  assert.equal(m.mem.read8(0x8d40), 0x01, "0x8d40 incremented");
  // skip-return stack tooth: pop af discards CALLER_RET, ret consumes GRAND_RET -> baseline
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound past BOTH seated returns");
});

const PC_FULL_B = [
  0x572e, 0x5731, 0x5732, 0x5733, 0x5734, 0x5738, 0x573c, 0x573f, 0x5740, 0x5743,
  0x5746, 0x5749, 0x574c, 0x5750, 0x5753, 0x5756, 0x5759, 0x575b, 0x5760, 0x5763,
  0x5765, 0x5767, 0x5769, 0x576a, 0x576d, 0x576f, 0x5771, 0x5774, 0x5775, 0x5776,
  0x5779, 0x577b, 0x577e, 0x5781, 0x5782, 0x5783, 0x5785, 0x5787, 0x5789, 0x578a,
  0x0020, 0x578e, 0x5790, 0x5793, 0x5796, 0x381e, 0x579c, 0x579f, 0x57a1, 0x57a6,
  0x57a7, 0x0020, 0x57ab, 0x57ae, 0x57af, 0x57c3, 0x57b3, GRAND_RET,
];

test("loc_572b FULL_B: empty slot, opposite branches (0x8907=1)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.c = 0x40;
  m.regs.e = 0x04;
  m.regs.ix = IX;
  m.mem.write8(IX + 0x00, 0x00);
  m.mem.write8(IX + 0x01, 0x00); // not ret c
  m.mem.write8(0x8907, 0x01);    // and 1 -> nz -> 5760 branch; bit 0 -> nz -> call z NOT taken; 57a6 branch
  m.mem.write8(0x8820, 0x10);    // >= 3 -> jr c not taken -> A=3 -> C=3
  m.mem.write8(0x8908, 0x10);    // >= 4 -> jr c not taken -> add 0x8d4c bias
  m.mem.write8(0x8d4c, 0x30);    // A = 0x30 + C(3) = 0x33 -> C = 0x33
  m.mem.write8(0x58ff, 0x0a);    // rst #1: hl 0x58e0 + A(0x1f) = 0x58ff -> A = 0x0a
  m.mem.write8(0x58ba, 0x22);    // rst #2: hl 0x589b + A(0x1f) = 0x58ba -> A = 0x22
  m.mem.write8(0x8d40, 0x00);

  loc_572b(m);

  assert.equal(m.tstates, 643, "FULL_B T-state total");
  assert.deepEqual(m.pcSeq, PC_FULL_B, "step boundaries (opposite branches)");
  assert.equal(m.pc, GRAND_RET, "skip-return");
  assert.deepEqual(m.calls, [0x0020, 0x381e, 0x0020, 0x57c3], "call z NOT taken -> no loc_57b4");
  // C reached 0x1f (clamped at the 5785 branch: 0x34 >= 0x20 -> ld a,0x1f)
  assert.equal(m.mem.read8(IX + 0x09), 0x0a, "ix+9 <- rst #1 with A=0x1f index");
  assert.equal(m.mem.read8(IX + 0x0a), 0xf6, "ix+0a <- neg(0x0a)");
  assert.equal(m.mem.read8(IX + 0x04), 0x04, "ix+4 <- E");
  assert.equal(m.mem.read8(0x8d07), 0x22, "0x8d07 <- rst #2");
  assert.equal(m.regs.sp, 0x8780, "skip-return unwinds both seated returns");
});

test("loc_572b RETC: live slot -> ret c (normal return, loop continues)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x00, 0x01); // (ix+0)|(ix+1) = 1 -> rrca -> carry set -> ret c
  m.mem.write8(IX + 0x01, 0x00);

  loc_572b(m);

  assert.equal(m.tstates, 19 + 19 + 4 + 11, "ld a + or + rrca + ret c");
  assert.deepEqual(m.pcSeq, [0x572e, 0x5731, 0x5732, CALLER_RET], "returns to the DIRECT caller");
  assert.equal(m.pc, CALLER_RET, "ret c -> caller (not a skip-return)");
  assert.deepEqual(m.calls, [], "no init work");
  assert.equal(m.mem.read8(IX + 0x00), 0x01, "slot untouched");
  assert.equal(m.regs.sp, 0x877e, "only CALLER_RET consumed; GRAND_RET still seated");
});

test("loc_572b MUTATION: `inc (hl)` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x57af ? 7 : cycles);
  setupFullA(m);

  loc_572b(m);

  assert.equal(m.tstates, 636, "mutation loses 4 T (11 -> 7)");
  assert.throws(() => assert.equal(m.tstates, 640, "FULL_A golden"), /640/);
});
