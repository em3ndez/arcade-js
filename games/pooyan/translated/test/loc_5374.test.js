// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5374 (ROM 0x5374, Pooyan) -- the one-shot IX-entry activator.
 * If the 16-bit word (ix+0,ix+1) is non-zero the entry is already live -> `ret nz` (normal return).
 * Otherwise it bumps 0x8d79, marks the entry active ((ix+0)=1), selects E per 0x8907 bit0, inits via
 * 0x53a0, then OR's the rst-0x20 lookup of table 0x53a6 (index (0x8d74)) into (ix+7). The closing
 * `pop af` DISCARDS the caller's return address, so the final `ret` returns one level ABOVE the caller.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`). For
 * rst 0x20 it also models loc_0020 (HL += A 16-bit, A = (HL)); loc_53a0 is modelled pop-only -- its
 * register clobbers are reloaded by loc_5374 (HL, A) and its ix-field writes are 0x5733's concern
 * (validated at merge). Because the mock pops, a call site missing its push16 desyncs the stack, so
 * the skip-return's SP/pc assertions have real teeth.
 *
 * Path A (word 0, 0x8907 bit0=1 -> E=0x1d): full body, jr nz taken, skip-return. pcSeq + T=232.
 * Path B (word 0, 0x8907 bit0=0 -> E=0x04): jr nz not taken (ld e,0x04). T=234.
 * Path EARLY (word non-zero): `ret nz` normal return, no work. T=49.
 * TOOTH: mis-charge `or (ix+7)` (19 T) as 7 T -> the 232-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_5374.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5374 } from "../loc_5374.js";

const CALLER_RET = 0x536e; // the return address loc_5334 pushes; `pop af` discards it
const GRANDRET = 0xabcd;   // the level above the caller; the skip-return `ret` lands here
const IX = 0x8c30;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5374, pcSeq: [],
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
    // The callee's `ret` pops the return address loc_5374 pushed at the call site -- model that pop so
    // the stack stays balanced (a missing push16 then desyncs the skip-return SP/pc). rst 0x20 also
    // runs loc_0020 (HL += A, A = (HL)); loc_53a0's clobbers are reloaded, so it is pop-only here.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x0020) {
        regs.hl = (regs.hl + regs.a) & 0xffff;
        regs.a = mem.read8(regs.hl);
      }
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(GRANDRET);   // deeper: the skip-return `ret` lands here
  m.push16(CALLER_RET); // top: the "call 0x5374" return address `pop af` discards
}

function setupBody(m) {
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x00, 0x00); // word (ix+0,ix+1) == 0 -> not yet active
  m.mem.write8(IX + 0x01, 0x00);
  m.mem.write8(IX + 0x07, 0x80); // prior (ix+7) bits OR'd with the lookup
  m.mem.write8(0x8d79, 0x05);    // counter -> 0x06 after inc (hl)
  m.mem.write8(0x8d74, 0x03);    // rst-0x20 index into table 0x53a6
  m.mem.write8(0x53a6 + 0x03, 0x44); // table[0x53a9] -> A after the lookup
}

const PC_A = [
  0x5377, 0x537a, 0x537b, 0x537e, 0x537f, 0x5383, 0x5386, 0x5388, 0x538a,
  0x538e,                 // jr nz taken (E stays 0x1d)
  0x53a0,                 // call 0x53a0 -> target
  0x5394, 0x5397,
  0x0020,                 // rst 0x20 -> target
  0x539b, 0x539e, 0x539f,
  GRANDRET,               // pop af drops CALLER_RET, ret lands one level up
];

test("loc_5374 Path A: word 0, 0x8907 bit0=1 -> E=0x1d, full body + skip-return", () => {
  const m = makeMachine();
  setupBody(m);
  m.mem.write8(0x8907, 0x01); // bit0 set -> jr nz taken -> E kept at 0x1d

  loc_5374(m);

  assert.equal(m.tstates, 232, "Path A T-state total");
  assert.deepEqual(m.pcSeq, PC_A, "step boundaries match the ROM bytes");
  assert.equal(m.pc, GRANDRET, "skip-return lands one level above the caller");
  assert.deepEqual(m.calls, [0x53a0, 0x0020], "loc_53a0 then rst-0x20/loc_0020");
  assert.equal(m.regs.e, 0x1d, "E kept at 0x1d (0x8907 bit0 set)");
  assert.equal(m.mem.read8(0x8d79), 0x06, "counter 0x8d79 incremented");
  assert.equal(m.mem.read8(IX + 0x00), 0x01, "(ix+0) marked active");
  assert.equal(m.mem.read8(IX + 0x07), 0xc4, "(ix+7) = 0x44 | 0x80");
  // pop af discarded CALLER_RET (loaded into AF); the final ret consumed GRANDRET -> SP back to baseline.
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to the pre-seat baseline (skip-return)");
});

test("loc_5374 Path B: word 0, 0x8907 bit0=0 -> ld e,0x04", () => {
  const m = makeMachine();
  setupBody(m);
  m.mem.write8(0x8907, 0x00); // bit0 clear -> jr nz not taken -> E := 0x04

  loc_5374(m);

  assert.equal(m.tstates, 234, "Path B T-state total (jr not taken + ld e,0x04)");
  assert.deepEqual(m.pcSeq, [
    0x5377, 0x537a, 0x537b, 0x537e, 0x537f, 0x5383, 0x5386, 0x5388, 0x538a,
    0x538c, 0x538e,         // jr nz not taken -> ld e,0x04
    0x53a0, 0x5394, 0x5397, 0x0020, 0x539b, 0x539e, 0x539f, GRANDRET,
  ], "bit0=0 takes the ld e,0x04 fall-through");
  assert.equal(m.pc, GRANDRET, "skip-return lands one level above the caller");
  assert.equal(m.regs.e, 0x04, "E := 0x04 (0x8907 bit0 clear)");
  assert.equal(m.mem.read8(IX + 0x07), 0xc4, "(ix+7) = 0x44 | 0x80");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_5374 Path EARLY: word non-zero -> ret nz, no work", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x00, 0x10); // word non-zero -> entry already active
  m.mem.write8(IX + 0x01, 0x00);
  m.mem.write8(0x8d79, 0x05);

  loc_5374(m);

  assert.equal(m.tstates, 19 + 19 + 11, "T = ld a,(ix+0) + or (ix+1) + ret nz taken");
  assert.deepEqual(m.pcSeq, [0x5377, 0x537a, CALLER_RET], "ret nz returns normally to the caller");
  assert.equal(m.pc, CALLER_RET, "normal return (no skip)");
  assert.deepEqual(m.calls, [], "no calls");
  assert.equal(m.mem.read8(0x8d79), 0x05, "counter untouched");
  assert.equal(m.regs.sp, 0x877e, "only the caller return was popped");
});

test("loc_5374 MUTATION: `or (ix+7)` mis-charged 7T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x539b ? 7 : cycles);
  setupBody(m);
  m.mem.write8(0x8907, 0x01);

  loc_5374(m);

  assert.equal(m.tstates, 220, "mutation loses 12 T (19 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 232, "Path A T-state total"),
    /232/,
    "the 232-T golden must fail on the mutant",
  );
});
