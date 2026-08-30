// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_1d6e (ROM 0x1d6e-0x1d9b, falls through into loc_1d82): the countdown-timer
// tick at 0x8f4a.
// Flat-RAM mock (real Regs). loc_79e9 / loc_0038 / loc_0f44 are all plain-ret callees, so each call
// site is pattern A -- the stub runs m.ret() to pop the pushed return (modeling the engine stack so
// a missing push16 shows up as an SP imbalance). The pushed returns therefore also appear in pcSeq
// and their pops charge the default 10 T each, matching the loc_072d convention.
//
// Pinned paths:
//   value == 0x40 boundary: checksum + rst-0x38 enqueue + 0x0f44 sound, then ret.
//   value != 0x40, nonzero: `and a; ret nz` -- early return, no work.
//   value == 0, (0x8907) bit1 clear: full expiry -> set (0x8f61)=1.
//   value == 0, (0x8907) bit1 set: expiry but ret nz before the flag write.
//
// Run: node --test games/pooyan/translated/test/loc_1d6e.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1d6e } from "../loc_1d6e.js";

const CALLER_RET = 0xabcd;
const PATTERN_A = new Set([0x79e9, 0x0038, 0x0f44]);

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  const m = {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1d6e, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // Pattern-A callees pop their pushed return; a bare delegate would only record.
    call(addr) { this.calls.push(addr); if (PATTERN_A.has(addr)) this.ret(); return undefined; },
  };
  return m;
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// ── boundary: (0x8f4a) == 0x40 -> checksum, rst-0x38 enqueue, sound cue ──────────────────────────
test("loc_1d6e boundary: (0x8f4a)==0x40 -> loc_79e9 + rst38 + loc_0f44; 137 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f4a, 0x40);

  loc_1d6e(m);

  // own instrs 107 (10+7+11+7+7+17+10+11+17+10) + 3 pattern-A stub rets (10 each) = 137
  assert.equal(m.tstates, 137, "boundary T-state total incl. 3 pattern-A stub rets");
  assert.equal(m.pc, CALLER_RET, "returns to caller after the boundary work");
  assert.equal(m.mem.read8(0x8f4a), 0x3f, "timer decremented 0x40 -> 0x3f");
  assert.equal(m.regs.a, 0x40, "A holds the pre-decrement value (cp does not alter A)");
  assert.equal(m.regs.de, 0x0626, "DE=0x0626 handed to the rst-0x38 enqueue");
  assert.deepEqual(m.calls, [0x79e9, 0x0038, 0x0f44], "checksum, rst-0x38 enqueue, sound cue");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.pcSeq, [
    0x1d71, 0x1d72, 0x1d73, 0x1d75, 0x1d77,
    0x79e9, 0x1d7a, 0x1d7d, 0x0038, 0x1d7e, 0x0f44, 0x1d81, CALLER_RET,
  ], "boundary boundaries");
});

// ── running: (0x8f4a) != 0x40 and nonzero -> and a; ret nz ───────────────────────────────────────
test("loc_1d6e running: (0x8f4a)==0x05 -> ret nz, no work; 62 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f4a, 0x05);
  m.mem.write8(0x880a, 0x99); // sentinel: must stay untouched

  loc_1d6e(m);

  assert.equal(m.tstates, 62, "T = 10+7+11+7+12(jr taken)+4(and a)+11(ret nz)");
  assert.equal(m.pc, CALLER_RET, "returns via ret nz");
  assert.equal(m.mem.read8(0x8f4a), 0x04, "timer still decremented 0x05 -> 0x04");
  assert.deepEqual(m.calls, [], "no callees on the running path");
  assert.equal(m.mem.read8(0x880a), 0x99, "expiry work skipped -> (0x880a) untouched");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.pcSeq, [0x1d71, 0x1d72, 0x1d73, 0x1d75, 0x1d82, 0x1d83, CALLER_RET],
    "running boundaries");
});

// ── expiry, full: (0x8f4a)==0 and (0x8907) bit1 clear -> set (0x8f61)=1 ───────────────────────────
test("loc_1d6e expiry full: (0x8f4a)==0, (0x8907) bit1 clear -> (0x8f61)=1; 162 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f4a, 0x00);
  m.mem.write8(0x8907, 0x00); // bit 1 clear

  loc_1d6e(m);

  assert.equal(m.tstates, 162, "full-expiry T-state total");
  assert.equal(m.pc, CALLER_RET, "returns after setting the flag");
  assert.equal(m.mem.read8(0x8f4a), 0xff, "timer wrapped 0x00 -> 0xff");
  assert.equal(m.mem.read8(0x880a), 0x00, "(0x880a) cleared");
  assert.equal(m.mem.read8(0x8f50), 0x02, "(0x8f50) set to 0x02 (HL=0x8f50 via ld l,0x50)");
  assert.equal(m.mem.read8(0x8d07), 0x40, "(0x8d07) set to 0x40");
  assert.equal(m.mem.read8(0x8f61), 0x01, "(0x8f61) flag set to 1");
  assert.deepEqual(m.calls, [], "no callees on the expiry path");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.pcSeq, [
    0x1d71, 0x1d72, 0x1d73, 0x1d75, 0x1d82, 0x1d83, 0x1d84, 0x1d87, 0x1d89, 0x1d8b,
    0x1d8e, 0x1d90, 0x1d93, 0x1d95, 0x1d96, 0x1d98, 0x1d9b, CALLER_RET,
  ], "full-expiry boundaries");
});

// ── expiry, bit1 set: (0x8f4a)==0 and (0x8907) bit1 set -> ret nz before the flag write ───────────
test("loc_1d6e expiry bit1 set: (0x8907) bit1 set -> ret nz, no (0x8f61) write; 138 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f4a, 0x00);
  m.mem.write8(0x8907, 0x02); // bit 1 set
  m.mem.write8(0x8f61, 0x55); // sentinel: must stay untouched

  loc_1d6e(m);

  assert.equal(m.tstates, 138, "bit1-set T-state total (ret nz taken after bit)");
  assert.equal(m.pc, CALLER_RET, "returns via ret nz after the bit test");
  assert.equal(m.mem.read8(0x8f50), 0x02, "(0x8f50) still written before the bit test");
  assert.equal(m.mem.read8(0x8d07), 0x40, "(0x8d07) still written before the bit test");
  assert.equal(m.mem.read8(0x8f61), 0x55, "(0x8f61) NOT written -- bailed on bit 1 set");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.pcSeq, [
    0x1d71, 0x1d72, 0x1d73, 0x1d75, 0x1d82, 0x1d83, 0x1d84, 0x1d87, 0x1d89, 0x1d8b,
    0x1d8e, 0x1d90, 0x1d93, 0x1d95, CALLER_RET,
  ], "bit1-set boundaries");
});

// ── TEETH: mis-charge `dec (hl)` (11 T) as 7 T on the boundary path ───────────────────────────────
test("loc_1d6e MUTATION: dec (hl) mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f4a, 0x40);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1d73 ? 7 : c);

  loc_1d6e(m);

  assert.equal(m.tstates, 133, "mutation loses 4 T (11 -> 7)");
  assert.notEqual(m.tstates, 137, "golden T-state total catches the mutant");
});
