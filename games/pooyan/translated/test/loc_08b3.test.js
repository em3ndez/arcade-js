// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_08b3 (ROM 0x08b3, Pooyan) -- attract sub-state 0.
 * Clears (0xa028)/(0x8819), advances the sub-state at 0x8e51, runs the backward ROM
 * checksum from 0x64d5 (sum -> H, carry count -> L) until the 0x96 sentinel, then flags
 * a tamper at 0x89fb when (0x96 - L) != 0x8f. Ends via call 0x02b9 / 0x1d0d and `ret`.
 *
 * Pinned path: a crafted 3-byte backward table (0x64d5=0x80, 0x64d4=0x90, 0x64d3=0x96)
 * exercises BOTH inner arms -- a non-carrying add (0x80) and a carrying add (0x80+0x90)
 * that runs `inc l` -- before the sentinel. Sum H=0x10, carries L=1, so 0x96-1=0x95 !=
 * 0x8f -> tamper flag set. Total T = 331 (independently hand-summed and sim-checked); the
 * full 39-boundary pcSeq is pinned; three external calls are recorded.
 *
 * TEETH: mis-charge `call 0x02e3` (17 T) as 10 T. The golden T-state must catch it.
 *
 * Run: node --test games/pooyan/translated/test/loc_08b3.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_08b3 } from "../loc_08b3.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x08b3, pcSeq: [],
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
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function setup(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.mem.write8(0x64d5, 0x80); // first add: no carry
  m.mem.write8(0x64d4, 0x90); // second add: 0x80+0x90 carries -> inc l
  m.mem.write8(0x64d3, 0x96); // sentinel
}

const EXPECTED_PC_SEQ = [
  0x08b4, 0x08b7, 0x08ba, 0x08bd, 0x08c0, 0x08c1, 0x08c4, 0x08c6, 0x08c7,
  // iter1: (bc)=0x80, add no carry -> jr nc taken to 0x08d0 (skip inc l)
  0x08c8, 0x08ca, 0x08cc, 0x08cd, 0x08d0, 0x08d1, 0x08d2,
  // iter2: (bc)=0x90, add carries -> jr nc NOT taken -> 0x08cf inc l
  0x08c7, 0x08c8, 0x08ca, 0x08cc, 0x08cd, 0x08cf, 0x08d0, 0x08d1, 0x08d2,
  // iter3: (bc)=0x96 sentinel -> jr z taken to 0x08d4
  0x08c7, 0x08c8, 0x08ca, 0x08d4, 0x08d5, 0x08d7,
  // checksum mismatch -> tamper flag
  0x08d9, 0x08db, 0x08de, 0x08df, 0x08e2, 0x08e5, 0x08e8,
  CALLER_RET,
];

test("loc_08b3: sub-state 0 -- backward checksum, both inner arms, tamper flagged", () => {
  const m = makeMachine();
  setup(m);
  loc_08b3(m);

  assert.equal(m.tstates, 331, "total T for the crafted 3-byte-table path");
  assert.equal(m.pc, CALLER_RET, "exits via `ret`");
  assert.deepEqual(m.calls, [0x02e3, 0x02b9, 0x1d0d], "external calls in order");
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ, "full instruction-boundary sequence");

  const b = (a) => m.mem.read8(a);
  assert.equal(b(0xa028), 0x00, "(0xa028) cleared");
  assert.equal(b(0x8819), 0x00, "(0x8819) cleared");
  assert.equal(b(0x8806), 0x00, "(0x8806) cleared");
  assert.equal(b(0x8e51), 0x01, "sub-state 0x8e51 incremented 0 -> 1");
  assert.equal(b(0x89fb), 0x01, "tamper flag set (0x96 - L=1 = 0x95 != 0x8f)");
  assert.equal(m.regs.h, 0x10, "H = sum (0x80+0x90 = 0x110 -> 0x10)");
  assert.equal(m.regs.l, 0x01, "L = carry count = 1");
  assert.equal(m.regs.a, 0x00, "A = 0 (xor a at 0x08de before the ret)");
});

test("loc_08b3 MUTATION: `call 0x02e3` mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x08bd ? 10 : cycles);
  setup(m);
  loc_08b3(m);

  assert.equal(m.tstates, 324, "mutation loses 7 T (17 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 331, "total T"),
    /331/,
    "the golden T-state assertion must fail on the mutant",
  );
});
