// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_7517 (ROM 0x7517-0x755c): dispatch state 1 -- the HUD-checksum gate.
// Flat-RAM mock (real Regs). 0x4381 and 0x0fb2 are plain-ret callees (pattern A; the stub runs
// m.ret() to pop the pushed return). 0x43e1 / 0x462c are anti-tamper abort vectors.
//
// Run: node --test games/pooyan/translated/test/loc_7517.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_7517 } from "../loc_7517.js";

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
    call(addr) { this.calls.push(addr); return undefined; }, // default record-only; abort vectors are jp
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// Plain-ret callees (0x4381, 0x0fb2) pop the pattern-A return via m.ret() (charging 10 T). The
// abort vectors (0x43e1, 0x462c) are reached by a jp (tail delegate), NOT a call, so they are
// record-only: the preceding m.step already parked PC on them and a stray ret would unwind it.
function installBalancingCalls(m) {
  const balanced = new Set([0x4381, 0x0fb2]);
  m.call = (addr) => { m.calls.push(addr); if (balanced.has(addr)) m.ret(); return undefined; };
}

// ── Path 1: counter not yet 0x1c -> ret nz ──────────────────────────────────────────────────────
test("loc_7517 Path 1: (0x88b7) inc to != 0x1c -> ret nz; 73 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(0x88b7, 0x00); // inc -> 0x01 != 0x1c

  loc_7517(m);

  assert.equal(m.tstates, 73, "Path 1 T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret nz");
  assert.deepEqual(m.calls, [0x4381], "only the 0x4381 helper ran");
  assert.equal(m.mem.read8(0x88b7), 0x01, "(0x88b7) ticked");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.pcSeq, [0x4381, 0x751a, 0x751d, 0x751e, 0x751f, 0x7521, CALLER_RET], "Path 1 boundaries");
});

// ── Path 2: counter hits 0x1c, sub-phase (0x8920) was 0 -> ret z ─────────────────────────────────
test("loc_7517 Path 2: (0x88b7)==0x1c, (0x8920)==0 -> steps sub-phase, ret z; 123 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(0x88b7, 0x1b); // inc -> 0x1c
  m.mem.write8(0x8920, 0x00); // pre-inc value 0 -> ret z

  loc_7517(m);

  assert.equal(m.tstates, 123, "Path 2 T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret z");
  assert.equal(m.mem.read8(0x8920), 0x01, "(0x8920) advanced");
  assert.equal(m.mem.read8(0x88b7), 0x00, "(0x88b7) reset to the pre-inc (0x8920) value (0)");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.pcSeq,
    [0x4381, 0x751a, 0x751d, 0x751e, 0x751f, 0x7521, 0x7522, 0x7525, 0x7526, 0x7527, 0x7528, 0x752b, CALLER_RET],
    "Path 2 boundaries");
});

// Seed the two 14-tile strips so the column sum totals 0x014f: E=0x4f (pass cp), D=1 (pass dec d).
// 0xff at 0x82bc + 0x50 at 0x829c wrap once (D:=1); every other summed tile is 0.
function seedGoodStrips(m) {
  m.mem.write8(0x88b7, 0x1b); // -> 0x1c
  m.mem.write8(0x8920, 0x05); // pre-inc != 0 -> past ret z, into the HUD sum
  m.mem.write8(0x82bc, 0xff);
  m.mem.write8(0x829c, 0x50);
}

// ── Path 3: HUD sum checks out -> advance selector (0x8921), tail-call 0x0fb2, ret ───────────────
test("loc_7517 Path 3: good HUD sum -> (0x8921)++ then call 0x0fb2, ret; 2159 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  seedGoodStrips(m);

  loc_7517(m);

  assert.equal(m.tstates, 2159, "Path 3 T-state total (prefix + 2 strips x14 + suffix)");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.regs.e, 0x4f, "E = summed low byte");
  assert.equal(m.regs.d, 0x00, "D decremented from 1 to 0 by the dec d check");
  assert.equal(m.mem.read8(0x8921), 0x01, "(0x8921) advanced to state 2");
  assert.deepEqual(m.calls, [0x4381, 0x0fb2], "0x4381 helper then the 0x0fb2 tail-call");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.equal(m.pcSeq.filter((p) => p === 0x7536).length, 28, "inner sum ran 28 times (2 strips x 14)");
  assert.equal(m.pcSeq.filter((p) => p === 0x753b).length, 1, "add-carry inc d fired exactly once");
  assert.equal(m.pcSeq.filter((p) => p === 0x7542).length, 4, "HL page borrow dec h fired 4 times (2 per strip)");
});

// ── Abort: HUD sum wrong low byte -> anti-tamper trap 0x43e1 ─────────────────────────────────────
test("loc_7517 abort: bad HUD low byte -> throws trap 0x43e1", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(0x88b7, 0x1b);
  m.mem.write8(0x8920, 0x05);
  // all strip tiles 0 -> sum 0 -> E=0 != 0x4f
  assert.throws(() => loc_7517(m), /trap 0x43e1/);
});

// ── Abort: HUD sum right low byte, wrong high byte -> anti-tamper trap 0x462c ─────────────────────
test("loc_7517 abort: good low byte, D!=1 -> throws trap 0x462c", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(0x88b7, 0x1b);
  m.mem.write8(0x8920, 0x05);
  // sum totals 0x024f: E=0x4f passes cp, D=2 -> dec d = 1 (nz) -> abort
  m.mem.write8(0x82bc, 0xff);
  m.mem.write8(0x829c, 0x50); // first strip wraps once (D:=1, E:=0x4f)
  m.mem.write8(0x86bc, 0xff);
  m.mem.write8(0x869c, 0x01); // second strip wraps again (D:=2, E back to 0x4f)
  assert.throws(() => loc_7517(m), /trap 0x462c/);
});

// ── MUTATION: `inc d` carry arm (0x753b) mis-charged 12T (not 4T) is caught ──────────────────────
test("loc_7517 MUTATION: inc d at 0x753b mis-charged is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  seedGoodStrips(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x753c && c === 4 ? 12 : c); // only the inc-d landing (4T) at 0x753c
  loc_7517(m);
  assert.equal(m.tstates, 2167, "mutation adds 8 T on the single carry arm");
  assert.notEqual(m.tstates, 2159, "golden T-state total catches the mutant");
});
