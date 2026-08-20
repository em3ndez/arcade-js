// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_57c6 (ROM 0x57c6, Pooyan) -- the eagle sub-state stepper / re-arm.
 * Counter (0x8d46) in 1..6 decrements the first non-zero byte of the 3-byte sub-state block and latches
 * the move dir/speed into (ix+0x13)/(ix+0x16), returning at each stage. Counter 0 or >=7 falls to the
 * re-arm (0x57fa): reset the counter, pick table 0x5922 (0x8907 bit0 set) or 0x5985 (clear), index by
 * 3*clamped-position via rst 0x20 (loc_0020), copy the 3-byte record into the sub-state block, tail-jp
 * to loc_57c3. The mock's `call` POPS (models loc_0020's ret / the tail's frame reuse); loc_0020's
 * register effect (HL += A, A = (HL)) is modelled so the copied bytes are meaningful. A missing push16
 * before rst 0x20 then makes the copy consume the seated caller return -> SP tooth (positive control).
 *
 * Cases: STAGE1/2/3-active + STAGE3-zero(ret z) cover the 1..6 decrement ladder; REARM-A (counter 0,
 * bit0 set, table 0x5922, no clamp), REARM-F (counter>=7, bit0 clear, table 0x5985, clamp), REARM-G
 * (0x5922 with clamp), REARM-H (0x5985 no clamp) cover the re-arm branches. MUTATION mis-charges rst 0x20.
 *
 * Run: node --test games/pooyan/translated/test/loc_57c6.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_57c6 } from "../loc_57c6.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x57c6, pcSeq: [],
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
    // rst 0x20 -> loc_0020 ret pops the pushed 0x5819; loc_0020 also does HL += A, A = (HL).
    // Tail jp 0x57c3 reuses the frame -> its callee ret pops the seated caller return.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x0020) { regs.hl = (regs.hl + regs.a) & 0xffff; regs.a = mem.read8(regs.hl); }
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

// add a,a; add a,c; rst 0x20; <9-byte copy>; ld b,0xff; jp 0x57c3 -- shared re-arm tail (starts at 0x5817).
const IDX_COPY = [
  0x5817, 0x5818, 0x0020,
  0x581a, 0x581b, 0x581c, 0x581d, 0x581e, 0x581f, 0x5820, 0x5821, 0x5822, 0x5823,
  0x5825, 0x57c3,
];

test("loc_57c6 STAGE1: 0<counter<7, sub-state[0] active -> dir=2/spd=1, ret 0x57e0", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.mem.write8(0x8d46, 0x03); // counter in 1..6
  m.mem.write8(0x8d47, 0x05); // stage 1 non-zero

  loc_57c6(m);

  assert.equal(m.tstates, 134, "STAGE1 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x57c9, 0x57ca, 0x57cb, 0x57cd, 0x57cf, 0x57d1,
    0x57d2, 0x57d3, 0x57d4, 0x57d5, 0x57d7, 0x57d8, 0x57dc, 0x57e0, CALLER_RET,
  ]);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x8d46), 0x04, "counter incremented");
  assert.equal(m.mem.read8(0x8d47), 0x04, "stage 1 decremented");
  assert.equal(m.mem.read8(0x8b13), 0x02, "(ix+0x13) dir = 2");
  assert.equal(m.mem.read8(0x8b16), 0x01, "(ix+0x16) spd = 1");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
});

test("loc_57c6 STAGE2: stage1 zero, stage2 active -> dir=1/spd=0xc1, ret 0x57ef", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.mem.write8(0x8d46, 0x03);
  m.mem.write8(0x8d47, 0x00);
  m.mem.write8(0x8d48, 0x05);

  loc_57c6(m);

  assert.equal(m.tstates, 161, "STAGE2 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x57c9, 0x57ca, 0x57cb, 0x57cd, 0x57cf, 0x57d1,
    0x57d2, 0x57d3, 0x57d4, 0x57d5, 0x57e1,
    0x57e2, 0x57e3, 0x57e4, 0x57e6, 0x57e7, 0x57eb, 0x57ef, CALLER_RET,
  ]);
  assert.equal(m.mem.read8(0x8d48), 0x04, "stage 2 decremented");
  assert.equal(m.mem.read8(0x8b13), 0x01, "(ix+0x13) dir = 1");
  assert.equal(m.mem.read8(0x8b16), 0xc1, "(ix+0x16) spd = 0xc1");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_57c6 STAGE3-active: stage1/2 zero, stage3 active -> spd=0x41, ret 0x57f9", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.mem.write8(0x8d46, 0x03);
  m.mem.write8(0x8d47, 0x00);
  m.mem.write8(0x8d48, 0x00);
  m.mem.write8(0x8d49, 0x05);

  loc_57c6(m);

  assert.equal(m.tstates, 167, "STAGE3-active T-state total");
  assert.deepEqual(m.pcSeq, [
    0x57c9, 0x57ca, 0x57cb, 0x57cd, 0x57cf, 0x57d1,
    0x57d2, 0x57d3, 0x57d4, 0x57d5, 0x57e1,
    0x57e2, 0x57e3, 0x57e4, 0x57f0,
    0x57f1, 0x57f2, 0x57f3, 0x57f4, 0x57f5, 0x57f9, CALLER_RET,
  ]);
  assert.equal(m.mem.read8(0x8d49), 0x04, "stage 3 decremented");
  assert.equal(m.mem.read8(0x8b16), 0x41, "(ix+0x16) spd = 0x41");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_57c6 STAGE3-zero: all three sub-states zero -> ret z at 0x57f3 (no write)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.mem.write8(0x8d46, 0x03);
  m.mem.write8(0x8d47, 0x00);
  m.mem.write8(0x8d48, 0x00);
  m.mem.write8(0x8d49, 0x00);

  loc_57c6(m);

  assert.equal(m.tstates, 133, "STAGE3-zero T-state total");
  assert.deepEqual(m.pcSeq, [
    0x57c9, 0x57ca, 0x57cb, 0x57cd, 0x57cf, 0x57d1,
    0x57d2, 0x57d3, 0x57d4, 0x57d5, 0x57e1,
    0x57e2, 0x57e3, 0x57e4, 0x57f0,
    0x57f1, 0x57f2, 0x57f3, CALLER_RET,
  ]);
  assert.equal(m.mem.read8(0x8d49), 0x00, "stage 3 untouched (ret before dec)");
  assert.equal(m.mem.read8(0x8b16), 0x00, "(ix+0x16) unwritten");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_57c6 REARM-A: counter 0, 0x8907 bit0 set -> table 0x5922, no clamp, tail loc_57c3", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d46, 0x00);   // counter 0 -> re-arm
  m.mem.write8(0x8907, 0x01);   // bit0 set -> 0x5922 branch
  m.mem.write8(0x8900, 0x02);
  m.mem.write8(0x8d4c, 0x03);   // sum 0x05 < 0x20 -> no clamp
  m.mem.write8(0x5931, 0xaa);   // record at 0x5922 + 3*5 = 0x5931
  m.mem.write8(0x5932, 0xbb);
  m.mem.write8(0x5933, 0xcc);

  loc_57c6(m);

  assert.equal(m.tstates, 243, "REARM-A T-state total");
  assert.deepEqual(m.pcSeq, [
    0x57c9, 0x57ca, 0x57cb, 0x57fa, 0x57fc, 0x57ff, 0x5801, 0x5803,
    0x5806, 0x5807, 0x580a, 0x580b, 0x580d, 0x5811, 0x5812, 0x5813, 0x5816,
  ].concat(IDX_COPY));
  assert.equal(m.pc, 0x57c3, "tail jp lands on loc_57c3");
  assert.deepEqual(m.calls, [0x0020, 0x57c3]);
  assert.equal(m.mem.read8(0x8d46), 0x01, "counter reset to 1");
  assert.equal(m.mem.read8(0x8d47), 0xaa, "record byte 0 copied");
  assert.equal(m.mem.read8(0x8d48), 0xbb, "record byte 1 copied");
  assert.equal(m.mem.read8(0x8d49), 0xcc, "record byte 2 copied");
  assert.equal(m.regs.b, 0xff, "B = 0xff for loc_57c3");
  assert.equal(m.regs.sp, 0x8780, "rst push matched loc_0020 ret; tail consumed caller return");
});

test("loc_57c6 REARM-G: 0x5922 branch WITH clamp (sum >= 0x20 -> 0x1f)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d46, 0x00);
  m.mem.write8(0x8907, 0x01);   // bit0 set -> 0x5922 branch
  m.mem.write8(0x8900, 0x10);
  m.mem.write8(0x8d4c, 0x15);   // sum 0x25 >= 0x20 -> clamp to 0x1f
  m.mem.write8(0x597f, 0x11);   // record at 0x5922 + 3*0x1f = 0x597f
  m.mem.write8(0x5980, 0x22);
  m.mem.write8(0x5981, 0x33);

  loc_57c6(m);

  assert.equal(m.tstates, 245, "REARM-G T-state total");
  assert.deepEqual(m.pcSeq, [
    0x57c9, 0x57ca, 0x57cb, 0x57fa, 0x57fc, 0x57ff, 0x5801, 0x5803,
    0x5806, 0x5807, 0x580a, 0x580b, 0x580d, 0x580f, 0x5811, 0x5812, 0x5813, 0x5816,
  ].concat(IDX_COPY));
  assert.equal(m.mem.read8(0x8d47), 0x11, "clamped index record byte 0");
  assert.equal(m.mem.read8(0x8d48), 0x22);
  assert.equal(m.mem.read8(0x8d49), 0x33);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_57c6 REARM-F: counter>=7, 0x8907 bit0 clear -> table 0x5985, clamp", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d46, 0x08);   // counter >= 7 -> jr nc re-arm
  m.mem.write8(0x8907, 0x24);   // bit0 clear, 0x24 >= 0x20 -> clamp
  m.mem.write8(0x59e2, 0x11);   // record at 0x5985 + 3*0x1f = 0x59e2
  m.mem.write8(0x59e3, 0x22);
  m.mem.write8(0x59e4, 0x33);

  loc_57c6(m);

  assert.equal(m.tstates, 242, "REARM-F T-state total");
  assert.deepEqual(m.pcSeq, [
    0x57c9, 0x57ca, 0x57cb, 0x57cd, 0x57cf, 0x57fa, 0x57fc, 0x57ff, 0x5801, 0x5828,
    0x582a, 0x582c, 0x582e, 0x582f, 0x5830, 0x5833, 0x5816,
  ].concat(IDX_COPY));
  assert.equal(m.pc, 0x57c3);
  assert.deepEqual(m.calls, [0x0020, 0x57c3]);
  assert.equal(m.mem.read8(0x8d46), 0x01, "counter reset");
  assert.equal(m.mem.read8(0x8d47), 0x11, "0x5985 record byte 0");
  assert.equal(m.mem.read8(0x8d48), 0x22);
  assert.equal(m.mem.read8(0x8d49), 0x33);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_57c6 REARM-H: 0x5985 branch, no clamp (position 0)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d46, 0x08);
  m.mem.write8(0x8907, 0x00);   // bit0 clear, 0x00 < 0x20 -> no clamp
  m.mem.write8(0x5985, 0x44);   // record at 0x5985 + 0 = 0x5985
  m.mem.write8(0x5986, 0x55);
  m.mem.write8(0x5987, 0x66);

  loc_57c6(m);

  assert.equal(m.tstates, 240, "REARM-H T-state total");
  assert.deepEqual(m.pcSeq, [
    0x57c9, 0x57ca, 0x57cb, 0x57cd, 0x57cf, 0x57fa, 0x57fc, 0x57ff, 0x5801, 0x5828,
    0x582a, 0x582e, 0x582f, 0x5830, 0x5833, 0x5816,
  ].concat(IDX_COPY));
  assert.equal(m.mem.read8(0x8d47), 0x44, "position-0 record byte 0");
  assert.equal(m.mem.read8(0x8d48), 0x55);
  assert.equal(m.mem.read8(0x8d49), 0x66);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_57c6 MUTATION: rst 0x20 mis-charged 4T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x0020 ? 4 : cycles);
  seatCaller(m);
  m.mem.write8(0x8d46, 0x00);
  m.mem.write8(0x8907, 0x01);
  m.mem.write8(0x8900, 0x02);
  m.mem.write8(0x8d4c, 0x03);

  loc_57c6(m);

  assert.equal(m.tstates, 236, "mutation loses 7 T (11 -> 4)");
  assert.throws(
    () => assert.equal(m.tstates, 243, "REARM-A T-state total"),
    /243/,
    "the 243-T golden must fail on the mutant",
  );
});
