// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_7912 (ROM 0x7912-0x795f): the BCD-counter tick. Pure LEAF -- no calls,
// every exit is a ret -- so a seated caller return is popped by each path and SP must return to
// 0x8780. Flat-RAM mock with real Regs. Four paths pin the T-state totals (28/102/172/341) and the
// memory the increment/rollover cascade writes; a mutation proves the golden T catches a mis-charge.
//
// Run: node --test games/pooyan/translated/test/loc_7912.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_7912 } from "../loc_7912.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x7912, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.ret(0); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// ── Path 1: (0x8806)==0 -> ret z immediately ───────────────────────────────────────────────────
test("loc_7912 path1: (0x8806)==0 -> ret z; 28 T; no writes", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8806, 0x00);

  loc_7912(m);

  assert.equal(m.tstates, 28, "path1 own T");
  assert.equal(m.pc, CALLER_RET, "ret z returns to caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced (leaf ret pops caller)");
  assert.deepEqual(m.calls, [], "leaf makes no calls");
  assert.deepEqual(m.pcSeq, [0x7915, 0x7916, CALLER_RET], "path1 boundaries");
});

// ── Path 2: active, second pair (0x880d!=0), gate byte (0x89e2) set -> ret nz ────────────────────
test("loc_7912 path2: (0x880d)!=0 picks 0x89e2/0x8a33, gate set -> ret nz; 102 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8806, 0x01);
  m.mem.write8(0x880d, 0x01);
  m.mem.write8(0x89e2, 0x01); // gate byte of the second pair -> bail

  loc_7912(m);

  assert.equal(m.tstates, 102, "path2 own T");
  assert.equal(m.pc, CALLER_RET, "ret nz returns to caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.calls, [], "no calls");
  assert.deepEqual(m.pcSeq,
    [0x7915, 0x7916, 0x7917, 0x791a, 0x791b, 0x791e, 0x7921, 0x7923, 0x7925, 0x7927, 0x7928, 0x7929, CALLER_RET],
    "path2 boundaries: the 0x880d!=0 branch reassigns L/E then the gate ret nz's");
});

// ── Path 3: active, first pair, below limit -> inc (hl); ret ─────────────────────────────────────
test("loc_7912 path3: below limit -> inc counter; 172 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8806, 0x01);
  m.mem.write8(0x880d, 0x00); // -> keep 0x89e1/0x8a30
  m.mem.write8(0x89e1, 0x00); // gate clear
  m.mem.write8(0x8a31, 0x00); // flag byte bit0=0 -> limit 0x3b
  m.mem.write8(0x8a30, 0x10); // counter below limit

  loc_7912(m);

  assert.equal(m.tstates, 172, "path3 own T");
  assert.equal(m.pc, CALLER_RET, "ret returns to caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.calls, [], "no calls");
  assert.equal(m.mem.read8(0x8a30), 0x11, "counter incremented");
  assert.deepEqual(m.pcSeq,
    [0x7915, 0x7916, 0x7917, 0x791a, 0x791b, 0x791e, 0x7921, 0x7927, 0x7928, 0x7929,
      0x792a, 0x792b, 0x792c, 0x792d, 0x792f, 0x7931, 0x7934, 0x7935, 0x7936, 0x7938, 0x7939, CALLER_RET],
    "path3 boundaries through the simple-inc tail");
});

// ── Path 4: deep BCD rollover cascading through all three digits -> ret at 0x795f ────────────────
test("loc_7912 path4: full rollover cascade to 0x795f; 341 T; digit writes", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8806, 0x01);
  m.mem.write8(0x880d, 0x00); // first pair
  m.mem.write8(0x89e1, 0x00); // gate clear
  m.mem.write8(0x8a31, 0x59); // flag byte: bit0=1 -> limit 0x3c; also digit-2, rolls 0x59->0x5a->0x60->0
  m.mem.write8(0x8a30, 0x3c); // counter at limit -> roll
  m.mem.write8(0x8a32, 0x09); // digit-3: 0x09 -> 0x0a low-nibble roll -> 0x10

  loc_7912(m);

  assert.equal(m.tstates, 341, "path4 own T (deep cascade)");
  assert.equal(m.pc, CALLER_RET, "final ret returns to caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.calls, [], "no calls");
  assert.equal(m.mem.read8(0x8a30), 0x00, "digit-1 rolled to 0");
  assert.equal(m.mem.read8(0x8a31), 0x00, "digit-2 rolled to 0 (its high nibble hit 0x60)");
  assert.equal(m.mem.read8(0x8a32), 0x10, "digit-3 carried to 0x10");
});

// ── MUTATION: mis-charge the `inc (hl)` (0x7938->0x7939 step, 11T) as 0 on path 3 ────────────────
test("loc_7912 MUTATION: a dropped inc-(hl) charge (11T) is caught on path3", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8806, 0x01);
  m.mem.write8(0x880d, 0x00);
  m.mem.write8(0x89e1, 0x00);
  m.mem.write8(0x8a31, 0x00);
  m.mem.write8(0x8a30, 0x10);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x7939 ? 0 : c); // drop the inc-(hl) 11 T

  loc_7912(m);

  assert.equal(m.tstates, 161, "mutation drops 11 T");
  assert.notEqual(m.tstates, 172, "golden T catches the dropped step");
});
