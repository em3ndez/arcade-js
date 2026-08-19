// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_0ac8 (ROM 0x0ac8-0x0b25), attract sub-state 5.
// Self-contained mock (real Regs for exact flags, flat 64K RAM). Delegated calls are recorded in
// m.calls; a returning callee is stubbed to balance its pushed return (SP += 2). Every exit is a
// `ret`, so the caller's seated return proves which exit fired.
//
// Run: node --test games/pooyan/translated/test/loc_0ac8.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0ac8 } from "../loc_0ac8.js";

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
    call(addr) { this.calls.push(addr); regs.sp = (regs.sp + 2) & 0xffff; return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// ── Path A: (0x8d41) still counting (skip 0x0a28) + (0x8e50) still counting -> early `ret nz` ──
test("loc_0ac8 Path A: timers still counting -> ret nz after call 0x09f8; 82 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d41, 0x02); // dec -> 1, non-zero: jr nz skips call 0x0a28
  m.mem.write8(0x8e50, 0x05); // dec -> 4, non-zero: ret nz fires

  loc_0ac8(m);

  assert.equal(m.tstates, 82, "Path A T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret nz");
  assert.equal(m.regs.sp, 0x8780, "call push balanced, ret popped the caller");
  assert.deepEqual(m.calls, [0x09f8], "0x0a28 skipped; only 0x09f8 called");
  assert.equal(m.mem.read8(0x8d41), 0x01, "(0x8d41) decremented");
  assert.equal(m.mem.read8(0x8e50), 0x04, "(0x8e50) decremented, ret nz");
  assert.deepEqual(m.pcSeq,
    [0x0acb, 0x0acc, 0x0ad1, 0x09f8, 0x0ad7, 0x0ad8, CALLER_RET],
    "Path A step boundaries");
});

test("loc_0ac8 Path A MUTATION: a dropped call-step (17 -> 0) loses exactly 17 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d41, 0x02);
  m.mem.write8(0x8e50, 0x05);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x09f8 ? 0 : c);
  loc_0ac8(m);
  assert.equal(m.tstates, 65, "mutation loses the 17 T of `call 0x09f8`");
  assert.notEqual(m.tstates, 82, "golden T-state total catches the mutant");
});

// ── Path B: both frame timers roll over -> re-seed + 14-row checksum (all-zero data passes) ──
function setupPathB(m) {
  seatCaller(m);
  m.mem.write8(0x8d41, 0x01);   // dec -> 0: jr nz NOT taken -> call 0x0a28
  m.mem.write8(0x8e50, 0x01);   // dec -> 0: ret nz NOT taken
  m.mem.write16(0x8e54, 0x9000); // script read pointer
  m.mem.write16(0x8e56, 0x9100); // sprite write pointer
  m.mem.write8(0x8e52, 0x01);   // dec -> 0: ret nz NOT taken
  m.mem.write16(0x8f48, 0x9200); // checksum-expectation pointer (points at zero bytes)
}

test("loc_0ac8 Path B: rollover runs the 14-row checksum, passes, advances 0x8f48; loop lands 14x", () => {
  const m = makeMachine();
  setupPathB(m);

  loc_0ac8(m);

  assert.equal(m.pc, CALLER_RET, "returns via the final ret (no tamper jump)");
  assert.deepEqual(m.calls, [0x0a28, 0x09f8], "both timer callees, no 0x7442/0x76ea trap");
  const loopLandings = m.pcSeq.filter((p) => p === 0x0b04).length;
  assert.equal(loopLandings, 14, "the 14-iteration checksum loop head lands once per pass");
  assert.equal(m.mem.read8(0x8d41), 0x00, "(0x8d41) reached zero");
  assert.equal(m.mem.read16(0x8e56), 0x90e0, "(0x8e56) advanced back one row (-0x20)");
  assert.equal(m.mem.read16(0x8e54), 0x9001, "(0x8e54) script pointer advanced");
  assert.equal(m.mem.read16(0x8f48), 0x9202, "(0x8f48) checksum pointer advanced past 2 bytes");
  assert.equal(m.regs.e, 0x00, "E = low byte of the (zero) row sum");
  assert.equal(m.regs.d, 0x00, "D = high byte of the (zero) row sum");
});

test("loc_0ac8 Path B MUTATION: a dropped loop `ld a,(hl)` step (7 -> 0) loses 14*7 = 98 T", () => {
  const full = makeMachine();
  setupPathB(full);
  loc_0ac8(full);

  const mut = makeMachine();
  setupPathB(mut);
  const realStep = mut.step.bind(mut);
  mut.step = (n, c) => realStep(n, n === 0x0b05 ? 0 : c);
  loc_0ac8(mut);

  assert.equal(full.tstates - mut.tstates, 98, "the 14 loop-load steps contribute 98 T");
});
