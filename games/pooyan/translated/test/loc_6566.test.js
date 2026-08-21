// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_6566 (ROM 0x6566, Pooyan). The (0x892f) phase counter: nonzero ->
 * decrement and return; zero -> toggle (0x892c) bit0 to pick the even (grow) or odd (shrink) phase,
 * step three mirrored ix records, then either render (odd, via 0x2514) or fall into the 0x8c78 record's
 * integrity sweep (even): two 10-slot passes over the 0x82bc mirror bank, throwing a tamper trap on a
 * slot mismatch (0x5284) or bad final checksum (0x6014 / 0x2005) -- those targets are data -- else ret.
 *
 * The mock's `call` POPS the return the call site pushed (modelling the callee's ret); a tail m.call
 * unwinds the seated caller so SP returns to 0x8780. The loop paths build their expected pcSeq/tstates
 * from per-iteration builders (l1/l2) written from the listing, so a 100+ step sequence stays exact.
 *
 * Run: node --test games/pooyan/translated/test/loc_6566.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6566 } from "../loc_6566.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6566, pcSeq: [],
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
}

// ── expected-sequence builders, derived from the listing (independent of loc_6566.js) ──────────────

// even-phase prologue with the 0x6580 inc block SKIPPED (no carry), ending on the jr to 0x65ea.
const PRE_A = {
  seq: [0x6569, 0x656a, 0x656b, 0x656f, 0x6571, 0x6572, 0x6574, 0x6576,
        0x6578, 0x657a, 0x657d, 0x6580, 0x658b, 0x658e, 0x6591, 0x6594, 0x65ea],
  t: 10 + 7 + 4 + 12 + 7 + 11 + 12 + 7 + 7 + 10 + 19 + 19 + 12 + 19 + 19 + 19 + 12,
};

// 0x65ea sweep prologue with `ret nc` NOT taken, ending on the ld b,0x0a that pushes 0x6624.
const SWEEP = {
  seq: [0x65ee, 0x65f1, 0x65f3, 0x65f4, 0x65f6, 0x65f9, 0x65fc, 0x65ff, 0x6601, 0x6604, 0x6607,
        0x660a, 0x660c, 0x660f, 0x6612, 0x6615, 0x6618, 0x661b, 0x661f, 0x6622, 0x6624],
  t: 14 + 19 + 7 + 5 + 7 + 19 + 19 + 19 + 7 + 19 + 19 + 19 + 7 + 19 + 19 + 19 + 13 + 13 + 14 + 10 + 7,
};

function l1(addCarry, borrow, isLast) {
  const seq = [0x6627, 0x662a, 0x662d, 0x662e, 0x662f];
  let t = 19 + 19 + 10 + 4 + 4;
  if (addCarry) { seq.push(0x6631, 0x6632); t += 7 + 4; } else { seq.push(0x6632); t += 12; }
  seq.push(0x6634, 0x6636, 0x6638); t += 8 + 7 + 8;
  if (borrow) { seq.push(0x663a, 0x663c); t += 7 + 8; } else { seq.push(0x663c); t += 12; }
  if (isLast) { seq.push(0x663e); t += 8; } else { seq.push(0x6624); t += 13; }
  return { seq, t };
}

function l2(addCarry, lcarry, isLast) {
  const seq = [0x664d, 0x664e];
  let t = 7 + 4;
  if (addCarry) { seq.push(0x6650, 0x6651); t += 7 + 4; } else { seq.push(0x6651); t += 12; }
  seq.push(0x6652, 0x6653, 0x6655); t += 4 + 4 + 7;
  if (lcarry) { seq.push(0x6657, 0x6658); t += 7 + 4; } else { seq.push(0x6658); t += 12; }
  seq.push(0x6659); t += 4;   // ld l,a
  if (isLast) { seq.push(0x665b); t += 8; } else { seq.push(0x664c); t += 13; }
  return { seq, t };
}

// second-pass prologue (0x663e..ex de,hl) that pushes 0x664c for the first l2 iter.
const L2PRE = {
  seq: [0x6640, 0x6642, 0x6644, 0x6646, 0x6647, 0x6649, 0x664b, 0x664c],
  t: 7 + 7 + 8 + 8 + 4 + 8 + 8 + 4,
};

const L1_BORROW = [false, false, false, false, false, true, false, false, false, false];
const L2_LCARRY = [false, false, false, false, true, false, false, false, false, false];

function buildLoop1(addCarryArr) {
  let seq = [], t = 0;
  for (let i = 0; i < 10; i++) {
    const it = l1(addCarryArr[i], L1_BORROW[i], i === 9);
    seq = seq.concat(it.seq); t += it.t;
  }
  return { seq, t };
}

function buildLoop2(addCarryArr) {
  let seq = [], t = 0;
  for (let i = 0; i < 10; i++) {
    const it = l2(addCarryArr[i], L2_LCARRY[i], i === 9);
    seq = seq.concat(it.seq); t += it.t;
  }
  return { seq, t };
}

// A full even-phase sweep to a chosen epilogue. `loop1AC`/`loop2AC` are the per-iter add-a,e carry
// flags; `epiSeq`/`epiT` are the exit tail appended after the second pass ends on 0x665b.
function fullSweep(loop1AC, loop2AC, epiSeq, epiT) {
  const a = buildLoop1(loop1AC);
  const b = buildLoop2(loop2AC);
  return {
    seq: [...PRE_A.seq, ...SWEEP.seq, ...a.seq, ...L2PRE.seq, ...b.seq, ...epiSeq],
    t: PRE_A.t + SWEEP.t + a.t + L2PRE.t + b.t + epiT,
  };
}

const NO_CARRY = [false, false, false, false, false, false, false, false, false, false];

test("loc_6566 Path down-count: (0x892f)!=0 -> dec (hl), ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x892f, 0x05);

  loc_6566(m);

  assert.deepEqual(m.pcSeq, [0x6569, 0x656a, 0x656b, 0x656d, 0x656e, CALLER_RET]);
  assert.equal(m.tstates, 10 + 7 + 4 + 7 + 11 + 10);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.mem.read8(0x892f), 0x04, "phase counter decremented");
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_6566 Path odd/carries: shrink phase, both sub borrows, jr z not taken -> 0x66c2, render", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x892f, 0x00);
  m.mem.write8(0x892c, 0x00);   // inc -> 1 (odd) -> branch B
  m.mem.write8(0x9008, 0x01);   // (ix+3)=0 - (ix+8)=1 -> borrow
  m.mem.write8(0x9009, 0x01);   // (ix+5)=0 - (ix+9)=1 -> borrow

  loc_6566(m);

  assert.deepEqual(m.pcSeq, [
    0x6569, 0x656a, 0x656b, 0x656f, 0x6571, 0x6572, 0x6574, 0x6576, 0x6596, 0x6598, 0x659b, 0x659e,
    0x65a0, 0x65a3, 0x65a6, 0x65a9, 0x65ac, 0x65af, 0x65b2, 0x65b5, 0x65b8, 0x65bb, 0x65be, 0x65c1,
    0x65c3, 0x65c6, 0x65c8, 0x65cb, 0x65cd, 0x65d0, 0x65d2, 0x65d5, 0x65d7, 0x65d9, 0x65dc, 0x65de,
    0x65e1, 0x65e4, 0x65e6, 0x2514, CALLER_RET,
  ]);
  assert.equal(
    m.tstates,
    10 + 7 + 4 + 12 + 7 + 11 + 12 + 7 + 12 + 10 + 19 + 19 + 7 + 23 + 23 + 23 + 19 + 19 + 19 +
      19 + 19 + 19 + 19 + 19 + 7 + 19 + 7 + 19 + 7 + 19 + 7 + 19 + 7 + 12 + 10 + 7 + 10 + 10 + 7 + 17 + 10,
  );
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.mem.read8(0x892f), 0x0c, "odd phase seeds 0x0c");
  assert.equal(m.mem.read8(0x9003), 0xff, "(ix+3) = 0 - 1 = 0xff written back");
  assert.deepEqual(m.calls, [0x2514]);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_6566 Path odd/no-carry: shrink phase, both subs clear, bit0 clear -> 0x66bf", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8929;           // (ix+3) aliases 0x892c so the store flips it even
  m.mem.write8(0x892f, 0x00);
  m.mem.write8(0x892c, 0x00);   // inc -> 1 (odd) -> branch B
  m.mem.write8(0x8931, 0x01);   // (ix+3)=1 - (ix+8)=1 -> 0, no borrow; store 0 -> 0x892c even
  m.mem.write8(0x892e, 0x05);   // (ix+5)
  m.mem.write8(0x8932, 0x03);   // (ix+9): 5 - 3 = 2, no borrow

  loc_6566(m);

  assert.deepEqual(m.pcSeq, [
    0x6569, 0x656a, 0x656b, 0x656f, 0x6571, 0x6572, 0x6574, 0x6576, 0x6596, 0x6598, 0x659b, 0x659e,
    0x65a9, 0x65ac, 0x65af, 0x65b2, 0x65b5, 0x65b8, 0x65bb, 0x65be, 0x65c1, 0x65d5, 0x65d7, 0x65d9,
    0x65dc, 0x65e1, 0x65e4, 0x65e6, 0x2514, CALLER_RET,
  ]);
  assert.equal(
    m.tstates,
    10 + 7 + 4 + 12 + 7 + 11 + 12 + 7 + 12 + 10 + 19 + 19 + 12 + 19 + 19 + 19 + 19 + 19 + 19 + 19 +
      19 + 12 + 7 + 12 + 10 + 12 + 10 + 7 + 17 + 10,
  );
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.mem.read8(0x892c), 0x00, "store flipped 0x892c even");
  assert.equal(m.mem.read8(0x892e), 0x02, "(ix+5) = 5 - 3 = 2 written back");
  assert.deepEqual(m.calls, [0x2514]);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_6566 Path even/inc: grow phase, add carry -> inc block, ret nc taken", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x892f, 0x00);
  m.mem.write8(0x892c, 0x01);   // inc -> 2 (even) -> branch A
  m.mem.write8(0x9003, 0xff);
  m.mem.write8(0x9008, 0x02);   // 0xff + 2 -> carry -> inc block
  m.mem.write8(0x8c7e, 0x0c);   // (ix+6) >= 0x0c -> ret nc taken

  loc_6566(m);

  assert.deepEqual(m.pcSeq, [
    0x6569, 0x656a, 0x656b, 0x656f, 0x6571, 0x6572, 0x6574, 0x6576, 0x6578, 0x657a, 0x657d, 0x6580,
    0x6582, 0x6585, 0x6588, 0x658b, 0x658e, 0x6591, 0x6594, 0x65ea, 0x65ee, 0x65f1, 0x65f3, CALLER_RET,
  ]);
  assert.equal(
    m.tstates,
    10 + 7 + 4 + 12 + 7 + 11 + 12 + 7 + 7 + 10 + 19 + 19 + 7 + 23 + 23 + 23 + 19 + 19 + 19 + 12 +
      14 + 19 + 7 + 11,
  );
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.mem.read8(0x9003), 0x01, "(ix+3) = 0xff + 2 = 0x01 written back");
  assert.equal(m.mem.read8(0x9004), 0x01, "(ix+4) incremented on carry");
  assert.equal(m.mem.read8(0x8c7e), 0x0c, "0x8c78 record untouched (ret before writes)");
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_6566 Path sweep/mismatch: first slot differs -> tamper throw (0x5284 is data)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x892f, 0x00);
  m.mem.write8(0x892c, 0x01);   // even -> branch A
  m.mem.write8(0x8c7e, 0x00);   // ret nc not taken
  m.mem.write8(0x82bc, 0x01);   // (iy) != (iy-0x20)=0 -> mismatch on iter 1
  m.mem.write8(0x829c, 0x00);

  assert.throws(() => loc_6566(m), /tamper trap 0x5284/);
  assert.deepEqual(m.calls, [], "no dispatch into data -- the trap throws");
});

test("loc_6566 Path sweep/6014: loops complete, low checksum != 0x2a -> tamper throw (0x6014 is data)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x892f, 0x00);
  m.mem.write8(0x892c, 0x01);   // even -> branch A
  m.mem.write8(0x8c7e, 0x00);   // ret nc not taken
  for (let a = 0x8100; a <= 0x8300; a++) m.mem.write8(a, 0x80); // first-pass slots match at 0x80

  assert.throws(() => loc_6566(m), /tamper trap 0x6014/);
  assert.deepEqual(m.calls, [], "no dispatch into data -- the trap throws");
});

test("loc_6566 Path sweep/ret: e=0x2a and d=1 -> both jp nz clear -> ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x892f, 0x00);
  m.mem.write8(0x892c, 0x01);   // even -> branch A
  m.mem.write8(0x8c7e, 0x00);
  m.mem.write8(0x857c, 0x80);   // second pass: 0x80 + 0xaa = 0x12a -> e=0x2a, one carry
  m.mem.write8(0x859c, 0xaa);

  loc_6566(m);

  const loop2AC = [false, true, false, false, false, false, false, false, false, false];
  const expect = fullSweep(NO_CARRY, loop2AC, [0x665c, 0x665e, 0x6661, 0x6662, 0x6665, CALLER_RET],
    4 + 7 + 10 + 4 + 10 + 10);
  assert.deepEqual(m.pcSeq, expect.seq);
  assert.equal(m.tstates, expect.t);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.mem.read8(0x8930), 0x02, "0x8930 seeded 0x02 by the sweep prologue");
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_6566 Path sweep/2005: e=0x2a but d=2 -> second jp nz taken -> tamper throw (0x2005 is data)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x892f, 0x00);
  m.mem.write8(0x892c, 0x01);   // even -> branch A
  m.mem.write8(0x8c7e, 0x00);
  m.mem.write8(0x857c, 0xff);   // 0xff, 0xff, 0x2c -> sum 0x22a: e=0x2a, two carries -> d=2
  m.mem.write8(0x859c, 0xff);
  m.mem.write8(0x85bc, 0x2c);

  assert.throws(() => loc_6566(m), /tamper trap 0x2005/);
  assert.deepEqual(m.calls, [], "no dispatch into data -- the trap throws");
});

test("loc_6566 MUTATION: the ld ix,0x8c78 mis-charged 13T (not 14T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x65ee ? 13 : cycles);
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x892f, 0x00);
  m.mem.write8(0x892c, 0x01);
  m.mem.write8(0x9003, 0xff);
  m.mem.write8(0x9008, 0x02);
  m.mem.write8(0x8c7e, 0x0c);

  loc_6566(m);

  const golden = 10 + 7 + 4 + 12 + 7 + 11 + 12 + 7 + 7 + 10 + 19 + 19 + 7 + 23 + 23 + 23 + 19 + 19 +
    19 + 12 + 14 + 19 + 7 + 11;
  assert.equal(m.tstates, golden - 1, "mutation loses 1 T");
  assert.throws(() => assert.equal(m.tstates, golden, "even/inc ret nc total"), /even\/inc/);
});
