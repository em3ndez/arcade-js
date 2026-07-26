// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_03e8 (ROM 0x03E8-0x0672, The Pit). Asserts the T-state
// total and the routine's key register/flag/memory/control-flow effects against
// the disassembly on FOUR distinct paths -- full classification, the timer-expiry
// path that fires both conditional calls, and the two early returns -- plus a
// deliberate mutation the invariant checker must catch.
//
// The T-state totals here are hand-derived from the opcode timings straight off
// the disassembly (jr 12/7, jp 10, ret cc 11/5, call cc 17/10, ld/cp/and/dec/add
// per the Z80 tables), independently of the translation, so a cycle error in the
// translation shows up as a mismatch rather than agreeing with itself.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_03e8 } from "../loc_03e8.js";

// Minimal faithful stand-in for the machine: real Regs / AddressSpace / Io, with
// step/call/ret/push16 modelled exactly like the DK machine. `call` RECORDS its
// target and returns (the callees 0x4894 / 0x48c4 have no thepit translation yet,
// and the tested paths reload A from memory right after each call, so the stub's
// lack of side effects never reaches a branch).
class MockMachine {
  constructor() {
    this.regs = new Regs();
    this.io = new Io();
    this.mem = new AddressSpace(new Uint8Array(0x5000), this.io);
    this.regs.sp = 0x8780; // stack inside work RAM so push16 lands in mapped RAM
    this.cycles = 0;
    this.pc = 0x03e8;
    this.calls = [];
    this.returned = false;
  }
  step(nextAddr, cycles) {
    this.pc = nextAddr;
    this.cycles += cycles;
  }
  call(addr) {
    this.calls.push(addr);
    return undefined;
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

// ---- PATH A: full classification, no calls, exits at loc_0669 (bitmask 0x04) --
// (0x8010)!=0 -> call z,0x4894 NOT taken.
// (0x800b)=5 -> dec -> 4 (NZ) -> jr nz TAKEN straight to loc_0409 (timer running).
// (0x8079)!=0 -> not the early return. b=(0x8068)+3=0x30, c=(0x806b)+5=0x37.
// (0x800c)=0 (<7) -> jr c,0x0438. loc_0438: a=0x30 cp b(0x30)==0 -> jr nz NOT taken;
// a=0x37 cp c(0x37) -> no borrow (NC) -> jp nc,0x0669 -> A=0x04 -> (0x801b)=0x04.
function setupA(m) {
  m.mem.write8(0x8010, 0x01); // != 0 -> skip call 0x4894
  m.mem.write8(0x800b, 0x05); // timer still running after dec
  m.mem.write8(0x8079, 0x01); // active -> classify
  m.mem.write8(0x800c, 0x00); // region hint < 7 -> loc_0438
  m.mem.write8(0x8068, 0x2d); // b = 0x2d + 3 = 0x30
  m.mem.write8(0x806b, 0x32); // c = 0x32 + 5 = 0x37
}
function checkA(m) {
  assert.equal(m.cycles, 252, "path A T-state total");
  assert.equal(m.regs.b, 0x30, "b = (0x8068)+3");
  assert.equal(m.regs.c, 0x37, "c = (0x806b)+5");
  assert.equal(m.mem.read8(0x801b), 0x04, "(0x801b) = 0x04 (loc_0669 bitmask)");
  assert.equal(m.mem.read8(0x800b), 0x04, "(0x800b) decremented to 4, not reloaded");
  assert.deepEqual(m.calls, [], "no conditional call fires on path A");
  assert.equal(m.returned, true, "routine returned");
}

test("loc_03e8 path A: timer running, classify -> (0x801b)=0x04", () => {
  const m = new MockMachine();
  setupA(m);
  loc_03e8(m);
  checkA(m);
});

// ---- PATH B: timer EXPIRES, both conditional calls TAKEN, exits at loc_0665 ---
// (0x8010)==0 -> call z,0x4894 TAKEN. (0x800b)=1 -> dec -> 0 (Z) -> jr nz NOT taken
// -> reload (0x800b)=0x1e. (0x807c)==0 -> ret nz NOT taken. (0x807b)==0 ->
// call z,0x48c4 TAKEN. Then classify: b=0x40, c=0x38, hint 0 (<7):
// loc_0438 a=0x30 cp b(0x40) borrow -> jr nz TAKEN -> loc_0446; a=0x38 cp c(0x38)==0
// -> jr nz NOT taken; a=0x57 cp b(0x40) NC -> jp nc,0x0665 -> A=0x02 -> (0x801b)=0x02.
test("loc_03e8 path B: timer expiry reloads 0x1e and fires both calls -> (0x801b)=0x02", () => {
  const m = new MockMachine();
  m.mem.write8(0x8010, 0x00); // == 0 -> call 0x4894 taken
  m.mem.write8(0x800b, 0x01); // dec -> 0 -> timer expired
  m.mem.write8(0x807c, 0x00); // == 0 -> ret nz NOT taken
  m.mem.write8(0x807b, 0x00); // == 0 -> call 0x48c4 taken
  m.mem.write8(0x8079, 0x01); // active
  m.mem.write8(0x800c, 0x00); // hint < 7
  m.mem.write8(0x8068, 0x3d); // b = 0x40
  m.mem.write8(0x806b, 0x33); // c = 0x38
  loc_03e8(m);

  assert.equal(m.cycles, 353, "path B T-state total (both calls taken)");
  assert.deepEqual(m.calls, [0x4894, 0x48c4], "both conditional calls fired, in order");
  assert.equal(m.mem.read8(0x800b), 0x1e, "timer reloaded to 0x1e on expiry");
  assert.equal(m.regs.b, 0x40, "b = (0x8068)+3");
  assert.equal(m.regs.c, 0x38, "c = (0x806b)+5");
  assert.equal(m.mem.read8(0x801b), 0x02, "(0x801b) = 0x02 (loc_0665 bitmask)");
  assert.equal(m.returned, true, "routine returned");
});

// ---- PATH C: early return via `ret z` at loc_0409 (0x8079 == 0) --------------
test("loc_03e8 path C: inactive (0x8079==0) returns via ret z, leaves (0x801b) alone", () => {
  const m = new MockMachine();
  m.mem.write8(0x8010, 0x01); // skip call 0x4894
  m.mem.write8(0x800b, 0x05); // timer running -> jr nz taken to loc_0409
  m.mem.write8(0x8079, 0x00); // inactive -> ret z
  loc_03e8(m);

  assert.equal(m.cycles, 97, "path C T-state total (ret z taken)");
  assert.deepEqual(m.calls, [], "no call on the inactive path");
  assert.equal(m.mem.read8(0x801b), 0x00, "(0x801b) untouched -- no classification ran");
  assert.equal(m.mem.read8(0x800b), 0x04, "timer decremented to 4, not reloaded");
  assert.equal(m.returned, true, "routine returned via ret z");
});

// ---- PATH D: early return via `ret nz` at 0x0401 (timer expired, 0x807c!=0) --
test("loc_03e8 path D: timer expiry with (0x807c)!=0 reloads 0x1e then ret nz", () => {
  const m = new MockMachine();
  m.mem.write8(0x8010, 0x01); // skip call 0x4894
  m.mem.write8(0x800b, 0x01); // dec -> 0 -> expired -> reload path
  m.mem.write8(0x807c, 0x09); // != 0 -> ret nz taken (before touching 0x807b)
  loc_03e8(m);

  assert.equal(m.cycles, 112, "path D T-state total (ret nz taken)");
  assert.deepEqual(m.calls, [], "0x48c4 not reached -- ret nz fires first");
  assert.equal(m.mem.read8(0x800b), 0x1e, "timer reloaded to 0x1e before the ret nz");
  assert.equal(m.mem.read8(0x801b), 0x00, "(0x801b) untouched");
  assert.equal(m.returned, true, "routine returned via ret nz");
});

// ---- MUTATION --------------------------------------------------------------
// A faithful straight-line trace of exactly the instructions PATH A executes
// (entry with the call skipped and jr nz taken -> loc_0409 -> loc_0438 ->
// loc_0669 -> loc_066f), with ONE deliberate break: loc_0669's `ld a,0x04`
// becomes `ld a,0x08`, i.e. the wrong wall-direction bitmask. Control flow and
// cycle count are IDENTICAL to the real path A (only a constant changed), so this
// proves the MEMORY invariant -- (0x801b)==0x04 -- has teeth, not merely the
// cycle total.
function loc_03e8_pathA_MUTANT(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x8010); m.step(0x03eb, 13);
  regs.and(regs.a); m.step(0x03ec, 4);
  m.step(0x03ef, 10); // call z,0x4894 not taken
  regs.a = mem.read8(0x800b); m.step(0x03f2, 13);
  regs.a = regs.dec8(regs.a); m.step(0x03f3, 4);
  mem.write8(0x800b, regs.a); m.step(0x03f6, 13);
  m.step(0x0409, 12); // jr nz taken
  regs.a = mem.read8(0x8079); m.step(0x040c, 13);
  regs.and(regs.a); m.step(0x040d, 4);
  m.step(0x040e, 5); // ret z not taken
  regs.a = mem.read8(0x8068); m.step(0x0411, 13);
  regs.add(0x03); m.step(0x0413, 7);
  regs.b = regs.a; m.step(0x0414, 4);
  regs.a = mem.read8(0x806b); m.step(0x0417, 13);
  regs.add(0x05); m.step(0x0419, 7);
  regs.c = regs.a; m.step(0x041a, 4);
  regs.a = mem.read8(0x800c); m.step(0x041d, 13);
  regs.cp(0x07); m.step(0x041f, 7);
  m.step(0x0438, 12); // jr c taken
  regs.a = 0x30; m.step(0x043a, 7);
  regs.cp(regs.b); m.step(0x043b, 4);
  m.step(0x043d, 7); // jr nz not taken
  regs.a = 0x37; m.step(0x043f, 7);
  regs.cp(regs.c); m.step(0x0440, 4);
  m.step(0x0669, 10); // jp nc taken
  regs.a = 0x08; m.step(0x066b, 7); // <-- MUTATION: 0x08 instead of 0x04
  m.step(0x066f, 12); // jr 0x066f
  mem.write8(0x801b, regs.a); m.step(0x0672, 13);
  m.ret();
}

test("MUTATION caught: loc_0669 bitmask 0x08 instead of 0x04 fails the (0x801b) invariant", () => {
  const good = new MockMachine();
  setupA(good);
  loc_03e8(good);
  checkA(good); // sanity: the real routine passes the invariant

  const bad = new MockMachine();
  setupA(bad);
  loc_03e8_pathA_MUTANT(bad);
  assert.equal(bad.cycles, 252, "mutant keeps path A's exact cycle count");
  assert.equal(bad.mem.read8(0x801b), 0x08, "mutant writes the wrong bitmask 0x08");
  assert.throws(() => checkA(bad), "the invariant checker must reject the mutant");
});
