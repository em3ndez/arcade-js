// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_2065 (ROM 0x2065-0x208b, Pooyan): render a 5-cell bar gauge at 0x863f
// (cells stride 0xffe0, bottom-up). Value at 0x8908: 0 -> ret z; else (value-1) clamped to 5 cells are
// drawn filled (tile 0xb0), the remaining (5 - filled) drawn blank (tile 0x10). Leaf, no calls -- the
// mock's `call` still POPS (template invariant) though it never fires.
// Run: node --test games/pooyan/translated/test/loc_2065.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2065 } from "../loc_2065.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x2065, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_2065 MIXED: value 3 -> 2 filled + 3 blank cells; 274 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8908, 0x03);

  loc_2065(m);

  assert.equal(m.tstates, 274, "MIXED T-state total");
  assert.deepEqual(m.pcSeq, [
    0x2068, 0x206b, 0x206e, 0x206f, 0x2070, 0x2071, 0x2072, 0x2074, 0x2076, 0x207a, 0x207b, 0x207c,
    0x207e, 0x207f, 0x207c, // filled cell 1
    0x207e, 0x207f, 0x2081, // filled cell 2 -> loop out
    0x2083, 0x2084, 0x2085, 0x2086,
    0x2088, 0x2089, 0x2086, // blank cell 1
    0x2088, 0x2089, 0x2086, // blank cell 2
    0x2088, 0x2089, 0x208b, // blank cell 3 -> loop out
    CALLER_RET,
  ], "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "ret to the seated caller");
  // filled cells (0xb0) at 0x863f, 0x861f; blanks (0x10) at 0x85ff, 0x85df, 0x85bf
  assert.equal(m.mem.read8(0x863f), 0xb0, "filled cell 1");
  assert.equal(m.mem.read8(0x861f), 0xb0, "filled cell 2");
  assert.equal(m.mem.read8(0x85ff), 0x10, "blank cell 1");
  assert.equal(m.mem.read8(0x85df), 0x10, "blank cell 2");
  assert.equal(m.mem.read8(0x85bf), 0x10, "blank cell 3");
  assert.equal(m.regs.hl, 0x859f, "HL after 5 cells (5x 0xffe0 from 0x863f)");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_2065 VALUE1: value 1 -> C=0, all 5 cells blank; 257 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8908, 0x01);

  loc_2065(m);

  assert.equal(m.tstates, 257, "VALUE1 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x2068, 0x206b, 0x206e, 0x206f, 0x2070, 0x2071, 0x2072, 0x2081, // jr z taken (value-1==0)
    0x2083, 0x2084, 0x2085, 0x2086,
    0x2088, 0x2089, 0x2086,
    0x2088, 0x2089, 0x2086,
    0x2088, 0x2089, 0x2086,
    0x2088, 0x2089, 0x2086,
    0x2088, 0x2089, 0x208b,
    CALLER_RET,
  ], "jr z branch (C=0) then 5 blanks");
  for (const a of [0x863f, 0x861f, 0x85ff, 0x85df, 0x85bf]) {
    assert.equal(m.mem.read8(a), 0x10, `blank at ${a.toString(16)}`);
  }
  assert.equal(m.regs.hl, 0x859f);
});

test("loc_2065 CLAMP: value 8 -> (value-1)=7 clamped to 5 filled, then ret z (no blanks); 273 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8908, 0x08);

  loc_2065(m);

  assert.equal(m.tstates, 273, "CLAMP T-state total");
  assert.deepEqual(m.pcSeq, [
    0x2068, 0x206b, 0x206e, 0x206f, 0x2070, 0x2071, 0x2072, 0x2074, 0x2076, 0x2078, 0x207a, 0x207b, 0x207c,
    0x207e, 0x207f, 0x207c,
    0x207e, 0x207f, 0x207c,
    0x207e, 0x207f, 0x207c,
    0x207e, 0x207f, 0x207c,
    0x207e, 0x207f, 0x2081, // 5th filled cell -> loop out
    0x2083, 0x2084,         // a=5, sub c(=5) -> ret z
    CALLER_RET,
  ], "jr c not taken (clamp to 5) then ret z at 0x2084");
  for (const a of [0x863f, 0x861f, 0x85ff, 0x85df, 0x85bf]) {
    assert.equal(m.mem.read8(a), 0xb0, `filled at ${a.toString(16)}`);
  }
  assert.equal(m.regs.a, 0x00, "5 - 5 = 0 (ret z)");
});

test("loc_2065 ZERO: value 0 -> ret z immediately; 48 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8908, 0x00);

  loc_2065(m);

  assert.equal(m.tstates, 48, "ZERO T-state total (10+10+13+4+11)");
  assert.deepEqual(m.pcSeq, [0x2068, 0x206b, 0x206e, 0x206f, CALLER_RET]);
  assert.equal(m.mem.read8(0x863f), 0x00, "no cells drawn");
});

test("loc_2065 MUTATION: filled-loop `add hl,de` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x207f ? 7 : cycles);
  seatCaller(m);
  m.mem.write8(0x8908, 0x03);

  loc_2065(m);

  assert.equal(m.tstates, 266, "mutation loses 4 T per filled add hl (2x) = 8");
  assert.throws(
    () => assert.equal(m.tstates, 274, "MIXED T-state total"),
    /274/,
    "the 274-T golden must fail on the mutant",
  );
});
