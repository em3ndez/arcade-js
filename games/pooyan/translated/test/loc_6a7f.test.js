// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_6a7f (ROM 0x6a7f, Pooyan) -- per-frame object driver + one-shot
 * tilemap integrity check. When (0x892b)!=0 it walks 18 records at 0x8ae0 (stride 0x18), running
 * loc_6a98 for each under an exx bracket. When (0x892b)==0 and (0x892d)==2, it runs once (latch
 * 0x8f56) a tilemap sum from 0x8450 (skip col 0x1b, rows +0x12, stop h>=0x88) and compares to 0x29b8:
 * a low-byte miss tails to loc_0929, a high-byte miss to loc_3829, a match rets.
 *
 * The mock's `call` POPS the pushed return (models the callee ret) = the stack tooth. Paths: the full
 * 18-record loop arm (exact pcSeq); both integrity early-rets; and the three sum terminals. The sum
 * loop's iteration count/shape are data-INDEPENDENT (address-driven), so the checksum totals below
 * are pinned by an independent Python trace (length + T-state + prefix/suffix + terminal), not a
 * re-implementation here. All-zero RAM sums to 0 (low miss); 0x8450=0xb8 gives low=0xb8/high=0 (high
 * miss); 41 summed bytes 0xff + one 0xe1 give exactly 0x29b8 (match). Plus one T-state mutation.
 *
 * Run: node --test games/pooyan/translated/test/loc_6a7f.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6a7f } from "../loc_6a7f.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6a7f, pcSeq: [],
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
  m.regs.sp = 0x9000;
  m.push16(CALLER_RET);
}

// prefix shared by every integrity-arm path: jr z through the latch to the sum-loop entry (0x6ada).
const CHK_PREFIX = [0x6a82, 0x6a83, 0x6ac5, 0x6ac8, 0x6aca, 0x6acb, 0x6ace, 0x6acf, 0x6ad0, 0x6ad1, 0x6ad4, 0x6ad7, 0x6ada];

// ordered summed addresses (independent trace) -- used to craft the exact-match sum.
const SUMMED = [
  0x8450, 0x8451, 0x8452, 0x8453, 0x8454, 0x8455, 0x8456, 0x8457, 0x8458, 0x8459, 0x845a,
  0x845c, 0x845d, 0x845e, 0x8471, 0x8472, 0x8473, 0x8474, 0x8475, 0x8476, 0x8477, 0x8478,
  0x8479, 0x847a, 0x847c, 0x847d, 0x847e, 0x8491, 0x8492, 0x8493, 0x8494, 0x8495, 0x8496,
  0x8497, 0x8498, 0x8499, 0x849a, 0x849c, 0x849d, 0x849e, 0x84b1, 0x84b2,
];

test("loc_6a7f Path A: (0x892b)!=0 -> walk 18 records, calling loc_6a98 each", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x892b, 0x01);

  loc_6a7f(m);

  const expected = [0x6a82, 0x6a83, 0x6a85, 0x6a89, 0x6a8c, 0x6a8e];
  for (let i = 0; i < 17; i++) expected.push(0x6a8f, 0x6a98, 0x6a93, 0x6a95, 0x6a8e);
  expected.push(0x6a8f, 0x6a98, 0x6a93, 0x6a95, 0x6a97, CALLER_RET);

  assert.equal(m.tstates, 1014, "Path A T-state total");
  assert.deepEqual(m.pcSeq, expected);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, new Array(18).fill(0x6a98));
  assert.equal(m.regs.ix, 0x8c90, "ix = 0x8ae0 + 18*0x18");
  assert.equal(m.regs.sp, 0x9000, "stack back to baseline");
});

test("loc_6a7f Path B: integrity arm, (0x892d)!=2 -> ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x892b, 0x00); // jr z -> integrity arm
  m.mem.write8(0x892d, 0x05); // != 2

  loc_6a7f(m);

  assert.equal(m.tstates, 60, "Path B T-state total");
  assert.deepEqual(m.pcSeq, [0x6a82, 0x6a83, 0x6ac5, 0x6ac8, 0x6aca, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x8f56), 0x00, "latch untouched");
  assert.equal(m.regs.sp, 0x9000, "stack back to baseline");
});

test("loc_6a7f Path C: integrity arm, latch (0x8f56) already set -> ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x892b, 0x00);
  m.mem.write8(0x892d, 0x02);
  m.mem.write8(0x8f56, 0x01); // already run

  loc_6a7f(m);

  assert.equal(m.tstates, 82, "Path C T-state total");
  assert.deepEqual(m.pcSeq, [0x6a82, 0x6a83, 0x6ac5, 0x6ac8, 0x6aca, 0x6acb, 0x6ace, 0x6acf, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.mem.read8(0x8f56), 0x01, "latch unchanged (no re-run)");
  assert.equal(m.regs.sp, 0x9000, "stack back to baseline");
});

test("loc_6a7f Path D: integrity sum low-byte miss (all-zero tilemap) -> tamper throw", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x892b, 0x00);
  m.mem.write8(0x892d, 0x02); // sum region all zero -> total 0x0000, low-byte != 0xb8

  // Anti-tamper trap: 0x6b00 jp 0x0929 is unreachable with a valid tilemap, modeled as a throw
  // (work-RAM checksum firing implies a port bug; cf. loc_68ac / loc_3278).
  assert.throws(() => loc_6a7f(m), /low-byte no match/);
  assert.deepEqual(m.pcSeq.slice(0, 13), CHK_PREFIX);
  assert.deepEqual(m.pcSeq.slice(-3), [0x6afc, 0x6afe, 0x6b00]);
  assert.equal(m.mem.read8(0x8f56), 0x01, "latch set for this pass");
});

test("loc_6a7f Path E: integrity sum high-byte miss (0x8450=0xb8) -> tamper throw", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x892b, 0x00);
  m.mem.write8(0x892d, 0x02);
  m.mem.write8(0x8450, 0xb8); // low = 0xb8, high = 0 != 0x29

  // Anti-tamper trap: 0x6b06 jp nz 0x3829 (data) is unreachable with a valid tilemap, modeled as a throw.
  assert.throws(() => loc_6a7f(m), /high-byte no match/);
  assert.deepEqual(m.pcSeq.slice(0, 13), CHK_PREFIX);
  assert.deepEqual(m.pcSeq.slice(-3), [0x6b03, 0x6b04, 0x6b06]);
});

test("loc_6a7f Path F: integrity sum matches 0x29b8 -> ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x892b, 0x00);
  m.mem.write8(0x892d, 0x02);
  for (let i = 0; i < 41; i++) m.mem.write8(SUMMED[i], 0xff);
  m.mem.write8(SUMMED[41], 0xe1); // 41*0xff + 0xe1 = 0x29b8

  loc_6a7f(m);

  assert.equal(m.tstates, 31909, "Path F T-state total");
  assert.equal(m.pcSeq.length, 4498, "Path F pcSeq length");
  assert.deepEqual(m.pcSeq.slice(0, 13), CHK_PREFIX);
  assert.deepEqual(m.pcSeq.slice(-7), [0x6afc, 0x6afe, 0x6b03, 0x6b04, 0x6b06, 0x6b09, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x8f56), 0x01, "latch set for this pass");
  assert.equal(m.regs.sp, 0x9000, "clean ret to caller");
});

test("loc_6a7f MUTATION: the loc_6a98 call mis-charged 16T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x6a98 ? 16 : cycles);
  seatCaller(m);
  m.mem.write8(0x892b, 0x01);

  loc_6a7f(m);

  assert.equal(m.tstates, 996, "mutation loses 1T on each of 18 calls");
  assert.throws(() => assert.equal(m.tstates, 1014, "Path A T-state total"), /Path A/);
});
