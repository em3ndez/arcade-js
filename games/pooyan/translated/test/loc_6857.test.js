// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_6857 (ROM 0x6857, Pooyan) -- object ascent step. Subtracts (ix+9)
 * from the 16-bit position (ix+5):(ix+6); at/over (ix+6)==0x1b it rets early, else it advances state
 * (ix+2) and runs a two-pass checksum over the 0x86bc block (8 bytes -0x20 stride, then 8 bytes at
 * h-4 with +0x20 stride) into C. Non-zero (de)+C tails to loc_08b3; zero appends de=0x0613 via rst 0x38.
 *
 * The mock's `call` POPS the pushed return (models the callee ret); the stack tooth. Paths cover:
 * ret-nc early (no-borrow sub); the full checksum with the loop-1 borrow arm, ending in the rst-0x38
 * arm ((de)+C zero) and in the loc_08b3 tail ((de)+C non-zero); plus a T-state mutation. The loop-2
 * inc-h arm (0x6896) is unreachable from the fixed entry: loop 1 always leaves L=0xbc, and loop 2
 * never rewrites L, so L+0x20 never carries -- no crafted input reaches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_6857.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6857 } from "../loc_6857.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6857, pcSeq: [],
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

// pass-1 loop body (0x687a top): borrow inserts dec h (0x6884); last takes the djnz fall-through.
function l1(borrow, last) {
  return [0x687b, 0x687c, 0x687d, 0x687e, 0x687f, 0x6880, 0x6882,
    ...(borrow ? [0x6884, 0x6885] : [0x6885]), 0x6886, last ? 0x6888 : 0x687a];
}
// pass-2 loop body (0x688e top): jr nc always taken (L fixed 0xbc), inc-h arm unreachable.
function l2(last) {
  return [0x688f, 0x6890, 0x6891, 0x6892, 0x6894, 0x6897, last ? 0x6899 : 0x688e];
}

const LOOP1 = [
  ...l1(false, false), ...l1(false, false), ...l1(false, false), ...l1(false, false),
  ...l1(false, false), ...l1(true, false), ...l1(false, false), ...l1(false, true),
];
const LOOP2 = [...l2(false), ...l2(false), ...l2(false), ...l2(false),
  ...l2(false), ...l2(false), ...l2(false), ...l2(true)];
// shared prefix through both checksum passes to the 0x689b jp nz decision.
const CHKSUM = [
  0x4006, 0x685d, 0x6860, 0x6862, 0x6865, 0x6868, 0x686b, 0x686d, 0x686e, 0x6871, 0x6874, 0x6877, 0x687a,
  ...LOOP1, 0x688a, 0x688b, 0x688d, 0x688e, ...LOOP2, 0x689a, 0x689b,
];
const CHKSUM_T = 1162; // 188 head + 538 loop1 + 22 setup (sub 0x04 = 7T) + 403 loop2 + 11 tail-to-689b

test("loc_6857 Path A: no-borrow sub, (ix+6)>=0x1b -> ret nc", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x9005, 0x40); // (ix+5)
  m.mem.write8(0x9009, 0x10); // (ix+9); 0x40-0x10 no borrow
  m.mem.write8(0x9006, 0x20); // (ix+6) >= 0x1b

  loc_6857(m);

  assert.equal(m.tstates, 123, "Path A T-state total");
  assert.deepEqual(m.pcSeq, [0x4006, 0x685d, 0x6860, 0x6865, 0x6868, 0x686b, 0x686d, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x4006]);
  assert.equal(m.mem.read8(0x9005), 0x30, "(ix+5) = 0x40 - 0x10");
  assert.equal(m.mem.read8(0x9002), 0x00, "(ix+2) untouched on the early ret");
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_6857 Path B: borrow sub, full checksum, (de)+C zero -> rst 0x38 -> ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x9005, 0x00);
  m.mem.write8(0x9009, 0x10); // 0x00-0x10 -> borrow, dec (ix+6)
  m.mem.write8(0x9006, 0x05); // -> 0x04 (< 0x1b)

  loc_6857(m);

  assert.equal(m.tstates, CHKSUM_T + 10 + 10 + 11 + 10, "Path B: chksum + 689e + 68a1 + rst + ret");
  assert.deepEqual(m.pcSeq, [...CHKSUM, 0x689e, 0x68a1, 0x0038, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x4006, 0x0038]);
  assert.equal(m.mem.read8(0x9006), 0x04, "(ix+6) borrow-decremented");
  assert.equal(m.mem.read8(0x9002), 0x01, "(ix+2) advanced");
  assert.equal(m.regs.sp, 0x8780, "stack back to baseline");
});

test("loc_6857 Path C: full checksum, (de)+C non-zero -> tail to loc_08b3", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x9005, 0x00);
  m.mem.write8(0x9009, 0x10);
  m.mem.write8(0x9006, 0x05);
  m.mem.write8(0x68ab, 0x01); // (de) at 0x689a -> non-zero add a,c -> jp nz taken

  loc_6857(m);

  assert.equal(m.tstates, CHKSUM_T + 10, "Path C: chksum + jp nz taken");
  assert.deepEqual(m.pcSeq, [...CHKSUM, 0x08b3]);
  assert.equal(m.pc, 0x08b3);
  assert.deepEqual(m.calls, [0x4006, 0x08b3]);
  assert.equal(m.regs.sp, 0x8780, "tail unwound the stack to the pre-seat baseline");
});

test("loc_6857 MUTATION: the loc_4006 call mis-charged 16T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x4006 ? 16 : cycles);
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x9005, 0x40);
  m.mem.write8(0x9009, 0x10);
  m.mem.write8(0x9006, 0x20);

  loc_6857(m);

  assert.equal(m.tstates, 122, "mutation loses 1 T");
  assert.throws(() => assert.equal(m.tstates, 123, "Path A T-state total"), /Path A/);
});
