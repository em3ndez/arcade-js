// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_34f2 (ROM 0x34f2, Pooyan) -- the object Y-movement handler.
 * Moves (ix+0x05) toward the target by the signed step -(ix+0x0a), borrows into (ix+0x06), then
 * compares the masked column against the limit at 0x8d4b. On undershoot/match/overshoot it tails
 * into loc_34b0, latches (ix+0x08)=0 and returns, or tails into loc_3473.
 *
 * loc_34f2 has NO push16 of its own (only tail jps + rets), so the positive control is a T-state
 * mutation (done against the source, see the run notes) rather than a push16 deletion. The mock's
 * `call` still POPS: on a tail path loc_34b0/loc_3473's ret pops the seated CALLER_RET, so SP
 * returns to the pre-seat baseline -- a stray push before a tail jp would leave SP off (tooth).
 *
 * Paths A-H exercise both outcomes of every conditional: 0x34fc jr nc, 0x3512 jr z, 0x3514 ret nc,
 * 0x3516 jp z, 0x351e ret nz, 0x3525 jp z, 0x352d ret nz, 0x3532 ret c.
 * TEETH: `neg` (8T) mis-charged 4T is caught by Path A's golden.
 *
 * Run: node --test games/pooyan/translated/test/loc_34f2.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_34f2 } from "../loc_34f2.js";

const CALLER_RET = 0xabcd;
const IX = 0x8a00;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x34f2, pcSeq: [],
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
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.ix = IX;
}

test("loc_34f2 A: borrow (dec ix+6), column > limit -> ret nc at 0x3514", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x0a, 0x01); // neg -> b=0xff
  m.mem.write8(IX + 0x05, 0x00); // < b -> jr nc not taken -> dec (ix+6)
  m.mem.write8(IX + 0x06, 0x14); // dec -> 0x13; &0x1f = 0x13
  m.mem.write8(0x8d4b, 0x05);    // 0x13 > 0x05 -> NC,NZ

  loc_34f2(m);

  assert.deepEqual(m.pcSeq, [
    0x34f5, 0x34f7, 0x34f8, 0x34fb, 0x34fc, 0x34fe, 0x3501, 0x3504, 0x3507, 0x3508,
    0x350b, 0x350c, 0x350f, 0x3511, 0x3512, 0x3514, CALLER_RET,
  ], "A boundaries");
  assert.equal(m.tstates, 191, "A T-total");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(IX + 0x05), 0x01, "(ix+5) stepped");
  assert.equal(m.mem.read8(IX + 0x06), 0x13, "(ix+6) borrowed");
});

test("loc_34f2 B: no borrow, column < limit, A==0 -> jp z loc_34b0 (tail)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x0a, 0xff); // neg -> b=0x01
  m.mem.write8(IX + 0x05, 0x05); // >= b -> jr nc taken (skip dec)
  m.mem.write8(IX + 0x06, 0x00); // &0x1f = 0
  m.mem.write8(0x8d4b, 0x05);    // 0 < 5 -> C,NZ; and a -> Z

  loc_34f2(m);

  assert.deepEqual(m.pcSeq, [
    0x34f5, 0x34f7, 0x34f8, 0x34fb, 0x34fc, 0x3501, 0x3504, 0x3507, 0x3508, 0x350b,
    0x350c, 0x350f, 0x3511, 0x3512, 0x3514, 0x3515, 0x3516, 0x34b0,
  ], "B boundaries");
  assert.equal(m.tstates, 181, "B T-total");
  assert.equal(m.pc, 0x34b0, "tail into loc_34b0");
  assert.deepEqual(m.calls, [0x34b0]);
  assert.equal(m.regs.sp, 0x8780, "tail pops seated CALLER_RET -> pre-seat baseline");
  assert.equal(m.mem.read8(IX + 0x05), 0x04, "(ix+5) = 0x05 + (-1) = 0x04");
});

test("loc_34f2 C: else branch, A!=0, 0x880a!=4 -> ret nz at 0x351e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x0a, 0xff); m.mem.write8(IX + 0x05, 0x05);
  m.mem.write8(IX + 0x06, 0x03); m.mem.write8(0x8d4b, 0x05); // 3 < 5 -> C,NZ; and a -> NZ
  m.mem.write8(0x880a, 0x00);

  loc_34f2(m);

  assert.deepEqual(m.pcSeq, [
    0x34f5, 0x34f7, 0x34f8, 0x34fb, 0x34fc, 0x3501, 0x3504, 0x3507, 0x3508, 0x350b,
    0x350c, 0x350f, 0x3511, 0x3512, 0x3514, 0x3515, 0x3516, 0x3519, 0x351c, 0x351e,
    CALLER_RET,
  ], "C boundaries");
  assert.equal(m.tstates, 212, "C T-total");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
  assert.deepEqual(m.calls, []);
});

test("loc_34f2 D: else branch, 0x880a==4 -> latch (ix+8)=0, ret at 0x3523", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x0a, 0xff); m.mem.write8(IX + 0x05, 0x05);
  m.mem.write8(IX + 0x06, 0x03); m.mem.write8(0x8d4b, 0x05);
  m.mem.write8(0x880a, 0x04);
  m.mem.write8(IX + 0x08, 0xee); // sentinel -> must become 0

  loc_34f2(m);

  assert.deepEqual(m.pcSeq, [
    0x34f5, 0x34f7, 0x34f8, 0x34fb, 0x34fc, 0x3501, 0x3504, 0x3507, 0x3508, 0x350b,
    0x350c, 0x350f, 0x3511, 0x3512, 0x3514, 0x3515, 0x3516, 0x3519, 0x351c, 0x351e,
    0x351f, 0x3523, CALLER_RET,
  ], "D boundaries");
  assert.equal(m.tstates, 235, "D T-total");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(IX + 0x08), 0x00, "(ix+8) cleared");
});

test("loc_34f2 E: column == limit, A==0 -> jp z loc_34b0 at 0x3525 (tail)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x0a, 0xff); m.mem.write8(IX + 0x05, 0x05);
  m.mem.write8(IX + 0x06, 0x00); m.mem.write8(0x8d4b, 0x00); // A==C==0 -> Z; and a -> Z

  loc_34f2(m);

  assert.deepEqual(m.pcSeq, [
    0x34f5, 0x34f7, 0x34f8, 0x34fb, 0x34fc, 0x3501, 0x3504, 0x3507, 0x3508, 0x350b,
    0x350c, 0x350f, 0x3511, 0x3512, 0x3524, 0x3525, 0x34b0,
  ], "E boundaries");
  assert.equal(m.tstates, 181, "E T-total");
  assert.equal(m.pc, 0x34b0, "tail into loc_34b0");
  assert.deepEqual(m.calls, [0x34b0]);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_34f2 F: column==limit, A!=0, 0x880a==4, (ix+9) < b -> ret c at 0x3532", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x0a, 0xff); m.mem.write8(IX + 0x05, 0x05); // b becomes 0x04
  m.mem.write8(IX + 0x06, 0x08); m.mem.write8(0x8d4b, 0x08);    // A==C==8 -> Z; and a -> NZ
  m.mem.write8(0x880a, 0x04);
  m.mem.write8(IX + 0x09, 0x00); // 0 < 4 -> C

  loc_34f2(m);

  assert.deepEqual(m.pcSeq, [
    0x34f5, 0x34f7, 0x34f8, 0x34fb, 0x34fc, 0x3501, 0x3504, 0x3507, 0x3508, 0x350b,
    0x350c, 0x350f, 0x3511, 0x3512, 0x3524, 0x3525, 0x3528, 0x352b, 0x352d, 0x352e,
    0x3531, 0x3532, CALLER_RET,
  ], "F boundaries");
  assert.equal(m.tstates, 240, "F T-total");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
  assert.deepEqual(m.calls, []);
});

test("loc_34f2 G: column==limit, (ix+9) >= b -> jp loc_3473 (tail)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x0a, 0xff); m.mem.write8(IX + 0x05, 0x05);
  m.mem.write8(IX + 0x06, 0x08); m.mem.write8(0x8d4b, 0x08);
  m.mem.write8(0x880a, 0x04);
  m.mem.write8(IX + 0x09, 0x04); // 4 == b(4) -> NC -> ret c not taken

  loc_34f2(m);

  assert.deepEqual(m.pcSeq, [
    0x34f5, 0x34f7, 0x34f8, 0x34fb, 0x34fc, 0x3501, 0x3504, 0x3507, 0x3508, 0x350b,
    0x350c, 0x350f, 0x3511, 0x3512, 0x3524, 0x3525, 0x3528, 0x352b, 0x352d, 0x352e,
    0x3531, 0x3532, 0x3533, 0x3473,
  ], "G boundaries");
  assert.equal(m.tstates, 244, "G T-total");
  assert.equal(m.pc, 0x3473, "tail into loc_3473");
  assert.deepEqual(m.calls, [0x3473]);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_34f2 H: column==limit, A!=0, 0x880a!=4 -> ret nz at 0x352d", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX + 0x0a, 0xff); m.mem.write8(IX + 0x05, 0x05);
  m.mem.write8(IX + 0x06, 0x08); m.mem.write8(0x8d4b, 0x08);
  m.mem.write8(0x880a, 0x00); // != 4 -> ret nz taken

  loc_34f2(m);

  assert.deepEqual(m.pcSeq, [
    0x34f5, 0x34f7, 0x34f8, 0x34fb, 0x34fc, 0x3501, 0x3504, 0x3507, 0x3508, 0x350b,
    0x350c, 0x350f, 0x3511, 0x3512, 0x3524, 0x3525, 0x3528, 0x352b, 0x352d, CALLER_RET,
  ], "H boundaries");
  assert.equal(m.tstates, 212, "H T-total");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
  assert.deepEqual(m.calls, []);
});

test("loc_34f2 MUTATION: `neg` mis-charged 4T (not 8T) is caught on Path A", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x34f7 ? 4 : cycles);
  seatCaller(m);
  m.mem.write8(IX + 0x0a, 0x01); m.mem.write8(IX + 0x05, 0x00);
  m.mem.write8(IX + 0x06, 0x14); m.mem.write8(0x8d4b, 0x05);

  loc_34f2(m);

  assert.equal(m.tstates, 187, "mutation loses 4 T (8 -> 4)");
  assert.throws(() => assert.equal(m.tstates, 191, "A golden"), /191/,
    "the 191-T golden must fail on the mutant");
});
