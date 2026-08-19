// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_0320 (ROM 0x0320-0x0329): the external jp-nz target that decrements a
// caller-set frame counter, then gates the loc_0378 mirror pass on (0x881f).
// Flat-RAM mock (real Regs). loc_0378 is a plain-ret routine, so the call is pattern-A: the stub
// runs m.ret() to pop the pushed return -- a record-only stub would hide the stack.
//
// Run: node --test games/pooyan/translated/test/loc_0320.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0320 } from "../loc_0320.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// loc_0378 is a plain-ret routine: the pattern-A stub pops its pushed return via m.ret().
function installMirrorStub(m) {
  m.call = (addr) => { m.calls.push(addr); m.ret(); return undefined; };
}

// ── Path A: gate (0x881f) non-zero -> ret nz taken, no mirror ──────────────────────────────────
test("loc_0320 Path A: (0x881f)!=0 -> dec counter, ret nz; 39 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x8898;
  m.mem.write8(0x8898, 5);
  m.mem.write8(0x881f, 1);

  loc_0320(m);

  assert.equal(m.tstates, 39, "Path A T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret nz");
  assert.equal(m.mem.read8(0x8898), 4, "(hl) frame counter decremented");
  assert.deepEqual(m.calls, [], "gate live -> no mirror pass");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.pcSeq, [0x0321, 0x0324, 0x0325, CALLER_RET], "Path A boundaries");
});

// ── Path B: gate (0x881f) == 0 -> ret nz not taken, loc_0378 pass ──────────────────────────────
test("loc_0320 Path B: (0x881f)==0 -> mirror via loc_0378; 70 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installMirrorStub(m);
  m.regs.hl = 0x8898;
  m.mem.write8(0x8898, 1);
  m.mem.write8(0x881f, 0);

  loc_0320(m);

  assert.equal(m.tstates, 70, "Path B T-state total");
  assert.equal(m.pc, CALLER_RET, "returns to caller after the mirror pass");
  assert.equal(m.mem.read8(0x8898), 0, "(hl) frame counter decremented to 0");
  assert.deepEqual(m.calls, [0x0378], "loc_0378 mirror pass runs once");
  assert.equal(m.regs.sp, 0x8780, "stack balanced (pattern-A call + final ret)");
  assert.deepEqual(m.pcSeq, [0x0321, 0x0324, 0x0325, 0x0326, 0x0378, 0x0329, CALLER_RET], "Path B boundaries");
});

test("loc_0320 MUTATION: dec (hl) mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x8898;
  m.mem.write8(0x8898, 5);
  m.mem.write8(0x881f, 1);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0321 ? 7 : c);

  loc_0320(m);

  assert.equal(m.tstates, 35, "mutation loses 4 T (11 -> 7)");
  assert.notEqual(m.tstates, 39, "golden T-state total catches the mutant");
});
