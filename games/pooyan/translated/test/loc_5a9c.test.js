// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for the coin-counter pulse pair loc_5a9c / loc_5ac0 (ROM 0x5a9c-0x5ae3).
// Both are leaves (no calls); every exit is a `ret`, so the seated caller return proves the exit.
//
// Run: node --test games/pooyan/translated/test/loc_5a9c.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5a9c, loc_5ac0 } from "../loc_5a9c.js";

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

// ── loc_5a9c ──────────────────────────────────────────────────────────────────────────────────
test("loc_5a9c: no pulses queued -> ret z; 28 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8824, 0x00);

  loc_5a9c(m);

  assert.equal(m.tstates, 28, "T total");
  assert.equal(m.pc, CALLER_RET, "returns via ret z");
  assert.deepEqual(m.calls, [], "leaf");
  assert.deepEqual(m.pcSeq, [0x5a9f, 0x5aa0, CALLER_RET], "step boundaries");
});

test("loc_5a9c: fresh pulse (phase 0) -> seed 0x30, raise latch bit 3; 87 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8824, 0x03); // pulses queued
  m.mem.write8(0x8825, 0x00); // phase 0 -> fresh

  loc_5a9c(m);

  assert.equal(m.tstates, 87, "T total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.mem.read8(0x8825), 0x30, "phase seeded to 0x30");
  assert.equal(m.mem.read8(0xa183), 0x01, "latch bit 3 raised");
});

test("loc_5a9c: phase reaches 0x18 -> drop latch bit 3; 119 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8824, 0x03);
  m.mem.write8(0x8825, 0x19); // dec -> 0x18 (the drop point)

  loc_5a9c(m);

  assert.equal(m.tstates, 119, "T total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.mem.read8(0x8825), 0x18, "phase decremented to 0x18");
  assert.equal(m.mem.read8(0xa183), 0x00, "latch bit 3 dropped");
  assert.deepEqual(m.pcSeq,
    [0x5a9f, 0x5aa0, 0x5aa1, 0x5aa4, 0x5aa5, 0x5aa6, 0x5aaf, 0x5ab0,
     0x5ab2, 0x5ab3, 0x5ab5, 0x5ab6, 0x5ab7, 0x5aba, CALLER_RET],
    "step boundaries");
});

test("loc_5a9c: phase reaches 0 -> one pulse consumed (dec 0x8824); 109 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8824, 0x03);
  m.mem.write8(0x8825, 0x01); // dec -> 0

  loc_5a9c(m);

  assert.equal(m.tstates, 109, "T total");
  assert.equal(m.mem.read8(0x8825), 0x00, "phase now 0");
  assert.equal(m.mem.read8(0x8824), 0x02, "one pulse consumed");
});

test("loc_5a9c MUTATION: `dec (hl)` at 0x5ab0 mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8824, 0x03);
  m.mem.write8(0x8825, 0x19);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x5ab0 ? 7 : c);

  loc_5a9c(m);

  assert.equal(m.tstates, 115, "mutation loses 4 T (11 -> 7)");
  assert.notEqual(m.tstates, 119, "golden T-state total catches the mutant");
});

// ── loc_5ac0: the counter-2 twin (latch bit 4 @ 0xa184, counters @ 0x8826/0x8827) ──────────────
test("loc_5ac0: fresh pulse -> seed 0x30, raise latch bit 4; 87 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8826, 0x02);
  m.mem.write8(0x8827, 0x00);

  loc_5ac0(m);

  assert.equal(m.tstates, 87, "T total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.mem.read8(0x8827), 0x30, "phase seeded");
  assert.equal(m.mem.read8(0xa184), 0x01, "latch bit 4 raised");
  assert.deepEqual(m.pcSeq,
    [0x5ac3, 0x5ac4, 0x5ac5, 0x5ac8, 0x5ac9, 0x5aca, 0x5acc, 0x5ace, 0x5acf, 0x5ad2, CALLER_RET],
    "step boundaries");
});

test("loc_5ac0: no pulses -> ret z; 28 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8826, 0x00);

  loc_5ac0(m);

  assert.equal(m.tstates, 28, "T total");
  assert.equal(m.pc, CALLER_RET, "returns via ret z");
});
