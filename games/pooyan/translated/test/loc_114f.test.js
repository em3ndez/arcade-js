// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for translated loc_114f (ROM 0x114f, Pooyan) -- sub-state 5 handler. HL=0x8f62 is a
// countdown timer. Non-zero: dec it, ret. Zero (loc_1158): memset 9 bytes at 0x8f5b via rst 0x10
// (A=0/B=9), call 0x0ecf, set (0x880a)=6, then A = (0x882b) + (0x8a3c); if zero ret, else tail-jump
// to loc_118d.
//
// rst 0x10 (loc_0010) and call 0x0ecf are real ret'ing subroutines, and the tail `jr 0x118d`
// hands off to loc_118d which ultimately rets to loc_114f's caller. The pattern-A popping stub
// models each callee's ret: it pops the pushed return (0x115e / 0x1161), and for the tail jump it
// pops the seated caller -- so the stack stays balanced and pc lands where the callee returns.
//
// Pinned paths:
//   Path A (timer != 0): jr z not taken, dec (hl), ret.
//     T = 10 + 7 + 4 + 7 + 11 + 10 = 49.
//   Path B1 (timer == 0, sum == 0): memset, call, set (0x880a), sum==0 => ret z taken.
//     T = 10+7+4+12+4+7+7 +11+10(rst+stub ret) +17+10(call+stub ret) +7+13+10+13+7+4 +11 = 164.
//   Path B2 (timer == 0, sum != 0): same head, sum!=0 => ret z not taken, jr 0x118d tail.
//     T = ...+ 5(ret z nt) + 12(jr) + 10(tail stub ret) = 180.
//
// TEETH: mis-charge the taken `jr z` (12 T) as 7 T on Path B1 -- the golden T-state must catch it.
//
// Run: node --test games/pooyan/translated/test/loc_114f.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_114f } from "../loc_114f.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x114f, pcSeq: [],
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
    call(addr, site) { this.calls.push(addr); this.site = site; return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

// rst 0x10, call 0x0ecf and the loc_118d tail are all routines that ret: the pattern-A stub pops
// the return that was pushed just before the call (or the seated caller, for the tail jump).
function installPoppingStub(m) {
  m.call = (addr, site) => { m.calls.push(addr); m.site = site; m.ret(); return undefined; };
}

test("loc_114f Path A: timer!=0 -> dec (hl), ret; 49 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f62, 0x03); // timer non-zero

  loc_114f(m);

  assert.equal(m.tstates, 49, "Path A T = 10+7+4+7+11+10");
  assert.deepEqual(m.pcSeq, [0x1152, 0x1153, 0x1154, 0x1156, 0x1157, CALLER_RET],
    "not-taken path: dec, ret to caller");
  assert.deepEqual(m.calls, [], "no delegation on the counting path");
  assert.equal(m.mem.read8(0x8f62), 0x02, "timer decremented 0x03 -> 0x02");
  assert.equal(m.pc, CALLER_RET, "returns to the seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced (single ret)");
});

test("loc_114f Path B1: timer==0, sum==0 -> memset/call, ret z taken; 164 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installPoppingStub(m);
  m.mem.write8(0x8f62, 0x00); // timer expired
  m.mem.write8(0x882b, 0x00);
  m.mem.write8(0x8a3c, 0x00); // sum = 0 -> ret z taken

  loc_114f(m);

  assert.equal(m.tstates, 164, "Path B1 T = 10+7+4+12+4+7+7 +11+10 +17+10 +7+13+10+13+7+4 +11");
  assert.deepEqual(m.pcSeq,
    [0x1152, 0x1153, 0x1154, 0x1158, 0x1159, 0x115b, 0x115d, 0x0010, 0x115e,
     0x0ecf, 0x1161, 0x1163, 0x1166, 0x1169, 0x116c, 0x116d, 0x116e, CALLER_RET],
    "taken path: memset (rst 0x10), call 0x0ecf, sum==0 -> ret z to caller");
  assert.deepEqual(m.calls, [0x0010, 0x0ecf], "delegates memset + 0x0ecf, no tail jump");
  assert.equal(m.mem.read8(0x880a), 0x06, "(0x880a) set to 6");
  assert.equal(m.regs.a, 0x00, "A = sum (0x882b)+(0x8a3c) = 0");
  assert.equal(m.regs.hl, 0x8a3c, "HL left at 0x8a3c");
  assert.equal(m.pc, CALLER_RET, "returns to the seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced (rst+call pops + ret z)");
});

test("loc_114f Path B2: timer==0, sum!=0 -> ret z not taken, tail jr 0x118d; 180 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installPoppingStub(m);
  m.mem.write8(0x8f62, 0x00); // timer expired
  m.mem.write8(0x882b, 0x01);
  m.mem.write8(0x8a3c, 0x00); // sum = 1 -> ret z NOT taken

  loc_114f(m);

  assert.equal(m.tstates, 180, "Path B2 = Path-B head + 5(ret z nt) + 12(jr) + 10(tail stub ret)");
  assert.deepEqual(m.pcSeq,
    [0x1152, 0x1153, 0x1154, 0x1158, 0x1159, 0x115b, 0x115d, 0x0010, 0x115e,
     0x0ecf, 0x1161, 0x1163, 0x1166, 0x1169, 0x116c, 0x116d, 0x116e, 0x116f, 0x118d, CALLER_RET],
    "sum!=0 -> ret z not taken, tail-jump into loc_118d");
  assert.deepEqual(m.calls, [0x0010, 0x0ecf, 0x118d], "memset, 0x0ecf, then tail jump to loc_118d");
  assert.equal(m.mem.read8(0x880a), 0x06, "(0x880a) set to 6");
  assert.equal(m.regs.a, 0x01, "A = sum (0x882b)+(0x8a3c) = 1");
  assert.equal(m.pc, CALLER_RET, "loc_118d tail ultimately rets to the seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced (rst+call pops + tail delegation)");
});

test("loc_114f MUTATION: taken `jr z` mis-charged 7T (not 12T) on Path B1 is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  installPoppingStub(m);
  m.mem.write8(0x8f62, 0x00);
  m.mem.write8(0x882b, 0x00);
  m.mem.write8(0x8a3c, 0x00);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1158 ? 7 : c);

  loc_114f(m);

  assert.equal(m.tstates, 159, "mutation loses 5 T (12 -> 7)");
  assert.notEqual(m.tstates, 164, "golden T-state total catches the mutant");
});
