// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_355b (ROM 0x355b, Pooyan) -- actor movement/AI step. Setup call
 * (0x4006), bail if latched (ix+8 != 0 -> 0x3757), advance X (ix+5 += ix+9, carry bumps ix+6), bail
 * while level (0x8901) < 3 (-> 0x362d). Two target-column sources keyed on (0x8d79); range gate then
 * either sit-on-column exit (0x3617), a short ret, or latch + vector dispatch tail (0x381e).
 *
 * The mock's `call` POPS the pushed return address (models the callee's ret). loc_0020 (rst 0x20)
 * also applies HL += A, A = mem[HL]; loc_0c45 sets DE = 0x3600 (a deterministic test base). Every
 * push16 (call 0x4006 / 0x0c45 / rst 0x20) is matched by a callee pop; each terminal (conditional
 * tail jp to a boundary, ret c, or tail jp 0x381e) unwinds to the pre-seat baseline -- SP-fidelity tooth.
 *
 * Paths: A exit-0x3757 (latched); B BRANCH_A + sit-on-column (jp z 0x3617); C BRANCH_A + ret c
 * (column<0x14); D BRANCH_B/bit2-clear (jr 0x359e) + X-carry (inc ix+6) + tail 0x381e w/ 0x3838;
 * E BRANCH_B/bit2-set (ld hl,(0x8d6f) + jr 0x3595) + tail 0x381e w/ 0x3856; F exit-0x362d (level<3).
 * TEETH: mis-charge `srl a` (8T) as 4T on path B -> the 304-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_355b.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_355b } from "../loc_355b.js";

const CALLER_RET = 0xabcd;
const IX = 0x9000;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x355b, pcSeq: [],
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
    // The callee's ret pops the pushed return address. loc_0020 = rst 0x20 (HL += A, A=(HL));
    // loc_0c45 selects a table entry into DE (modelled as the fixed base 0x3600). loc_4006 = no-op.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x0020) { regs.hl = (regs.hl + regs.a) & 0xffff; regs.a = mem.read8(regs.hl); }
      else if (addr === 0x0c45) { regs.de = 0x3600; }
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

function base(m) {
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8((IX + 0x08) & 0xffff, 0x00); // not latched (D1 not taken)
  m.mem.write8((IX + 0x05) & 0xffff, 0x10); // X
  m.mem.write8((IX + 0x09) & 0xffff, 0x20); // dX -> 0x30, no carry (D2 nc)
  m.mem.write8(0x8901, 0x05);               // level >= 3 (D3 not taken)
}

test("loc_355b A: already latched (ix+8 != 0) -> exit 0x3757", () => {
  const m = makeMachine();
  base(m);
  m.mem.write8((IX + 0x08) & 0xffff, 0x01); // latched -> jp nz taken

  loc_355b(m);

  assert.equal(m.tstates, 17 + 19 + 4 + 10, "call + ld + and + jp nz");
  assert.deepEqual(m.pcSeq, [0x4006, 0x3561, 0x3562, 0x3757]);
  assert.equal(m.pc, 0x3757, "tail to boundary 0x3757");
  assert.deepEqual(m.calls, [0x4006, 0x3757]);
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_355b F: level (0x8901) < 3 -> exit 0x362d", () => {
  const m = makeMachine();
  base(m);
  m.mem.write8(0x8901, 0x01); // < 3 -> jp c taken

  loc_355b(m);

  assert.equal(m.tstates, 153, "F T-state total");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x3561, 0x3562, 0x3565, 0x3568, 0x356b, 0x3570,
    0x3573, 0x3574, 0x3577, 0x3579, 0x362d,
  ]);
  assert.equal(m.pc, 0x362d, "tail to boundary 0x362d");
  assert.deepEqual(m.calls, [0x4006, 0x362d]);
  assert.equal(m.mem.read8(IX + 0x05), 0x30, "ix+5 advanced to 0x30");
  assert.equal(m.regs.sp, 0x8780);
});

const PC_B = [
  0x4006, 0x3561, 0x3562, 0x3565, 0x3568, 0x356b, 0x3570, 0x3573, 0x3574, 0x3577, 0x3579,
  0x357c, 0x357f, 0x3580, 0x3582, 0x3585, 0x3588, 0x358a, 0x358c, 0x0c45,
  0x3590, 0x3593, 0x3595, 0x0020, 0x3597, 0x359a, 0x359b, 0x3617,
];

test("loc_355b B: primary lookup, actor sits on target column -> exit 0x3617", () => {
  const m = makeMachine();
  base(m);
  m.mem.write8((IX + 0x06) & 0xffff, 0x05); // actor column
  m.mem.write8(0x8d79, 0x00);               // -> BRANCH_A (jr nz not taken)
  m.mem.write8(0x8907, 0x06);               // (>>1) -> loc_0c45 index
  m.mem.write8(0x8d41, 0x02);               // & 7 = 2 -> rst 0x20 index
  m.mem.write8(0x3602, 0x05);               // table[0x3600+2] = target column 0x05 (== ix+6)

  loc_355b(m);

  assert.equal(m.tstates, 304, "B T-state total");
  assert.deepEqual(m.pcSeq, PC_B);
  assert.equal(m.pc, 0x3617, "tail to boundary 0x3617 (on-column)");
  assert.deepEqual(m.calls, [0x4006, 0x0c45, 0x0020, 0x3617]);
  assert.equal(m.regs.c, 0x05, "C = target column");
  assert.equal(m.mem.read8(IX + 0x08), 0x00, "not latched (exited before 0x35a1)");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_355b C: primary lookup, column < 0x14 -> ret c", () => {
  const m = makeMachine();
  base(m);
  m.mem.write8((IX + 0x06) & 0xffff, 0x05); // actor column 0x05 (< 0x14)
  m.mem.write8(0x8d79, 0x00);               // BRANCH_A
  m.mem.write8(0x8907, 0x06);
  m.mem.write8(0x8d41, 0x02);
  m.mem.write8(0x3602, 0x0a);               // target 0x0a != 0x05 -> jp z not taken

  loc_355b(m);

  assert.equal(m.tstates, 322, "C T-state total");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x3561, 0x3562, 0x3565, 0x3568, 0x356b, 0x3570, 0x3573, 0x3574, 0x3577, 0x3579,
    0x357c, 0x357f, 0x3580, 0x3582, 0x3585, 0x3588, 0x358a, 0x358c, 0x0c45,
    0x3590, 0x3593, 0x3595, 0x0020, 0x3597, 0x359a, 0x359b, 0x359e, 0x35a0, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET, "ret c to seated caller");
  assert.deepEqual(m.calls, [0x4006, 0x0c45, 0x0020]);
  assert.equal(m.mem.read8(IX + 0x08), 0x00, "not latched");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_355b D: alt source, bit2 clear (jr 0x359e) + X carry -> latch, tail 0x381e w/ 0x3838", () => {
  const m = makeMachine();
  base(m);
  m.mem.write8((IX + 0x05) & 0xffff, 0xf0); // X + 0x20 = 0x110 -> carry (D2 not taken)
  m.mem.write8((IX + 0x06) & 0xffff, 0x2f); // -> inc'd to 0x30 (>= 0x14)
  m.mem.write8((IX + 0x07) & 0xffff, 0x00); // bit2 clear (jr z taken), bit1 clear (jr z taken)
  m.mem.write8(0x8d79, 0x01);               // -> BRANCH_B (jr nz taken)

  loc_355b(m);

  assert.equal(m.tstates, 346, "D T-state total");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x3561, 0x3562, 0x3565, 0x3568, 0x356b, 0x356d, 0x3570, 0x3573, 0x3574, 0x3577, 0x3579,
    0x357c, 0x357f, 0x3580, 0x35b4, 0x35b8, 0x35c2, 0x35c5, 0x359e, 0x35a0, 0x35a1,
    0x35a5, 0x35a8, 0x35ac, 0x35b1, 0x381e,
  ]);
  assert.equal(m.pc, 0x381e, "tail to loc_381e");
  assert.deepEqual(m.calls, [0x4006, 0x381e], "no lookup calls on the bit2-clear branch");
  assert.equal(m.mem.read8(IX + 0x05), 0x10, "ix+5 = 0x110 & 0xff");
  assert.equal(m.mem.read8(IX + 0x06), 0x30, "ix+6 incremented by X carry");
  assert.equal(m.mem.read8(IX + 0x08), 0x01, "actor latched");
  assert.equal(m.regs.de, 0x3838, "vector 0x3838 (bit1 clear)");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_355b E: alt source, bit2 set (ld hl,(0x8d6f) + jr 0x3595) -> tail 0x381e w/ 0x3856", () => {
  const m = makeMachine();
  base(m);
  m.mem.write8((IX + 0x06) & 0xffff, 0x50); // column 0x50 (>= 0x14, != target)
  m.mem.write8((IX + 0x07) & 0xffff, 0x06); // bit2 set (jr z not taken), bit1 set (jr z not taken)
  m.mem.write8(0x8d79, 0x01);               // BRANCH_B
  m.mem.write8(0x8d6f, 0x00);               // ld hl,(0x8d6f) low
  m.mem.write8(0x8d70, 0x36);               // ld hl,(0x8d6f) high -> HL = 0x3600
  m.mem.write8(0x8d7b, 0x02);               // A index for rst 0x20
  m.mem.write8(0x3602, 0x40);               // table[0x3600+2] = 0x40 != 0x50

  loc_355b(m);

  assert.equal(m.tstates, 386, "E T-state total");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x3561, 0x3562, 0x3565, 0x3568, 0x356b, 0x3570, 0x3573, 0x3574, 0x3577, 0x3579,
    0x357c, 0x357f, 0x3580, 0x35b4, 0x35b8, 0x35ba, 0x35bd, 0x35c0, 0x3595, 0x0020,
    0x3597, 0x359a, 0x359b, 0x359e, 0x35a0, 0x35a1, 0x35a5, 0x35a8, 0x35ac, 0x35ae, 0x35b1, 0x381e,
  ]);
  assert.equal(m.pc, 0x381e, "tail to loc_381e");
  assert.deepEqual(m.calls, [0x4006, 0x0020, 0x381e], "rst 0x20 but no loc_0c45 on this branch");
  assert.equal(m.regs.c, 0x40, "C = target column from alt source");
  assert.equal(m.mem.read8(IX + 0x08), 0x01, "actor latched");
  assert.equal(m.regs.de, 0x3856, "vector 0x3856 (bit1 set)");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_355b MUTATION: `srl a` mis-charged 4T (not 8T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x358c ? 4 : cycles);
  base(m);
  m.mem.write8((IX + 0x06) & 0xffff, 0x05);
  m.mem.write8(0x8d79, 0x00);
  m.mem.write8(0x8907, 0x06);
  m.mem.write8(0x8d41, 0x02);
  m.mem.write8(0x3602, 0x05);

  loc_355b(m);

  assert.equal(m.tstates, 300, "mutation loses 4 T (8 -> 4)");
  assert.throws(
    () => assert.equal(m.tstates, 304, "B T-state total"),
    /304/,
    "the 304-T golden must fail on the mutant",
  );
});
