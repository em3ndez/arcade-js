// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_4381 (ROM 0x4381-0x43e0): the display-list interpreter.
//
// Self-contained mock machine (real Regs for exact flags, flat 64K RAM, step/ret/push16/pop16
// mirroring the pooyan Machine). The routine is a leaf (no call/rst) with two `ret` exits, so the
// seated caller's return address on the stack is the final PC and m.calls stays empty.
//
// Run: node --test games/pooyan/translated/test/loc_4381.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_4381 } from "../loc_4381.js";

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

// ── Path 1: (0x8920)==0 -> uses (0x8f43)/(0x8f45); one literal copy, then a 0xff "reload dest"
//    opcode reloads HL from the stream, adds a byte to (0x88b7), and jumps to store_ptrs. ──────────
function setupP1(m) {
  seatCaller(m);
  m.mem.write8(0x8920, 0x00);
  m.mem.write16(0x8f43, 0x9000);       // dest pointer
  m.mem.write16(0x8f45, 0x8a00);       // stream pointer
  m.mem.write8(0x8a00, 0x42);          // literal tile
  m.mem.write8(0x8a01, 0xff);          // opcode: reload dest
  m.mem.write8(0x8a02, 0x34);          // new dest lo
  m.mem.write8(0x8a03, 0x12);          // new dest hi -> HL=0x1234
  m.mem.write8(0x8a04, 0x05);          // add to accumulator
  m.mem.write8(0x88b7, 0x20);          // accumulator seed
}

test("loc_4381 Path 1: literal + 0xff reload, stores back to 0x8f43/0x8f45; 348 T", () => {
  const m = makeMachine();
  setupP1(m);

  loc_4381(m);

  assert.equal(m.tstates, 348, "Path 1 T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.deepEqual(m.calls, [], "leaf: no calls");
  assert.equal(m.mem.read8(0x9000), 0x42, "literal copied to dest");
  assert.equal(m.mem.read16(0x8f43), 0x1234, "advanced HL (reloaded) stored to 0x8f43");
  assert.equal(m.mem.read16(0x8f45), 0x8a05, "advanced stream ptr stored to 0x8f45");
  assert.equal(m.mem.read8(0x88b7), 0x25, "(0x88b7) accumulator += 0x05");
  assert.deepEqual(m.pcSeq,
    [0x4383, 0x4386, 0x4389, 0x438d, 0x438e, 0x4397, 0x4398, 0x439a, 0x439c, 0x439e,
     0x43a0, 0x43a1, 0x43a2, 0x43a3, 0x4397, 0x4398, 0x439a, 0x439c, 0x439e, 0x43ce,
     0x43cf, 0x43d0, 0x43d1, 0x43d2, 0x43d3, 0x43d4, 0x43d5, 0x43d6, 0x43d7, 0x43da,
     0x43db, 0x43de, 0x43df, 0x43a8, 0x43ab, 0x43ac, 0x43ae, 0x43b1, 0x43b5, CALLER_RET],
    "Path 1 step boundaries");
});

test("loc_4381 Path 1 MUTATION: `ld (0x88b7),a` mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  setupP1(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x43de ? 7 : c); // 43db lands at 0x43de
  loc_4381(m);
  assert.equal(m.tstates, 342, "mutation loses 6 T (13 -> 7)");
  assert.notEqual(m.tstates, 348, "golden T-state total catches the mutant");
});

// ── Path 2: (0x8920)!=0 -> uses (0x88b8)/(0x88ba); a 0x10 "skip C" opcode drains the whole B count,
//    falls into after_loop (inc hl x3), and stores back to 0x88b8/0x88ba. ───────────────────────────
function setupP2(m) {
  seatCaller(m);
  m.mem.write8(0x8920, 0x01);
  m.mem.write16(0x88b8, 0x9000);       // dest pointer
  m.mem.write16(0x88ba, 0x8b00);       // stream pointer
  m.mem.write8(0x8b00, 0x10);          // opcode: skip C
  m.mem.write8(0x8b01, 0x1d);          // C = 0x1d == B, so B -> 0
}

test("loc_4381 Path 2: 0x10 skip drains B, after_loop +3, stores to 0x88b8/0x88ba; 296 T", () => {
  const m = makeMachine();
  setupP2(m);

  loc_4381(m);

  assert.equal(m.tstates, 296, "Path 2 T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.deepEqual(m.calls, [], "leaf: no calls");
  assert.equal(m.regs.b, 0x00, "B fully drained by the skip");
  assert.equal(m.mem.read16(0x88b8), 0x9020, "dest = 0x9000 + 0x1d skip + 3 inc");
  assert.equal(m.mem.read16(0x88ba), 0x8b02, "stream advanced past the 2-byte opcode");
  assert.deepEqual(m.pcSeq,
    [0x4383, 0x4386, 0x4389, 0x438d, 0x438e, 0x4390, 0x4393, 0x4397, 0x4398, 0x439a,
     0x43be, 0x43bf, 0x43c0, 0x43c1, 0x43c2, 0x43c5, 0x43c6, 0x43c7, 0x43c8, 0x43c9,
     0x43ca, 0x43cc, 0x43a5, 0x43a6, 0x43a7, 0x43a8, 0x43ab, 0x43ac, 0x43b6, 0x43b9,
     0x43bd, CALLER_RET],
    "Path 2 step boundaries");
});

// ── Path 3: the copy loop -- N literals before a 0xff terminator. The loop-top `ld a,(de)` (0x4398)
//    fires once per stream byte read; a step-zeroing mutation there drops exactly N*7 T. ────────────
function setupP3(m) {
  seatCaller(m);
  m.mem.write8(0x8920, 0x00);
  m.mem.write16(0x8f43, 0x9000);
  m.mem.write16(0x8f45, 0x8a00);
  for (let i = 0; i < 5; i++) m.mem.write8(0x8a00 + i, 0x30 + i); // 5 literals
  m.mem.write8(0x8a05, 0xff);          // terminator: reload dest
  m.mem.write8(0x8a06, 0x00);
  m.mem.write8(0x8a07, 0x90);
  m.mem.write8(0x8a08, 0x00);
}

test("loc_4381 Path 3: 5 literals then 0xff -> loop-top read fires 6x; zeroing it drops 42 T", () => {
  const full = makeMachine();
  setupP3(full);
  loc_4381(full);
  const reads = full.pcSeq.filter((p) => p === 0x4398).length;
  assert.equal(reads, 6, "`ld a,(de)` lands at 0x4398 once per stream byte (5 literals + terminator)");
  for (let i = 0; i < 5; i++) {
    assert.equal(full.mem.read8(0x9000 + i), 0x30 + i, `literal ${i} copied`);
  }

  const mut = makeMachine();
  setupP3(mut);
  const realStep = mut.step.bind(mut);
  mut.step = (n, c) => realStep(n, n === 0x4398 ? 0 : c);
  loc_4381(mut);
  assert.equal(full.tstates - mut.tstates, 42, "the 6 loop-top reads contribute 6*7=42 T; a dropped step is caught");
});
