// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_23e8 (ROM 0x23E8-0x241B). Asserts the T-state total and
// the routine's key register/flag/memory/control-flow effects against the
// disassembly, on BOTH control-flow paths, plus a deliberate mutation the
// invariant checker must catch.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_23e8 } from "../loc_23e8.js";

// A minimal, faithful stand-in for the machine the routine runs on: real Regs,
// real AddressSpace/Io, and step/call/ret/push16 modelled exactly like the DK
// machine (step advances PC + charges T-states; call dispatches through the
// registry; here it just RECORDS the target so the routine is tested in
// isolation, since 0x4CA3 has no thepit translation yet).
class MockMachine {
  constructor() {
    this.regs = new Regs();
    this.io = new Io();
    this.mem = new AddressSpace(new Uint8Array(0x5000), this.io);
    this.regs.sp = 0x8780; // stack inside work RAM so push16 lands in mapped RAM
    this.cycles = 0;
    this.pc = 0x23e8;
    this.calls = [];
    this.returned = false;
  }
  step(nextAddr, cycles) {
    this.pc = nextAddr;
    this.cycles += cycles;
  }
  call(addr) {
    this.calls.push(addr);
    return undefined; // stubbed callee -- we assert only that the call happened
  }
  ret(cycles = 10) {
    this.cycles += cycles;
    this.returned = true;
  }
  push16(value) {
    this.regs.sp = (this.regs.sp - 2) & 0xffff;
    this.mem.write8(this.regs.sp, value & 0xff);
    this.mem.write8((this.regs.sp + 1) & 0xffff, (value >> 8) & 0xff);
  }
}

// ---- expected values for the FULL path -------------------------------------
// Inputs chosen so every branch takes its "do work" arm:
//   (0x8028) = 0x05  -> sla,sla -> b = 0x14 (0x05 << 2)
//   (0x804f) = 0x50  -> a = 0x50 - 0x14 = 0x3c -> (0x8067) = 0x3c
//   (0x9264) = 0x32  -> cp 0x32 == 0 -> call z,0x4ca3 TAKEN
//   (0x90e4) = 0xfe  -> cp 0xfe == 0 -> ret nz NOT taken -> patch two cells
function setupFull(m) {
  m.mem.write8(0x8028, 0x05);
  m.mem.write8(0x804f, 0x50);
  m.mem.write8(0x9264, 0x32);
  m.mem.write8(0x90e4, 0xfe);
}

// The invariants that define correct behaviour on the full path. Shared by the
// real-routine test and the mutation test so the mutation is caught by exactly
// the checks that pass for the real routine.
function checkFull(m) {
  assert.equal(m.cycles, 239, "T-state total (call z taken, ret nz not taken)");
  assert.equal(m.mem.read16(0x8065), 0x9104, "0x8065 = tilemap pointer 0x9104");
  assert.equal(m.regs.b, 0x14, "b = 4 * (0x8028)");
  assert.equal(m.mem.read8(0x8067), 0x3c, "0x8067 = (0x804f) - 4*(0x8028)");
  assert.deepEqual(m.calls, [0x4ca3], "call z,0x4ca3 fired (tile 0x9264 == 0x32)");
  assert.equal(m.regs.ix, 0x90e4, "ix left at 0x90e4");
  assert.equal(m.mem.read8(0x90e4), 0xae, "(0x90e4) patched to 0xAE");
  assert.equal(m.mem.read8(0x90c4), 0xac, "(0x90c4) patched to 0xAC");
  assert.equal(m.regs.fZ, true, "final flags from cp 0xfe (A == 0xFE) -> Z set");
  assert.equal(m.returned, true, "routine returned");
}

test("loc_23e8 full path: pointer/countdown seeded, 0x4ca3 called, cells patched", () => {
  const m = new MockMachine();
  setupFull(m);
  loc_23e8(m);
  checkFull(m);
});

test("loc_23e8 early return: call z skipped, ret nz taken leaves VRAM untouched", () => {
  const m = new MockMachine();
  m.mem.write8(0x8028, 0x03); // b = 0x0c
  m.mem.write8(0x804f, 0x40); // (0x8067) = 0x40 - 0x0c = 0x34
  m.mem.write8(0x9264, 0x00); // != 0x32 -> call z NOT taken
  m.mem.write8(0x90e4, 0x24); // != 0xfe -> ret nz TAKEN (early return)
  loc_23e8(m);

  // Path total: call z not taken (10) + ret nz taken (11), no patch/no final ret.
  assert.equal(m.cycles, 190, "T-state total (call z not taken, ret nz taken)");
  assert.deepEqual(m.calls, [], "0x4ca3 not called when tile 0x9264 != 0x32");
  assert.equal(m.mem.read16(0x8065), 0x9104, "pointer still seeded before the branch");
  assert.equal(m.mem.read8(0x8067), 0x34, "countdown still stored before the branch");
  assert.equal(m.mem.read8(0x90e4), 0x24, "head cell untouched on the ret-nz path");
  assert.equal(m.mem.read8(0x90c4), 0x00, "sibling cell untouched on the ret-nz path");
  assert.equal(m.regs.fNZ, true, "cp 0xfe left NZ (A != 0xFE)");
  assert.equal(m.returned, true, "routine returned via ret nz");
});

// ---- MUTATION --------------------------------------------------------------
// A faithful copy of the translation with ONE deliberate break: `sub b` at
// 0x23f9 replaced by `add b` (add instead of subtract). The countdown at
// 0x8067 becomes (0x804f) + 4*(0x8028) = 0x64 instead of 0x3c, which checkFull
// must reject. This proves the memory invariant has teeth.
function loc_23e8_MUTANT(m) {
  const { regs, mem } = m;
  regs.hl = 0x9104;
  m.step(0x23eb, 10);
  mem.write16(0x8065, regs.hl);
  m.step(0x23ee, 16);
  regs.a = mem.read8(0x8028);
  m.step(0x23f1, 13);
  regs.a = regs.sla(regs.a);
  m.step(0x23f3, 8);
  regs.a = regs.sla(regs.a);
  m.step(0x23f5, 8);
  regs.b = regs.a;
  m.step(0x23f6, 4);
  regs.a = mem.read8(0x804f);
  m.step(0x23f9, 13);
  regs.add(regs.b); // <-- MUTATION: `add b` instead of `sub b`
  m.step(0x23fa, 4);
  mem.write8(0x8067, regs.a);
  m.step(0x23fd, 13);
  regs.ix = 0x9264;
  m.step(0x2401, 14);
  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
  m.step(0x2404, 19);
  regs.cp(0x32);
  m.step(0x2406, 7);
  if (regs.fZ) {
    m.push16(0x2409);
    m.step(0x4ca3, 17);
    m.call(0x4ca3);
  } else {
    m.step(0x2409, 10);
  }
  regs.ix = 0x90e4;
  m.step(0x240d, 14);
  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
  m.step(0x2410, 19);
  regs.cp(0xfe);
  m.step(0x2412, 7);
  if (regs.fNZ) {
    m.ret(11);
    return;
  }
  m.step(0x2413, 5);
  mem.write8((regs.ix + 0x00) & 0xffff, 0xae);
  m.step(0x2417, 19);
  mem.write8((regs.ix - 0x20) & 0xffff, 0xac);
  m.step(0x241b, 19);
  m.ret(10);
}

test("MUTATION caught: `add b` for `sub b` corrupts the countdown 0x8067", () => {
  const good = new MockMachine();
  setupFull(good);
  loc_23e8(good);
  checkFull(good); // sanity: the real routine passes

  const bad = new MockMachine();
  setupFull(bad);
  loc_23e8_MUTANT(bad);
  assert.equal(bad.mem.read8(0x8067), 0x64, "mutant produces 0x50 + 0x14 = 0x64");
  assert.throws(() => checkFull(bad), "the invariant checker must reject the mutant");
});
