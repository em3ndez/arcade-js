// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_417a (ROM 0x417a-0x418c): the object (re)arm prologue. Reads (ix+0x17),
// loads the 0x41b1 data pointer, calls loc_0c45 then loc_381e, seats (ix+0x11)=0x30, bumps
// (ix+0x02), then FALLS THROUGH into loc_418d (tail continuation, no push -- caller frame reused).
//
// The mock's `call` POPS the pushed return address (models the callee's ret); the tail call to
// loc_418d pops the seated CALLER_RET, so a missing push16 at any call site desyncs SP and the
// baseline assertion catches it. Single straight-line path (no branches inside 0x417a-0x418c).
//
// Run: node --test games/pooyan/translated/test/loc_417a.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_417a } from "../loc_417a.js";

const CALLER_RET = 0xabcd;
const IX = 0x8b70;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x417a, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // Every callee's ret pops the return address the call site pushed. loc_0c45/loc_381e are plain
    // helpers; the tail loc_418d ultimately rets to CALLER_RET (pops the seated frame).
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

const PC_MAIN = [0x417d, 0x4180, 0x0c45, 0x381e, 0x418a, 0x418d];

test("loc_417a: arm prologue -> two calls -> seat fields -> fall through to loc_418d", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8((IX + 0x17) & 0xffff, 0x42); // (ix+0x17) -> A
  m.mem.write8((IX + 0x02) & 0xffff, 0x05); // (ix+0x02) counter, inc -> 0x06

  loc_417a(m);

  assert.equal(m.tstates, 105, "T = 19+10+17+17+19+23");
  assert.deepEqual(m.pcSeq, PC_MAIN, "step boundaries visit the call targets, end at loc_418d");
  assert.equal(m.pc, 0x418d, "last step lands on the fall-through target 0x418d");
  assert.deepEqual(m.calls, [0x0c45, 0x381e, 0x418d], "two helpers then the tail continuation");
  assert.equal(m.regs.a, 0x42, "A = (ix+0x17)");
  assert.equal(m.regs.hl, 0x41b1, "HL = data pointer 0x41b1");
  assert.equal(m.mem.read8((IX + 0x11) & 0xffff), 0x30, "(ix+0x11) seated to 0x30");
  assert.equal(m.mem.read8((IX + 0x02) & 0xffff), 0x06, "(ix+0x02) bumped 0x05 -> 0x06");
  // Tail fall-through: loc_418d's eventual ret pops the seated CALLER_RET, so SP unwinds to baseline.
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (every push16 matched a callee ret)");
});

test("loc_417a MUTATION: `inc (ix+0x02)` mis-charged 11T (not 23T) is caught", () => {
  const m = makeMachine();
  m.regs.ix = IX;
  seatCaller(m);
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x418d ? 11 : cycles);

  loc_417a(m);

  assert.equal(m.tstates, 93, "mutation loses 12 T (23 -> 11)");
  assert.throws(
    () => assert.equal(m.tstates, 105, "T = 19+10+17+17+19+23"),
    /105/,
    "the 105-T golden must fail on the mutant",
  );
});
