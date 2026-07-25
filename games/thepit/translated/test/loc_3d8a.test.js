// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_3d8a (ROM 0x3d8a-0x3dad), The Pit.
//
// Runs the routine on a lightweight machine built from the REAL thepit address
// space (boards/thepit/memory.js) + Io + the shared Z80 Regs, over a zeroed fake
// ROM (the copyrighted image is never committed — the routine touches only work
// RAM 0x8055/0x8057/0x8058/0x8059 and register IX). Every callee — the two mid
// calls 0x3dae/0x3dc9, the copy 0x3dea, and the tail-jump 0x3e01 — is stubbed as
// a bare "pop-and-return" that balances the stack and adds no cycles, so the
// asserted T-state total is loc_3d8a's OWN instruction cost:
//   7+13+7+13 + 17+17 + 7+13+7+13 + 14 + 17 + 10 = 155 T.
//
// The load-bearing decision is the terminal `jp 0x3e01`: it is a TAIL-JUMP (a JP
// pushes nothing), so loc_3e01's own `ret` returns to loc_3d8a's caller, and the
// stack must stay balanced with a SINGLE ret. The main spec asserts pc lands on
// OUR caller and sp is restored; MUTATION 3 flips the model to the wrong
// `m.call(); m.ret()` shape and shows the double-pop corrupts both.
//
// loc_3d8a's own instructions touch NO flag (straight-line stores/calls/jump), so
// a sentinel F is seeded and asserted UNCHANGED.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_3d8a } from "../loc_3d8a.js";

const SENTINEL = 0xbeef; // caller's return address; the tail-jump's ret must land here
const SP0 = 0x8780; // initial SP (inside work RAM so pushes are mapped)
const F_SENTINEL = 0xa5; // seeded into F; the routine sets no flags, so it must survive

// -- expected results of the correct run ------------------------------------
const EXP_CYCLES = 7 + 13 + 7 + 13 + 17 + 17 + 7 + 13 + 7 + 13 + 14 + 17 + 10; // 155
const EXP_MEM = {
  0x8058: 0x06, // column byte
  0x8059: 0x0c, // row byte
  0x8057: 0x06, // fill/tile byte
  0x8055: 0x09, // row count
};
const EXP_IX = 0x49a5; // descending source pointer
const EXP_A = 0x09; // last `ld a,0x09`; stubbed callees leave A alone
const EXP_CALLS = [0x3dae, 0x3dc9, 0x3dea, 0x3e01]; // order matters

// -- minimal machine: real mem/io/regs + the step/call seam -----------------
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x3d8a;
    this.calls = [];
    this.regs.sp = SP0;
    this.regs.f = F_SENTINEL;
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
  // Stubbed callee: record it, then behave as a bare `ret` (pop whatever the
  // preceding push/JP left on the stack). For a mid `call` that is the return
  // address just pushed; for the tail JP it is OUR caller's return. No cycle
  // charge -- a callee's cost is not loc_3d8a's.
  call(addr) {
    this.calls.push(addr);
    this.pc = this.pop16();
    return undefined;
  }
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }
}

function run(fn) {
  const rom = new Uint8Array(0x5000); // AddressSpace requires exactly 20480 bytes
  const m = new TestMachine(rom);
  m.push16(SENTINEL); // caller's return address (consumed by the tail-jump's ret)
  fn(m);
  return {
    cycles: m.cycles,
    mem: { ...Object.fromEntries(Object.keys(EXP_MEM).map((a) => [a, m.mem.read8(Number(a))])) },
    ix: m.regs.ix,
    a: m.regs.a,
    f: m.regs.f,
    pc: m.pc,
    sp: m.regs.sp,
    calls: m.calls,
  };
}

// Full spec, factored so each mutant runs through the identical checks.
function checkSpec(res) {
  assert.equal(res.cycles, EXP_CYCLES, "T-state total (155, loc_3d8a's own instructions)");
  assert.deepEqual(res.mem, EXP_MEM, "seeds 0x8058=6, 0x8059=0x0c, 0x8057=6, 0x8055=9");
  assert.equal(res.ix, EXP_IX, "IX = 0x49a5 (source pointer)");
  assert.equal(res.a, EXP_A, "A = 0x09 (last immediate load)");
  assert.equal(res.f, F_SENTINEL, "flags untouched (no arithmetic in this routine)");
  assert.equal(res.pc, SENTINEL, "tail-jump callee ret lands on OUR caller");
  assert.equal(res.sp, SP0, "stack balanced -- exactly one net ret (jp pushed nothing)");
  assert.deepEqual(res.calls, EXP_CALLS, "calls 0x3dae,0x3dc9,0x3dea then tail-jumps 0x3e01");
}

test("loc_3d8a: seed state + call chain + tail-jump 0x3e01; 155 T", () => {
  checkSpec(run(loc_3d8a));
});

// -- MUTATION 1 (SEMANTIC): `ld a,0x08` instead of `ld a,0x09` for the row count.
// Same cycle total, but 0x8055 ends 0x08 not 0x09 (and A differs). Only the
// memory/register asserts expose it — a cycle-only diff would miss it.
function loc_3d8a_countMutant(m) {
  const { regs, mem } = m;
  regs.a = 0x06;
  m.step(0x3d8c, 7);
  mem.write8(0x8058, regs.a);
  m.step(0x3d8f, 13);
  regs.a = 0x0c;
  m.step(0x3d91, 7);
  mem.write8(0x8059, regs.a);
  m.step(0x3d94, 13);
  m.push16(0x3d97);
  m.step(0x3dae, 17);
  m.call(0x3dae);
  m.push16(0x3d9a);
  m.step(0x3dc9, 17);
  m.call(0x3dc9);
  regs.a = 0x06;
  m.step(0x3d9c, 7);
  mem.write8(0x8057, regs.a);
  m.step(0x3d9f, 13);
  regs.a = 0x08; // BUG: row count should be 0x09
  m.step(0x3da1, 7);
  mem.write8(0x8055, regs.a);
  m.step(0x3da4, 13);
  regs.ix = 0x49a5;
  m.step(0x3da8, 14);
  m.push16(0x3dab);
  m.step(0x3dea, 17);
  m.call(0x3dea);
  m.step(0x3e01, 10);
  return m.call(0x3e01);
}

test("mutation (row count 0x08 not 0x09) is caught by the memory/register asserts", () => {
  const bad = run(loc_3d8a_countMutant);
  assert.equal(bad.cycles, EXP_CYCLES, "cycles UNCHANGED -- a cycle-only diff misses this");
  assert.equal(bad.mem[0x8055], 0x08, "mutant leaves 0x08 in the row-count byte");
  assert.throws(() => checkSpec(bad), "the spec the real routine passes rejects the mutant");
});

// -- MUTATION 2 (CYCLE): charge `ld ix,0x49a5` 10 T instead of 14. Moves no
// memory and leaves every register identical — only the T-state total (4 T
// short) exposes it (docs/03: a timing error is invisible to the state diff).
function loc_3d8a_cycleMutant(m) {
  const { regs, mem } = m;
  regs.a = 0x06;
  m.step(0x3d8c, 7);
  mem.write8(0x8058, regs.a);
  m.step(0x3d8f, 13);
  regs.a = 0x0c;
  m.step(0x3d91, 7);
  mem.write8(0x8059, regs.a);
  m.step(0x3d94, 13);
  m.push16(0x3d97);
  m.step(0x3dae, 17);
  m.call(0x3dae);
  m.push16(0x3d9a);
  m.step(0x3dc9, 17);
  m.call(0x3dc9);
  regs.a = 0x06;
  m.step(0x3d9c, 7);
  mem.write8(0x8057, regs.a);
  m.step(0x3d9f, 13);
  regs.a = 0x09;
  m.step(0x3da1, 7);
  mem.write8(0x8055, regs.a);
  m.step(0x3da4, 13);
  regs.ix = 0x49a5;
  m.step(0x3da8, 10); // BUG: ld ix,nn is 14 T, not 10
  m.push16(0x3dab);
  m.step(0x3dea, 17);
  m.call(0x3dea);
  m.step(0x3e01, 10);
  return m.call(0x3e01);
}

test("mutation (ld ix,nn mischarged 10 T) is caught by the cycle assertion", () => {
  const bad = run(loc_3d8a_cycleMutant);
  assert.deepEqual(bad.mem, EXP_MEM, "memory identical -- a state-only diff would miss this");
  assert.equal(bad.ix, EXP_IX, "register identical too");
  assert.equal(bad.cycles, EXP_CYCLES - 4, "mutant is exactly 4 T short");
  assert.throws(() => checkSpec(bad), "the spec the real routine passes rejects the mutant");
});

// -- MUTATION 3 (CONTROL-FLOW): model the terminal `jp 0x3e01` with the WRONG
// `m.call(); m.ret()` shape. The tail-jump pushed nothing, so loc_3e01's ret
// already returned to our caller; the extra m.ret() pops a SECOND word — pc lands
// on the garbage above the sentinel and sp is left two bytes high. This is the
// exact double-pop trap the loc_3d8a / loc_3d7e headers warn against, and only
// the pc/sp (control-flow) asserts pin it down.
function loc_3d8a_doubleRetMutant(m) {
  const { regs, mem } = m;
  regs.a = 0x06;
  m.step(0x3d8c, 7);
  mem.write8(0x8058, regs.a);
  m.step(0x3d8f, 13);
  regs.a = 0x0c;
  m.step(0x3d91, 7);
  mem.write8(0x8059, regs.a);
  m.step(0x3d94, 13);
  m.push16(0x3d97);
  m.step(0x3dae, 17);
  m.call(0x3dae);
  m.push16(0x3d9a);
  m.step(0x3dc9, 17);
  m.call(0x3dc9);
  regs.a = 0x06;
  m.step(0x3d9c, 7);
  mem.write8(0x8057, regs.a);
  m.step(0x3d9f, 13);
  regs.a = 0x09;
  m.step(0x3da1, 7);
  mem.write8(0x8055, regs.a);
  m.step(0x3da4, 13);
  regs.ix = 0x49a5;
  m.step(0x3da8, 14);
  m.push16(0x3dab);
  m.step(0x3dea, 17);
  m.call(0x3dea);
  m.step(0x3e01, 10);
  m.call(0x3e01);
  m.ret(); // BUG: the `m.call(); m.ret()` shape -- a spurious second pop
}

test("mutation (tail-jump written as m.call+m.ret, a double-pop) is caught by pc/sp", () => {
  const bad = run(loc_3d8a_doubleRetMutant);
  assert.notEqual(bad.pc, SENTINEL, "pc no longer lands on our caller (popped a second word)");
  assert.notEqual(bad.sp, SP0, "stack left unbalanced by the spurious ret");
  assert.throws(() => checkSpec(bad), "the spec the real routine passes rejects the mutant");
});
