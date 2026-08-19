// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_6b13 (ROM 0x6b13-0x6b3a): the frame-gated two-tile blitter.
// Flat-RAM mock (real Regs). loc_3325 is a plain-ret subroutine, so each call site is pattern-A
// (push return, then call) and the stub MUST run m.ret() to pop that return -- a record-only stub
// that skips the ret hides the stack: it was why a pattern-B mis-translation of both calls passed.
//
// Run: node --test games/pooyan/translated/test/loc_6b13.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6b13 } from "../loc_6b13.js";

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

// loc_3325 is a plain-ret routine: the stub pops the pattern-A pushed return via m.ret(), so the
// two-blit stack sequence is exercised for real (a record-only stub would mask a pattern-B bug).
function installBlitStub(m) {
  m.call = (addr) => { m.calls.push(addr); m.ret(); return undefined; };
}

// ── Path A: countdown non-zero -> dec (0x8f06), ret ───────────────────────────────────────────
test("loc_6b13 Path A: (0x8f06)!=0 -> dec, ret; 49 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f06, 5);

  loc_6b13(m);

  assert.equal(m.tstates, 49, "Path A T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.mem.read8(0x8f06), 4, "(0x8f06) decremented");
  assert.deepEqual(m.calls, [], "leaf: no draw calls on the hold path");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.pcSeq, [0x6b16, 0x6b17, 0x6b18, 0x6b1a, 0x6b1b, CALLER_RET], "Path A boundaries");
});

// ── Path B: expiry, phase odd -> DE = 0x2748, two loc_3325 draws ──────────────────────────────
test("loc_6b13 Path B: (0x8f06)==0, phase odd -> reload, DE=0x2748, two draws; 217 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBlitStub(m);
  m.mem.write8(0x8f06, 0);   // hold expired
  m.mem.write8(0x8f07, 0);   // phase -> inc to 1 (odd)

  loc_6b13(m);

  assert.equal(m.tstates, 217, "Path B (odd) T-state total");
  assert.equal(m.pc, CALLER_RET, "returns to its caller after both blits");
  assert.equal(m.mem.read8(0x8f06), 0x0c, "(0x8f06) reloaded to 0x0c");
  assert.equal(m.mem.read8(0x8f07), 0x01, "(0x8f07) phase advanced to 1");
  assert.deepEqual(m.calls, [0x3325, 0x3325], "two draws via loc_3325");
  assert.equal(m.regs.de, 0x2748, "DE restored to the odd-phase data block for the 2nd draw");
  assert.equal(m.regs.hl, 0x8454, "HL = 0x84b4 - 0x60 for the second draw");
  assert.equal(m.regs.sp, 0x8780, "stack balanced (push de / pop de + two pattern-A calls)");
  assert.deepEqual(m.pcSeq,
    [0x6b16, 0x6b17, 0x6b18, 0x6b1c, 0x6b1e, 0x6b1f, 0x6b20, 0x6b21, 0x6b23, 0x6b26,
     0x6b29, 0x6b2b, 0x6b2e, 0x6b2f, 0x3325, 0x6b32, 0x6b35, 0x6b36, 0x6b37, 0x3325, 0x6b3a, CALLER_RET],
    "Path B boundaries (each call steps into 0x3325 then rets to the next op)");
});

// ── Path B': expiry, phase even -> jr z at 0x6b29 taken, DE stays 0x2744 ───────────────────────
test("loc_6b13 Path B': phase even -> DE = 0x2744 (0x6b29 branch taken); 212 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBlitStub(m);
  m.mem.write8(0x8f06, 0);
  m.mem.write8(0x8f07, 1);   // phase -> inc to 2 (even, bit0 = 0)

  loc_6b13(m);

  assert.equal(m.tstates, 212, "Path B' (even) T-state total");
  assert.equal(m.regs.de, 0x2744, "DE = even-phase data block");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.equal(m.mem.read8(0x8f07), 0x02, "(0x8f07) phase advanced to 2");
  assert.ok(!m.pcSeq.includes(0x6b2b), "0x6b2b (odd-phase DE load) skipped");
});

test("loc_6b13 MUTATION: inc (hl) at 0x6b1f mis-charged 6T (not 11T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  installBlitStub(m);
  m.mem.write8(0x8f06, 0);
  m.mem.write8(0x8f07, 0);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x6b20 ? 6 : c);
  loc_6b13(m);
  assert.equal(m.tstates, 212, "mutation loses 5 T (11 -> 6)");
  assert.notEqual(m.tstates, 217, "golden T-state total catches the mutant");
});
