// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for sub_3a6f (ROM 0x3A6F-0x3B80): the HUD / status-row builder.
// Asserts the exact T-state total and the routine's key register/flag/memory/
// control-flow effects against the disassembly on BOTH `and a`/`jr z` arms
// (and the mid `dec a`/`jr nz` poke arm), plus a deliberate mutation the
// invariant checker must catch. 0x3E13/0x4BFF/0x3DAE/... have no thepit
// translation yet, so calls are stubbed and only RECORDED.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { sub_3a6f } from "../sub_3a6f.js";

// Minimal faithful stand-in for the machine: real Regs/AddressSpace/Io, and
// step/call/ret/push16 modelled exactly like the DK machine. `call` records the
// target (stubbed callee) so the routine is tested in isolation.
class MockMachine {
  constructor() {
    this.regs = new Regs();
    this.io = new Io();
    this.mem = new AddressSpace(new Uint8Array(0x5000), this.io);
    this.regs.sp = 0x8780; // stack inside work RAM so push16 lands in mapped RAM
    this.cycles = 0;
    this.pc = 0x3a6f;
    this.calls = [];
    this.returned = false;
  }
  step(nextAddr, cycles) {
    this.pc = nextAddr;
    this.cycles += cycles;
  }
  call(addr) {
    this.calls.push(addr);
    return undefined; // stubbed callee -- assert only that the call happened
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

// Addresses the routine writes; pre-seeded with 0xFF so zero/skip cases are
// OBSERVED writes (0x918e stays 0xFF on the arm where the poke is skipped).
const TOUCHED = [0x928c, 0x928e, 0x9292, 0x9294, 0x918e, 0x8055, 0x8058, 0x8059, 0x800a];

// The 25 pre-loop call targets, in execution order (identical on both arms --
// the branches themselves make no calls), then the 0x1E-count delay loop which
// calls 0x3E13 + 0x4BFF once per pass, 30 passes = 60 calls. Total 85.
const PRELOOP_CALLS = [
  0x4b44, 0x46f4, 0x472c, 0x3e1d, 0x3d49, 0x3d8a, 0x492a, 0x4785, 0x47a1,
  0x3dae, 0x3dc9, 0x3dea, 0x3e1d, 0x3dae, 0x3dc9, 0x3dea, 0x3e1d, 0x3dae,
  0x3dc9, 0x3dea, 0x3e1d, 0x3dae, 0x3dc9, 0x3dea, 0x3e1d,
];
const EXPECT_CALLS = [...PRELOOP_CALLS];
for (let i = 0; i < 30; i++) EXPECT_CALLS.push(0x3e13, 0x4bff);

function seed(m, c, d) {
  for (const a of TOUCHED) m.mem.write8(a, 0xff);
  m.mem.write8(0x804c, c);
  m.mem.write8(0x804d, d);
}

// ---- PATH A: (0x804c)=0x01, (0x804d)=0x00 ----------------------------------
// (0x804c)=1 -> `and a` non-zero -> jr z NOT taken -> tile 0x07 for 0x928e's row
//            -> `dec a` == 0     -> jr nz NOT taken -> POKE 0x918e = 0x24
// (0x804d)=0 -> `and a` zero      -> jr z TAKEN    -> tile 0x09 for the last row
function checkPathA(m) {
  assert.equal(m.cycles, 3796, "T-state total (jr z NT / poke / jr z T, 30-pass loop)");
  assert.equal(m.returned, true, "routine returns via ret at 0x3b80");
  assert.equal(m.pc, 0x3b80, "final step lands on the ret opcode");
  assert.equal(m.regs.a, 0x00, "A = last loop dec result (0x800a hit 0)");
  assert.equal(m.regs.f, 0x42, "flags from final `dec a`: Z|N (C cleared by earlier `and a`)");
  assert.deepEqual(m.calls, EXPECT_CALLS, "call chain: 25 setup calls + 30x(0x3e13,0x4bff)");
  assert.equal(m.mem.read8(0x928c), 0x01, "(ix)=0x928c seeded 0x01");
  assert.equal(m.mem.read8(0x928e), 0x01, "(ix)=0x928e = (0x804c) = 0x01");
  assert.equal(m.mem.read8(0x9292), 0x02, "(ix)=0x9292 seeded 0x02");
  assert.equal(m.mem.read8(0x9294), 0x00, "(ix)=0x9294 = (0x804d) = 0x00");
  assert.equal(m.mem.read8(0x918e), 0x24, "0x918e poked to 0x24 (dec (0x804c) == 0)");
  assert.equal(m.mem.read8(0x8055), 0x09, "0x8055 = last tile 0x09 (jr z taken arm)");
  assert.equal(m.mem.read8(0x8058), 0x14, "0x8058 = last position byte 0x14");
  assert.equal(m.mem.read8(0x8059), 0x0c, "0x8059 = last position byte 0x0c");
  assert.equal(m.mem.read8(0x800a), 0x00, "0x800a delay counter ticked to 0");
}

test("sub_3a6f path A: jr-z-not-taken + 0x918e poke + jr-z-taken", () => {
  const m = new MockMachine();
  seed(m, 0x01, 0x00);
  sub_3a6f(m);
  checkPathA(m);
});

// ---- PATH B: (0x804c)=0x00, (0x804d)=0x05 ----------------------------------
// Exercises the OPPOSITE arms: 0x928e row jr z TAKEN (tile 0x09), the mid poke
// SKIPPED (jr nz taken, 0x918e untouched), and the last row jr z NOT taken
// (tile 0x07). Fewer instructions on those arms -> 3768 T.
test("sub_3a6f path B: jr-z-taken + poke skipped + jr-z-not-taken", () => {
  const m = new MockMachine();
  seed(m, 0x00, 0x05);
  sub_3a6f(m);

  assert.equal(m.cycles, 3768, "T-state total (jr z T / no poke / jr z NT)");
  assert.equal(m.returned, true, "routine returns via ret");
  assert.equal(m.regs.a, 0x00, "A = 0 after the delay loop");
  assert.deepEqual(m.calls, EXPECT_CALLS, "same call chain regardless of branch arm");
  assert.equal(m.mem.read8(0x928e), 0x00, "(ix)=0x928e = (0x804c) = 0x00");
  assert.equal(m.mem.read8(0x9294), 0x05, "(ix)=0x9294 = (0x804d) = 0x05");
  assert.equal(m.mem.read8(0x918e), 0xff, "0x918e UNTOUCHED (dec (0x804c) != 0 -> jr nz taken)");
  assert.equal(m.mem.read8(0x8055), 0x07, "0x8055 = last tile 0x07 (jr z not-taken arm)");
  assert.equal(m.mem.read8(0x800a), 0x00, "0x800a delay counter ticked to 0");
});

// ---- MUTATION --------------------------------------------------------------
// Faithful copy of the translation with ONE deliberate break: `ld (ix+0x00),0x02`
// at 0x3b06 stores 0x03 instead of 0x02, so 0x9292 is one off. The T-state total,
// step sequence and call chain are all UNCHANGED, so it is precisely the memory
// assertion (0x9292) in checkPathA that must reject it -- proving the invariant
// has teeth on the routine's distinctive (ix+d) writes.
function sub_3a6f_MUTANT(m) {
  const { regs, mem } = m;
  m.push16(0x3a72); m.step(0x4b44, 17); m.call(0x4b44);
  m.push16(0x3a75); m.step(0x46f4, 17); m.call(0x46f4);
  m.push16(0x3a78); m.step(0x472c, 17); m.call(0x472c);
  regs.a = 0x01; m.step(0x3a7a, 7);
  regs.c = 0x02; m.step(0x3a7c, 7);
  m.push16(0x3a7f); m.step(0x3e1d, 17); m.call(0x3e1d);
  m.push16(0x3a82); m.step(0x3d49, 17); m.call(0x3d49);
  m.push16(0x3a85); m.step(0x3d8a, 17); m.call(0x3d8a);
  m.push16(0x3a88); m.step(0x492a, 17); m.call(0x492a);
  m.push16(0x3a8b); m.step(0x4785, 17); m.call(0x4785);
  m.push16(0x3a8e); m.step(0x47a1, 17); m.call(0x47a1);
  regs.ix = 0x928c; m.step(0x3a92, 14);
  mem.write8((regs.ix + 0x00) & 0xffff, 0x01); m.step(0x3a96, 19);
  regs.a = 0x0c; m.step(0x3a98, 7);
  mem.write8(0x8058, regs.a); m.step(0x3a9b, 13);
  regs.a = 0x0d; m.step(0x3a9d, 7);
  mem.write8(0x8059, regs.a); m.step(0x3aa0, 13);
  m.push16(0x3aa3); m.step(0x3dae, 17); m.call(0x3dae);
  m.push16(0x3aa6); m.step(0x3dc9, 17); m.call(0x3dc9);
  regs.a = 0x06; m.step(0x3aa8, 7);
  mem.write8(0x8055, regs.a); m.step(0x3aab, 13);
  regs.ix = 0x49b0; m.step(0x3aaf, 14);
  m.push16(0x3ab2); m.step(0x3dea, 17); m.call(0x3dea);
  regs.a = 0x0c; m.step(0x3ab4, 7);
  regs.c = 0x07; m.step(0x3ab6, 7);
  m.push16(0x3ab9); m.step(0x3e1d, 17); m.call(0x3e1d);
  regs.ix = 0x928e; m.step(0x3abd, 14);
  regs.a = mem.read8(0x804c); m.step(0x3ac0, 13);
  mem.write8((regs.ix + 0x00) & 0xffff, regs.a); m.step(0x3ac3, 19);
  regs.a = 0x0e; m.step(0x3ac5, 7);
  mem.write8(0x8058, regs.a); m.step(0x3ac8, 13);
  regs.a = 0x0c; m.step(0x3aca, 7);
  mem.write8(0x8059, regs.a); m.step(0x3acd, 13);
  m.push16(0x3ad0); m.step(0x3dae, 17); m.call(0x3dae);
  m.push16(0x3ad3); m.step(0x3dc9, 17); m.call(0x3dc9);
  regs.a = mem.read8(0x804c); m.step(0x3ad6, 13);
  regs.and(regs.a); m.step(0x3ad7, 4);
  if (regs.fZ) {
    m.step(0x3ae1, 12);
    regs.ix = 0x49ae; m.step(0x3ae5, 14);
    regs.a = 0x09; m.step(0x3ae7, 7);
  } else {
    m.step(0x3ad9, 7);
    regs.ix = 0x496c; m.step(0x3add, 14);
    regs.a = 0x07; m.step(0x3adf, 7);
    m.step(0x3ae7, 12);
  }
  mem.write8(0x8055, regs.a); m.step(0x3aea, 13);
  m.push16(0x3aed); m.step(0x3dea, 17); m.call(0x3dea);
  regs.a = mem.read8(0x804c); m.step(0x3af0, 13);
  regs.a = regs.dec8(regs.a); m.step(0x3af1, 4);
  if (regs.fNZ) {
    m.step(0x3afb, 12);
  } else {
    m.step(0x3af3, 7);
    regs.ix = 0x918e; m.step(0x3af7, 14);
    mem.write8((regs.ix + 0x00) & 0xffff, 0x24); m.step(0x3afb, 19);
  }
  regs.a = 0x0e; m.step(0x3afd, 7);
  regs.c = 0x07; m.step(0x3aff, 7);
  m.push16(0x3b02); m.step(0x3e1d, 17); m.call(0x3e1d);
  regs.ix = 0x9292; m.step(0x3b06, 14);
  mem.write8((regs.ix + 0x00) & 0xffff, 0x03); m.step(0x3b0a, 19); // BUG: should be 0x02
  regs.a = 0x12; m.step(0x3b0c, 7);
  mem.write8(0x8058, regs.a); m.step(0x3b0f, 13);
  regs.a = 0x0c; m.step(0x3b11, 7);
  mem.write8(0x8059, regs.a); m.step(0x3b14, 13);
  m.push16(0x3b17); m.step(0x3dae, 17); m.call(0x3dae);
  m.push16(0x3b1a); m.step(0x3dc9, 17); m.call(0x3dc9);
  regs.a = 0x07; m.step(0x3b1c, 7);
  mem.write8(0x8055, regs.a); m.step(0x3b1f, 13);
  regs.ix = 0x49b1; m.step(0x3b23, 14);
  m.push16(0x3b26); m.step(0x3dea, 17); m.call(0x3dea);
  regs.a = 0x12; m.step(0x3b28, 7);
  regs.c = 0x03; m.step(0x3b2a, 7);
  m.push16(0x3b2d); m.step(0x3e1d, 17); m.call(0x3e1d);
  regs.ix = 0x9294; m.step(0x3b31, 14);
  regs.a = mem.read8(0x804d); m.step(0x3b34, 13);
  mem.write8((regs.ix + 0x00) & 0xffff, regs.a); m.step(0x3b37, 19);
  regs.a = 0x14; m.step(0x3b39, 7);
  mem.write8(0x8058, regs.a); m.step(0x3b3c, 13);
  regs.a = 0x0c; m.step(0x3b3e, 7);
  mem.write8(0x8059, regs.a); m.step(0x3b41, 13);
  m.push16(0x3b44); m.step(0x3dae, 17); m.call(0x3dae);
  m.push16(0x3b47); m.step(0x3dc9, 17); m.call(0x3dc9);
  regs.a = mem.read8(0x804d); m.step(0x3b4a, 13);
  regs.and(regs.a); m.step(0x3b4b, 4);
  if (regs.fZ) {
    m.step(0x3b55, 12);
    regs.ix = 0x49ae; m.step(0x3b59, 14);
    regs.a = 0x09; m.step(0x3b5b, 7);
  } else {
    m.step(0x3b4d, 7);
    regs.ix = 0x496c; m.step(0x3b51, 14);
    regs.a = 0x07; m.step(0x3b53, 7);
    m.step(0x3b5b, 12);
  }
  mem.write8(0x8055, regs.a); m.step(0x3b5e, 13);
  m.push16(0x3b61); m.step(0x3dea, 17); m.call(0x3dea);
  regs.a = 0x14; m.step(0x3b63, 7);
  regs.c = 0x03; m.step(0x3b65, 7);
  m.push16(0x3b68); m.step(0x3e1d, 17); m.call(0x3e1d);
  regs.a = 0x1e; m.step(0x3b6a, 7);
  mem.write8(0x800a, regs.a); m.step(0x3b6d, 13);
  for (;;) {
    regs.a = 0x06; m.step(0x3b6f, 7);
    m.push16(0x3b72); m.step(0x3e13, 17); m.call(0x3e13);
    regs.a = 0x0f; m.step(0x3b74, 7);
    m.push16(0x3b77); m.step(0x4bff, 17); m.call(0x4bff);
    regs.a = mem.read8(0x800a); m.step(0x3b7a, 13);
    regs.a = regs.dec8(regs.a); m.step(0x3b7b, 4);
    mem.write8(0x800a, regs.a); m.step(0x3b7e, 13);
    if (regs.fNZ) { m.step(0x3b6d, 12); continue; }
    m.step(0x3b80, 7);
    break;
  }
  m.ret();
}

test("MUTATION caught: 0x9292 seeded 0x03 instead of 0x02", () => {
  const good = new MockMachine();
  seed(good, 0x01, 0x00);
  sub_3a6f(good);
  checkPathA(good); // sanity: the real routine passes checkPathA

  const bad = new MockMachine();
  seed(bad, 0x01, 0x00);
  sub_3a6f_MUTANT(bad);
  // Cycles/steps/calls untouched -> it is precisely the 0x9292 byte that differs.
  assert.equal(bad.cycles, 3796, "mutant keeps the same cycle total");
  assert.deepEqual(bad.calls, EXPECT_CALLS, "mutant keeps the same call chain");
  assert.equal(bad.mem.read8(0x9292), 0x03, "mutant stored the wrong value at 0x9292");
  assert.throws(() => checkPathA(bad), /0x9292/, "the invariant checker must reject the mutant");
});
