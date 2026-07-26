// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_4eea (ROM 0x4eea-0x4f25, The Pit): the control-bits action
// dispatcher on 0x8018 for a two-cell object. It exercises every arm of the
// bit0..bit4 cascade end-to-end --
//   * bits all clear  -> `ret z` (idle, do nothing);
//   * bit0 / bit2 set -> conditional TAIL-jump to loc_4f26 (step down);
//   * bit1 / bit3 set -> conditional TAIL-jump to loc_4f38 (step up);
//   * first-match-wins ordering (bit0 set beats bit1);
//   * bit4 set (bits 0..3 clear) -> the full COMMIT body: erase two cells, move the
//     hl/de pointers up one 0x20 row, redraw the object code, decrement 0x804b,
//     clear 0x8010, call loc_4c8f, then TAIL-jump to loc_4bff with A=0x14.
// Each path asserts the exact T-state total, the instruction-boundary step trace,
// the call / tail-jump targets, the pushed return address, the final PC / registers
// and every memory byte written. It then re-runs a FAITHFUL twin whose only break is
// the row-offset immediate `ld bc,0xffe0` corrupted to `ld bc,0xffc0` (moves TWO
// rows instead of one) and proves the register/memory contract catches it even
// though the cycle total is identical (ld bc,nn is 10 T either way).
//
// Real Regs + AddressSpace + Io are used so the flag helpers and the RAM writes are
// the genuine hardware model. step/call/ret/push16 are recorders: `call` captures a
// transfer target WITHOUT invoking the real callee (for the tail-jump `return
// m.call(addr)` models "control left here and loc_4bff's ret unwinds to OUR
// caller"; for the mid-body call 0x4c8f the callee reads nothing back here).
//
// Run: node --test games/thepit/translated/test/loc_4eea.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs, F_C } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_4eea } from "../loc_4eea.js";

function makeMachine(seed = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x4eea,
    steps: [],
    calls: [],
    pushes: [],
    returned: false,
    ret(cycles = 10) {
      this.cycles += cycles;
      this.returned = true;
    },
    call(addr) {
      this.calls.push(addr);
      return undefined; // tail-jump / mid-call: callee's own effects irrelevant here
    },
    push16(value) {
      this.pushes.push(value);
    },
  };
  m.mem = new AddressSpace(rom, m.io);
  m.step = (nextAddr, cycles) => {
    m.pc = nextAddr;
    m.cycles += cycles;
    m.steps.push(nextAddr);
  };
  for (const [addr, val] of Object.entries(seed)) m.mem.write8(Number(addr), val);
  return m;
}

function assertPath(m, exp) {
  assert.deepEqual(m.steps, exp.steps, "step targets (instruction boundaries)");
  assert.deepEqual(m.calls, exp.calls, "call / tail-jump targets");
  assert.deepEqual(m.pushes, exp.pushes ?? [], "pushed return addresses");
  assert.equal(m.returned, exp.returned ?? false, "direct ret?");
  assert.equal(m.cycles, exp.cycles, "T-state total");
  assert.equal(m.pc, exp.pc, "final PC");
  for (const [reg, val] of Object.entries(exp.regs ?? {})) {
    assert.equal(m.regs[reg], val, `${reg} register`);
  }
  for (const [addr, val] of Object.entries(exp.mem ?? {})) {
    assert.equal(m.mem.read8(Number(addr)), val, `mem[0x${Number(addr).toString(16)}]`);
  }
}

// -- idle: no dispatch bit set -> ret z ---------------------------------------
const IDLE_STEPS = [
  0x4eed, 0x4eef, 0x4ef1, 0x4ef3, 0x4ef5, 0x4ef7, 0x4ef9, 0x4efb, 0x4efd, 0x4eff,
];
// 13 + 4*(8+7) + 8 + 11 = 92
const IDLE_CYCLES = 13 + 4 * (8 + 7) + 8 + 11;

test("idle: 0x8018 = 0x00 -> ret z, touches nothing", () => {
  const m = makeMachine({ 0x8018: 0x00 });
  loc_4eea(m);
  assertPath(m, {
    steps: IDLE_STEPS,
    calls: [],
    returned: true,
    cycles: IDLE_CYCLES,
    pc: 0x4eff, // ret does not step in this mock; pc = last step (bit 4,a boundary)
  });
  assert.equal(IDLE_CYCLES, 92, "idle T-state total is 92");
});

test("idle: only bits 5..7 set (0xE0) still returns -- only bits 0..4 dispatch", () => {
  const m = makeMachine({ 0x8018: 0xe0 });
  loc_4eea(m);
  assertPath(m, { steps: IDLE_STEPS, calls: [], returned: true, cycles: 92, pc: 0x4eff });
});

// -- bit0 -> loc_4f26 (step down), first test in the cascade -------------------
test("bit0: 0x8018 = 0x01 -> tail-jump loc_4f26 (33 T)", () => {
  const m = makeMachine({ 0x8018: 0x01 });
  loc_4eea(m);
  assertPath(m, {
    steps: [0x4eed, 0x4eef, 0x4f26],
    calls: [0x4f26],
    cycles: 13 + 8 + 12, // ld a + bit0 + jr taken = 33
    pc: 0x4f26,
  });
});

// -- bit1 -> loc_4f38 (step up) ------------------------------------------------
test("bit1: 0x8018 = 0x02 -> tail-jump loc_4f38 (48 T)", () => {
  const m = makeMachine({ 0x8018: 0x02 });
  loc_4eea(m);
  assertPath(m, {
    steps: [0x4eed, 0x4eef, 0x4ef1, 0x4ef3, 0x4f38],
    calls: [0x4f38],
    cycles: 13 + 8 + 7 + 8 + 12, // + bit0/jr-not + bit1/jr-taken = 48
    pc: 0x4f38,
  });
});

// -- bit2 -> loc_4f26 ----------------------------------------------------------
test("bit2: 0x8018 = 0x04 -> tail-jump loc_4f26 (63 T)", () => {
  const m = makeMachine({ 0x8018: 0x04 });
  loc_4eea(m);
  assertPath(m, {
    steps: [0x4eed, 0x4eef, 0x4ef1, 0x4ef3, 0x4ef5, 0x4ef7, 0x4f26],
    calls: [0x4f26],
    cycles: 13 + (8 + 7) + (8 + 7) + 8 + 12, // = 63
    pc: 0x4f26,
  });
});

// -- bit3 -> loc_4f38 ----------------------------------------------------------
test("bit3: 0x8018 = 0x08 -> tail-jump loc_4f38 (78 T)", () => {
  const m = makeMachine({ 0x8018: 0x08 });
  loc_4eea(m);
  assertPath(m, {
    steps: [0x4eed, 0x4eef, 0x4ef1, 0x4ef3, 0x4ef5, 0x4ef7, 0x4ef9, 0x4efb, 0x4f38],
    calls: [0x4f38],
    cycles: 13 + (8 + 7) * 3 + 8 + 12, // = 78
    pc: 0x4f38,
  });
});

// -- priority: bit0 wins over bit1 (both set) ---------------------------------
test("priority: 0x8018 = 0x03 (bit0+bit1) dispatches to loc_4f26 (bit0 first)", () => {
  const m = makeMachine({ 0x8018: 0x03 });
  loc_4eea(m);
  assertPath(m, {
    steps: [0x4eed, 0x4eef, 0x4f26],
    calls: [0x4f26], // NOT loc_4f38 -- bit0 is tested first and short-circuits
    cycles: 33,
    pc: 0x4f26,
  });
});

// -- bit4 -> the full COMMIT body, tail-jump to loc_4bff ----------------------
// Concrete register inputs so every downstream value is checked.
const COMMIT_SEED = {
  0x804b: 0x05, // counter to decrement -> 0x04
  0x8010: 0xaa, // to be cleared -> 0x00
};
function makeCommitMachine() {
  const m = makeMachine({ 0x8018: 0x10, ...COMMIT_SEED });
  m.regs.hl = 0x9100; // top cell (video RAM)
  m.regs.ix = 0x9120; // bottom cell
  m.regs.de = 0x9200; // parallel structure
  m.regs.b = 0x55; // object code
  m.regs.c = 0x70; // blank/erase code
  return m;
}

const COMMIT_STEPS = [
  0x4eed, 0x4eef, 0x4ef1, 0x4ef3, 0x4ef5, 0x4ef7, 0x4ef9, 0x4efb, 0x4efd, 0x4eff, // header
  0x4f00, // ret z NOT taken (bit4 set)
  0x4f01, 0x4f04, 0x4f05, 0x4f08, 0x4f09, 0x4f0a, 0x4f0b, 0x4f0c, 0x4f0e, 0x4f10,
  0x4f11, 0x4f12, 0x4f15, 0x4f16, 0x4f19, 0x4f1b, 0x4f1e,
  0x4c8f, // call 0x4c8f
  0x4f23, // ld a,0x14
  0x4bff, // jp 0x4bff (tail)
];
// header 13 + 4*(8+7) + 8 + 5 = 86; body 182; total 268.
const COMMIT_CYCLES = 268;

function checkCommit(m) {
  assertPath(m, {
    steps: COMMIT_STEPS,
    calls: [0x4c8f, 0x4bff], // mid-body call THEN the tail-jump
    pushes: [0x4f21], // only the call 0x4c8f pushes a return address
    returned: false, // single unwind via the tail-jump, no direct ret
    cycles: COMMIT_CYCLES,
    pc: 0x4bff,
    regs: {
      a: 0x14, // final ld a,0x14
      b: 0x55, // ld b,a = object code
      c: 0x0a, // ld c,0x0a
      hl: 0x90e0, // 0x9100 - 0x20
      de: 0x91e0, // 0x9200 - 0x20
      ix: 0x9121, // inc ix
    },
    mem: {
      0x9100: 0x70, // (hl):=C  erase top cell
      0x9120: 0x70, // (ix+0):=C erase bottom cell
      0x91e0: 0x55, // (de):=A  redraw object code one row up
      0x804b: 0x04, // decremented counter
      0x8010: 0x00, // cleared
    },
  });
}

test("bit4 commit: erases 2 cells, moves up a row, redraws, dec 0x804b, tail-jumps loc_4bff (268 T)", () => {
  const m = makeCommitMachine();
  loc_4eea(m);
  checkCommit(m);
  console.log("  loc_4eea commit: A=0x14, 268 T, calls [0x4c8f, 0x4bff], push [0x4f21]");
});

// -- TEETH --------------------------------------------------------------------
// A faithful twin of loc_4eea whose ONLY break is the row-offset immediate:
// `ld bc,0xffe0` (move up ONE 0x20 row) corrupted to `ld bc,0xffc0` (move up TWO).
// The cycle total is identical (ld bc,nn is 10 T either way and control flow is
// unchanged), so ONLY the register/memory contract can reject it: hl/de land one
// extra row up (0x90c0 / 0x91c0) and the object code is redrawn at 0x91c0, not
// 0x91e0. The commit contract must CATCH this.
function loc_4eea_mutant(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x8018);
  m.step(0x4eed, 13);
  regs.bit(0, regs.a);
  m.step(0x4eef, 8);
  if (regs.fNZ) { m.step(0x4f26, 12); return m.call(0x4f26); }
  m.step(0x4ef1, 7);
  regs.bit(1, regs.a);
  m.step(0x4ef3, 8);
  if (regs.fNZ) { m.step(0x4f38, 12); return m.call(0x4f38); }
  m.step(0x4ef5, 7);
  regs.bit(2, regs.a);
  m.step(0x4ef7, 8);
  if (regs.fNZ) { m.step(0x4f26, 12); return m.call(0x4f26); }
  m.step(0x4ef9, 7);
  regs.bit(3, regs.a);
  m.step(0x4efb, 8);
  if (regs.fNZ) { m.step(0x4f38, 12); return m.call(0x4f38); }
  m.step(0x4efd, 7);
  regs.bit(4, regs.a);
  m.step(0x4eff, 8);
  if (regs.fZ) { m.ret(11); return; }
  m.step(0x4f00, 5);
  mem.write8(regs.hl, regs.c);
  m.step(0x4f01, 7);
  mem.write8((regs.ix + 0x00) & 0xffff, regs.c);
  m.step(0x4f04, 19);
  regs.a = regs.b;
  m.step(0x4f05, 4);
  regs.bc = 0xffc0; // BUG: 0xffe0 -> 0xffc0 (moves up two rows, not one)
  m.step(0x4f08, 10);
  regs.addHl(regs.bc);
  m.step(0x4f09, 11);
  regs.exDeHl();
  m.step(0x4f0a, 4);
  regs.addHl(regs.bc);
  m.step(0x4f0b, 11);
  regs.exDeHl();
  m.step(0x4f0c, 4);
  regs.ix = (regs.ix + 1) & 0xffff;
  m.step(0x4f0e, 10);
  regs.c = 0x0a;
  m.step(0x4f10, 7);
  mem.write8(regs.de, regs.a);
  m.step(0x4f11, 7);
  regs.b = regs.a;
  m.step(0x4f12, 4);
  regs.a = mem.read8(0x804b);
  m.step(0x4f15, 13);
  regs.a = regs.dec8(regs.a);
  m.step(0x4f16, 4);
  mem.write8(0x804b, regs.a);
  m.step(0x4f19, 13);
  regs.a = 0x00;
  m.step(0x4f1b, 7);
  mem.write8(0x8010, regs.a);
  m.step(0x4f1e, 13);
  m.push16(0x4f21); m.step(0x4c8f, 17); m.call(0x4c8f);
  regs.a = 0x14;
  m.step(0x4f23, 7);
  m.step(0x4bff, 10);
  return m.call(0x4bff);
}

test("TEETH: the ld bc,0xffe0 -> ld bc,0xffc0 twin is CAUGHT by the commit contract", () => {
  // The real routine passes the contract.
  {
    const good = makeCommitMachine();
    loc_4eea(good);
    checkCommit(good);
  }

  // The mutant preserves the cycle total but lands hl/de one row too far up.
  const m = makeCommitMachine();
  loc_4eea_mutant(m);
  assert.equal(m.cycles, COMMIT_CYCLES, "mutation preserves the 268 T total (cycles can't catch it)");
  assert.throws(
    () => checkCommit(m),
    /de register|hl register|mem\[0x91e0\]/,
    "the commit contract FAILED to catch the row-offset break -- it has no teeth",
  );
  // Concretely: hl/de moved two rows and the object code redrew at the wrong cell.
  assert.equal(m.regs.hl, 0x90c0, "mutant: hl = 0x9100 - 0x40 (two rows up)");
  assert.equal(m.regs.de, 0x91c0, "mutant: de = 0x9200 - 0x40");
  assert.equal(m.mem.read8(0x91c0), 0x55, "mutant: object code redrawn at 0x91c0");
  assert.equal(m.mem.read8(0x91e0), 0x00, "mutant: nothing written at the correct 0x91e0");
});

// A sibling sanity check that the F_C import is used and add hl,bc leaves S/Z/PV
// intact while writing carry -- guards the addHl flag semantics on the commit path.
test("commit: add hl,bc sets carry (0x9100 + 0xffe0 wraps past 0xffff)", () => {
  const m = makeCommitMachine();
  loc_4eea(m);
  assert.equal(m.regs.f & F_C, F_C, "carry set by add hl,bc wrap (0x9100 + 0xffe0 > 0xffff)");
});
