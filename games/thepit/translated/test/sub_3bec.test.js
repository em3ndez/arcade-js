// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated sub_3bec (ROM 0x3bec-0x3cc0), The Pit.
//
// Runs the routine on a lightweight machine built from the REAL thepit address
// space (boards/thepit/memory.js) + Io + the shared Z80 Regs, over a stub ROM
// (the copyrighted image is never committed). Every callee (0x3cc1, 0x3dae,
// 0x3dc9, 0x3dea, 0x3e1d, 0x4c6f, 0x4689, 0x3e13, 0x4bff) is stubbed as a bare
// "pop-and-return": it balances the stack and adds NO cycles and touches NO
// registers, so the asserted T-state total and register values are sub_3bec's
// OWN cost/effect. Each stub records {addr, a, c, ix} at entry, which is how the
// two IX-selection branches are observed (the chosen `ld ix` feeds the very next
// call, whose entry snapshot the trace captures before any later `ld ix` clobbers
// IX).
//
// Scenario: (0x8081)=0x04 and (0x8082)=0x03, so the count 0x800a = 5+5+5 = 0x0F.
// Both `cp 0x0f` branches take, selecting IX = 0x4a2e (row 1) and 0x4a55 (row 2);
// the loop then runs 0x0F = 15 iterations down to 0.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { sub_3bec } from "../sub_3bec.js";

const SENTINEL = 0xbeef; // the caller's return address; the final `ret` lands here
const SP0 = 0x8780; // initial SP (inside work RAM so pushes are mapped)
const COUNT = 0x0f; // (0x800a) after both +5 -> also the loop iteration count

// -- T-state accounting (own instruction cost; stubbed callees add 0) ---------
// Segment A (3bec-3bff): both jr-nz NOT taken (0x8081==0x04), +5 runs.
const A = 7 + 13 + 13 + 7 + 7 /*jr nz not taken*/ + 13 + 7 + 13; // 80
// Segment B (3c00-3c0e): jr-nz NOT taken (0x8082==0x03), +5 runs.
const B = 13 + 7 + 7 /*jr nz not taken*/ + 13 + 7 + 13; // 60
// Segment C (3c0f-3c3e): call+setup, then `cp 0x0f` jr-z TAKEN -> ld ix,0x4a2e.
const C = 17 + 7 + 13 + 7 + 13 + 17 + 17 + 7 + 13 + 13 + 7 + 12 /*jr z taken*/ + 14; // 157
// Segment D (3c42-3c73): call+setup, then `cp 0x0f` jp-z TAKEN -> ld ix,0x4a55.
const D = 17 + 7 + 13 + 7 + 13 + 17 + 17 + 7 + 13 + 13 + 7 + 10 /*jp z taken*/ + 14; // 155
// Segment E (3c77-3ca3): loc_3c77 through the last pre-loop call (0x3e1d).
const E = 17 + 7 + 7 + 17 + 7 + 13 + 7 + 13 + 17 + 17 + 7 + 13 + 14 + 17 + 7 + 7 + 17; // 204
// Segment F: the loop body (3ca4-3cbd) runs COUNT times; back-edge jr taken COUNT-1
// times (12 T), not taken once (7 T); then the final ret (10 T).
const BODY = 17 + 10 + 17 + 7 + 17 + 7 + 17 + 13 + 4 + 13; // 122
const F = COUNT * BODY + (COUNT - 1) * 12 + 7 + 10; // 2015
const EXP_CYCLES = A + B + C + D + E + F; // 2671

// -- minimal machine: real mem/io/regs + step/call/push/pop/ret seam ----------
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x3bec;
    this.calls = [];
    this.regs.sp = SP0;
  }
  step(nextAddr, t) {
    this.pc = nextAddr;
    this.cycles += t;
  }
  push16(v) {
    this.regs.sp = (this.regs.sp - 2) & 0xffff;
    this.mem.write8(this.regs.sp, v & 0xff);
    this.mem.write8((this.regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
  }
  pop16() {
    const lo = this.mem.read8(this.regs.sp);
    const hi = this.mem.read8((this.regs.sp + 1) & 0xffff);
    this.regs.sp = (this.regs.sp + 2) & 0xffff;
    return lo | (hi << 8);
  }
  // Stubbed callee: snapshot the passed-in registers, then behave as a bare `ret`
  // (pop the address the CALL pushed). No cycle charge, no register mutation --
  // the callee's cost/effect is not ours to model here.
  call(addr) {
    this.calls.push({ addr, a: this.regs.a, c: this.regs.c, ix: this.regs.ix });
    this.pc = this.pop16();
    return undefined;
  }
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }
}

function buildRom() {
  return new Uint8Array(0x5000); // AddressSpace requires exactly 20480 bytes
}

function run(fn, { in8081 = 0x04, in8082 = 0x03 } = {}) {
  const m = new TestMachine(buildRom());
  m.regs.ix = 0xffff; // power-on IX; distinct from every selected pointer
  m.mem.write8(0x8081, in8081);
  m.mem.write8(0x8082, in8082);
  m.push16(SENTINEL); // the caller's return address (consumed by the final ret)
  fn(m);
  return {
    cycles: m.cycles,
    calls: m.calls,
    pc: m.pc,
    sp: m.regs.sp,
    a: m.regs.a,
    ix: m.regs.ix,
    bc: m.regs.bc,
    fZ: m.regs.fZ,
    mem800a: m.mem.read8(0x800a),
    mem8055: m.mem.read8(0x8055),
    mem8058: m.mem.read8(0x8058),
    mem8059: m.mem.read8(0x8059),
  };
}

// The 12 pre-loop calls, in order, with the register snapshot that pins each
// branch's effect. The three 0x3dea draws carry the selected row pointers.
const EXP_PRELOOP = [
  { addr: 0x3cc1, ix: 0xffff },
  { addr: 0x3dae, ix: 0xffff },
  { addr: 0x3dc9, ix: 0xffff },
  { addr: 0x3dea, ix: 0x4a2e }, // row-1 pointer, cp 0x0f taken
  { addr: 0x3dae, ix: 0x4a2e },
  { addr: 0x3dc9, ix: 0x4a2e },
  { addr: 0x3dea, ix: 0x4a55 }, // row-2 pointer, cp 0x0f (jp z) taken
  { addr: 0x3e1d, a: 0x11, c: 0xa3, ix: 0x4a55 },
  { addr: 0x3dae, ix: 0x4a55 },
  { addr: 0x3dc9, ix: 0x4a55 },
  { addr: 0x3dea, ix: 0x4a07 }, // fixed third-row pointer
  { addr: 0x3e1d, a: 0x15, c: 0xa6, ix: 0x4a07 },
];

function checkSpec(res) {
  assert.equal(res.cycles, EXP_CYCLES, "T-state total");

  // -- control flow: the full call trace ------------------------------------
  assert.equal(res.calls.length, EXP_PRELOOP.length + COUNT * 4, "total call count");
  for (let i = 0; i < EXP_PRELOOP.length; i++) {
    const want = EXP_PRELOOP[i];
    assert.equal(res.calls[i].addr, want.addr, `pre-loop call ${i} target`);
    if (want.ix !== undefined) assert.equal(res.calls[i].ix, want.ix, `pre-loop call ${i} IX`);
    if (want.a !== undefined) assert.equal(res.calls[i].a, want.a, `pre-loop call ${i} A`);
    if (want.c !== undefined) assert.equal(res.calls[i].c, want.c, `pre-loop call ${i} C`);
  }
  // The animation loop: COUNT groups of [0x4c6f, 0x4689, 0x3e13, 0x4bff].
  for (let k = 0; k < COUNT; k++) {
    const g = res.calls.slice(EXP_PRELOOP.length + k * 4, EXP_PRELOOP.length + k * 4 + 4);
    assert.deepEqual(g.map((c) => c.addr), [0x4c6f, 0x4689, 0x3e13, 0x4bff], `loop group ${k}`);
  }

  // -- memory: the fields written on the way through ------------------------
  assert.equal(res.mem800a, 0x00, "count decremented to 0");
  assert.equal(res.mem8055, 0x0f, "0x8055 last write = 0x0f");
  assert.equal(res.mem8058, 0x15, "0x8058 last write = 0x15");
  assert.equal(res.mem8059, 0x09, "0x8059 last write = 0x09");

  // -- registers / flags / stack -------------------------------------------
  assert.equal(res.ix, 0x4a07, "IX holds the last-selected pointer");
  assert.equal(res.a, 0x00, "A = 0 after the final dec");
  assert.equal(res.bc, 0x0010, "BC reloaded by the loop's ld bc,0x0010");
  assert.equal(res.fZ, true, "Z set from the terminating dec a");
  assert.equal(res.pc, SENTINEL, "ret lands on OUR caller");
  assert.equal(res.sp, SP0, "stack balanced");
}

test("sub_3bec: count=0x0f, selects 0x4a2e/0x4a55/0x4a07, loops 15x; 2671 T", () => {
  checkSpec(run(sub_3bec));
});

// -- MUTATION: charge the taken loop back-edge `jr nz` 11 T instead of 12. It
// moves NO memory and changes NO register or call -- the state diff and the call
// trace stay byte-identical -- so ONLY the T-state total (COUNT-1 = 14 T short)
// exposes it. Proves the cycle assertion earns its keep (docs/03-translation.md).
function sub_3bec_mutant(m) {
  const { regs, mem } = m;
  regs.a = 0x05; m.step(0x3bee, 7);
  mem.write8(0x800a, regs.a); m.step(0x3bf1, 13);
  regs.a = mem.read8(0x8081); m.step(0x3bf4, 13);
  regs.cp(0x04); m.step(0x3bf6, 7);
  if (regs.fNZ) { m.step(0x3c00, 12); }
  else {
    m.step(0x3bf8, 7);
    regs.a = mem.read8(0x800a); m.step(0x3bfb, 13);
    regs.add(0x05); m.step(0x3bfd, 7);
    mem.write8(0x800a, regs.a); m.step(0x3c00, 13);
  }
  regs.a = mem.read8(0x8082); m.step(0x3c03, 13);
  regs.cp(0x03); m.step(0x3c05, 7);
  if (regs.fNZ) { m.step(0x3c0f, 12); }
  else {
    m.step(0x3c07, 7);
    regs.a = mem.read8(0x800a); m.step(0x3c0a, 13);
    regs.add(0x05); m.step(0x3c0c, 7);
    mem.write8(0x800a, regs.a); m.step(0x3c0f, 13);
  }
  m.push16(0x3c12); m.step(0x3cc1, 17); m.call(0x3cc1);
  regs.a = 0x0f; m.step(0x3c14, 7);
  mem.write8(0x8058, regs.a); m.step(0x3c17, 13);
  regs.a = 0x0b; m.step(0x3c19, 7);
  mem.write8(0x8059, regs.a); m.step(0x3c1c, 13);
  m.push16(0x3c1f); m.step(0x3dae, 17); m.call(0x3dae);
  m.push16(0x3c22); m.step(0x3dc9, 17); m.call(0x3dc9);
  regs.a = 0x0c; m.step(0x3c24, 7);
  mem.write8(0x8055, regs.a); m.step(0x3c27, 13);
  regs.a = mem.read8(0x800a); m.step(0x3c2a, 13);
  regs.cp(0x0f); m.step(0x3c2c, 7);
  if (regs.fZ) { m.step(0x3c3e, 12); regs.ix = 0x4a2e; m.step(0x3c42, 14); }
  else {
    m.step(0x3c2e, 7); regs.cp(0x0a); m.step(0x3c30, 7);
    if (regs.fZ) { m.step(0x3c38, 12); regs.ix = 0x4a21; m.step(0x3c3c, 14); m.step(0x3c42, 12); }
    else { m.step(0x3c32, 7); regs.ix = 0x4a14; m.step(0x3c36, 14); m.step(0x3c42, 12); }
  }
  m.push16(0x3c45); m.step(0x3dea, 17); m.call(0x3dea);
  regs.a = 0x11; m.step(0x3c47, 7);
  mem.write8(0x8058, regs.a); m.step(0x3c4a, 13);
  regs.a = 0x0b; m.step(0x3c4c, 7);
  mem.write8(0x8059, regs.a); m.step(0x3c4f, 13);
  m.push16(0x3c52); m.step(0x3dae, 17); m.call(0x3dae);
  m.push16(0x3c55); m.step(0x3dc9, 17); m.call(0x3dc9);
  regs.a = 0x0c; m.step(0x3c57, 7);
  mem.write8(0x8055, regs.a); m.step(0x3c5a, 13);
  regs.a = mem.read8(0x800a); m.step(0x3c5d, 13);
  regs.cp(0x0f); m.step(0x3c5f, 7);
  if (regs.fZ) { m.step(0x3c73, 10); regs.ix = 0x4a55; m.step(0x3c77, 14); }
  else {
    m.step(0x3c62, 10); regs.cp(0x0a); m.step(0x3c64, 7);
    if (regs.fZ) { m.step(0x3c6d, 10); regs.ix = 0x4a48; m.step(0x3c71, 14); m.step(0x3c77, 12); }
    else { m.step(0x3c67, 10); regs.ix = 0x4a3b; m.step(0x3c6b, 14); m.step(0x3c77, 12); }
  }
  m.push16(0x3c7a); m.step(0x3dea, 17); m.call(0x3dea);
  regs.a = 0x11; m.step(0x3c7c, 7);
  regs.c = 0xa3; m.step(0x3c7e, 7);
  m.push16(0x3c81); m.step(0x3e1d, 17); m.call(0x3e1d);
  regs.a = 0x15; m.step(0x3c83, 7);
  mem.write8(0x8058, regs.a); m.step(0x3c86, 13);
  regs.a = 0x09; m.step(0x3c88, 7);
  mem.write8(0x8059, regs.a); m.step(0x3c8b, 13);
  m.push16(0x3c8e); m.step(0x3dae, 17); m.call(0x3dae);
  m.push16(0x3c91); m.step(0x3dc9, 17); m.call(0x3dc9);
  regs.a = 0x0f; m.step(0x3c93, 7);
  mem.write8(0x8055, regs.a); m.step(0x3c96, 13);
  regs.ix = 0x4a07; m.step(0x3c9a, 14);
  m.push16(0x3c9d); m.step(0x3dea, 17); m.call(0x3dea);
  regs.a = 0x15; m.step(0x3c9f, 7);
  regs.c = 0xa6; m.step(0x3ca1, 7);
  m.push16(0x3ca4); m.step(0x3e1d, 17); m.call(0x3e1d);
  for (;;) {
    m.push16(0x3ca7); m.step(0x4c6f, 17); m.call(0x4c6f);
    regs.bc = 0x0010; m.step(0x3caa, 10);
    m.push16(0x3cad); m.step(0x4689, 17); m.call(0x4689);
    regs.a = 0x0f; m.step(0x3caf, 7);
    m.push16(0x3cb2); m.step(0x3e13, 17); m.call(0x3e13);
    regs.a = 0x0f; m.step(0x3cb4, 7);
    m.push16(0x3cb7); m.step(0x4bff, 17); m.call(0x4bff);
    regs.a = mem.read8(0x800a); m.step(0x3cba, 13);
    regs.a = regs.dec8(regs.a); m.step(0x3cbb, 4);
    mem.write8(0x800a, regs.a); m.step(0x3cbe, 13);
    if (regs.fNZ) { m.step(0x3ca4, 11); } // BUG: taken jr nz is 12 T, not 11
    else { m.step(0x3cc0, 7); break; }
  }
  m.ret();
}

test("mutation (loop jr nz taken mischarged 11 T) is caught by the cycle assertion", () => {
  const bad = run(sub_3bec_mutant);
  // Same memory, same call trace -- a state-only / control-flow-only diff MISSES it.
  assert.equal(bad.mem800a, 0x00, "count still decremented to 0");
  assert.equal(bad.calls.length, EXP_PRELOOP.length + COUNT * 4, "call trace identical");
  // COUNT-1 = 14 taken back-edges, each 1 T short.
  assert.equal(bad.cycles, EXP_CYCLES - (COUNT - 1), "mutant is exactly 14 T short");
  // The spec the real routine passes MUST reject the mutant.
  assert.throws(() => checkSpec(bad));
});
