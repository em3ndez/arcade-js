// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_312d (ROM 0x312d-0x316c), The Pit.
//
// Runs the routine on a lightweight machine built from the REAL thepit address
// space (boards/thepit/memory.js) + Io + the shared Z80 Regs, with a fresh
// (zeroed) fake ROM (the copyrighted image is never committed; this routine
// touches only work RAM, never ROM content).
//
// loc_312d is the object-1 half of a two-object move/collision + sprite-record
// pass: it copies object 1's 17-byte record to scratch (0x8083), CALLS 0x319d
// (the move/collision driver), copies scratch back, then builds a 4-byte sprite
// record at 0x8230 whose 4th byte is object1[3] + (0x8051). It then either bails
// to 0x3748 (when 0x8001==4 && 0x8010<0x0a) or DELEGATES object 2 to loc_316f.
// It has NO `ret`: every exit is a jump that discards its frame -- a TAIL-JUMP to
// 0x3748, or a hand-off to loc_316f (its OWN registered routine, which itself
// tail-jumps to 0x3748), so control returns to loc_312d's caller either way.
//
// The three transfer targets are stubbed:
//   0x319d -> a stub that just `ret`s (pops the pushed return address 0x3143,
//             charges 0 test T-states) so the routine's OWN cycle count is
//             isolated and the pushed return address is observable.
//   0x316f / 0x3748 -> the two jump targets: recorded, but NOT run/ret'd, so the
//             exit pc/sp/stack-top freeze at the moment of the transfer. Because
//             both are JUMPS (no push), the caller's return (SENTINEL) stays on top.
//
// Covers all four control-flow exits (skip when 0x8010<8; stop-after-object-1 to
// 0x3748 when 0x8001==4 && 0x8010<0x0a; delegate to loc_316f via the jr-nz branch;
// delegate to loc_316f via the jp-c fall-through), each T-state total, the sprite
// record, the object round-trip, and the exact transfer sequence. The MUTATION
// replaces the 0x316c tail-jump `jp c,0x3748` with a `ret` -- the classic
// tail-jump-vs-ret confusion, a SAME-CYCLE control-flow break (jp and ret are both
// 10 T) that returns to the caller instead of delegating to 0x3748; the spec must
// reject it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_312d } from "../loc_312d.js";

const BIAS = 0x10; // (0x8051)
const SENTINEL = 0xbeef; // the caller's return address; a jump exit must preserve it on top

// Object 1 record: [0..2] copied verbatim into the sprite record, [3] biased by
// BIAS; [4..16] carried through the scratch round-trip untouched. Object 2's
// record (0x80f9..) is seeded too but is loc_316f's business, not loc_312d's.
const OBJ1 = Array.from({ length: 17 }, (_, i) => (i < 4 ? [0xaa, 0xbb, 0xcc, 0x40][i] : 0xd0 + i));
const OBJ2 = Array.from({ length: 17 }, (_, i) => (i < 4 ? [0x11, 0x22, 0x33, 0x44][i] : 0xe0 + i));

const EXP_SPR1 = [0xaa, 0xbb, 0xcc, (0x40 + BIAS) & 0xff]; // 0x8230..0x8233 -> [aa,bb,cc,50]
const ZERO4 = [0, 0, 0, 0];

// -- minimal machine: real mem/io/regs + the step/call/ret/ldir seam ----------
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x312d;
    this.regs.sp = 0x8780; // inside work RAM (0x8000-0x87ff) so pushes are mapped
    this.calls = [];
    // Callee stubs. 0x319d returns (pops its pushed return addr, 0 test cycles).
    // 0x316f and 0x3748 are jump targets: recorded only (no ret) so exit freezes.
    this.routines = {
      0x319d: (m) => { m.ret(0); },
    };
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
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }
  call(addr, ...args) {
    // Record target + the return address on top of the stack at the moment of
    // transfer: a real CALL just pushed it; a jump/tail-jump leaves the caller's
    // own return (SENTINEL) there.
    this.calls.push({ addr, retTop: this.mem.read16(this.regs.sp), sp: this.regs.sp });
    const stub = this.routines[addr];
    if (stub) return stub(this, ...args);
    return undefined;
  }
  // Byte-for-byte the machine.js semantics: 21 T per repeating iter, 16 on exit.
  ldirAt(self, nextAddr) {
    const { regs, mem } = this;
    for (;;) {
      mem.write8(regs.de, mem.read8(regs.hl));
      regs.hl = (regs.hl + 1) & 0xffff;
      regs.de = (regs.de + 1) & 0xffff;
      regs.bc = (regs.bc - 1) & 0xffff;
      if (regs.bc === 0) {
        this.step(nextAddr, 16);
        return;
      }
      this.step(self, 21);
    }
  }
}

function seed(m, c8010, c8001) {
  m.mem.write8(0x8051, BIAS);
  m.mem.write8(0x8010, c8010);
  m.mem.write8(0x8001, c8001);
  for (let i = 0; i < 17; i++) {
    m.mem.write8(0x80e8 + i, OBJ1[i]); // object 1 record 0x80e8..0x80f8
    m.mem.write8(0x80f9 + i, OBJ2[i]); // object 2 record 0x80f9..0x8109
  }
}

function run(fn, c8010, c8001) {
  const rom = new Uint8Array(0x5000); // AddressSpace requires exactly 20480 bytes
  const m = new TestMachine(rom);
  seed(m, c8010, c8001);
  m.push16(SENTINEL); // the caller's return address
  const sp0 = m.regs.sp; // == 0x877e; a jump/tail-jump exit must leave SP here
  fn(m);
  return {
    cycles: m.cycles,
    spr1: [0, 1, 2, 3].map((i) => m.mem.read8(0x8230 + i)),
    spr2: [0, 1, 2, 3].map((i) => m.mem.read8(0x8234 + i)), // loc_316f's job; loc_312d must NOT write it
    obj1: [0, 1, 2, 3].map((i) => m.mem.read8(0x80e8 + i)), // must survive the round-trip
    pc: m.pc,
    sp: m.regs.sp,
    sp0,
    a: m.regs.a,
    b: m.regs.b,
    hl: m.regs.hl,
    de: m.regs.de,
    calls: m.calls,
  };
}

// ---- object 1 processed, then DELEGATE to loc_316f (0x8010>=8, 0x8001!=4) -----
function checkDelegatesToObj2(res, expCycles) {
  assert.equal(res.cycles, expCycles, "T-state total");
  assert.deepEqual(res.spr1, EXP_SPR1, "sprite record 1: 3 bytes + biased 4th");
  assert.deepEqual(res.spr2, ZERO4, "sprite record 2 left to loc_316f (unwritten here)");
  assert.deepEqual(res.obj1, OBJ1.slice(0, 4), "object 1 record restored by round-trip");
  assert.equal(res.pc, 0x316f, "delegated INTO loc_316f (not returned)");
  assert.equal(res.sp, res.sp0, "SP balanced at the hand-off (SENTINEL still on top)");
  assert.equal(res.b, BIAS, "B = bias on exit");
  assert.equal(res.hl, 0x80eb, "HL past object 1's copied triple");
  assert.equal(res.de, 0x8233, "DE at sprite1[3]");
  // exact transfer sequence: one real CALL to 0x319d (returns 0x3143) then the
  // hand-off to loc_316f with the caller's own return (SENTINEL) on top.
  assert.deepEqual(res.calls.map((c) => c.addr), [0x319d, 0x316f], "0x319d call then loc_316f hand-off");
  assert.equal(res.calls[0].retTop, 0x3143, "object-1 CALL 0x319d returns to 0x3143");
  assert.equal(res.calls[1].retTop, SENTINEL, "loc_316f hand-off keeps caller's return on top");
}

test("loc_312d: object 1 then delegate to loc_316f via jr-nz branch, 966 T", () => {
  checkDelegatesToObj2(run(loc_312d, 0x10, 0x00), 966);
});

test("loc_312d: object 1 then delegate to loc_316f via jp-c fall-through (0x8001==4, 0x8010>=0x0a), 991 T", () => {
  checkDelegatesToObj2(run(loc_312d, 0x10, 0x04), 991);
});

test("loc_312d: skip everything when 0x8010 < 8 (30 T, straight to 0x3748)", () => {
  const res = run(loc_312d, 0x05, 0x00);
  assert.equal(res.cycles, 30, "T-state total (guard only)");
  assert.deepEqual(res.spr1, ZERO4, "no sprite record 1 written");
  assert.deepEqual(res.spr2, ZERO4, "no sprite record 2 written");
  assert.equal(res.pc, 0x3748, "tail-jumped into 0x3748");
  assert.equal(res.sp, res.sp0, "SP untouched (SENTINEL on top)");
  assert.deepEqual(res.calls.map((c) => c.addr), [0x3748], "only the tail-jump, no 0x319d/loc_316f");
});

// ---- object 1 only, then stop at 0x3748 (0x8001==4 && 0x8010<0x0a) -----------
function checkStopAfterObj1(res) {
  assert.equal(res.cycles, 991, "T-state total (object 1 only)");
  assert.deepEqual(res.spr1, EXP_SPR1, "sprite record 1 built");
  assert.deepEqual(res.spr2, ZERO4, "sprite record 2 NOT built");
  assert.equal(res.pc, 0x3748, "tail-jumped into 0x3748");
  assert.equal(res.sp, res.sp0, "SP balanced (SENTINEL on top)");
  assert.deepEqual(res.calls.map((c) => c.addr), [0x319d, 0x3748], "one 0x319d call + the 0x3748 tail-jump");
  assert.equal(res.calls[1].retTop, SENTINEL, "tail-jump keeps caller's return on top");
}

test("loc_312d: stop after object 1 when 0x8001==4 && 0x8010<0x0a (991 T, to 0x3748)", () => {
  checkStopAfterObj1(run(loc_312d, 0x09, 0x04));
});

// -- MUTATION: model the 0x316c `jp c,0x3748` as a `ret` instead of a tail-jump.
// This is the exact trap the translation doc warns about: a jp that discards the current frame
// must be `return m.call(target)`, NOT m.ret(). The mutant pops SENTINEL and
// "returns" to the caller directly, skipping 0x3748 -- wrong control flow at the
// IDENTICAL 991 T (jp-taken and ret are both 10 T). Everything up to 0x316c is the
// real routine's logic, so the mutant still builds sprite record 1 correctly.
function loc_312d_mutant(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x8010); m.step(0x3130, 13);
  regs.cp(0x08); m.step(0x3132, 7);
  if (regs.fC) { m.step(0x3748, 10); return m.call(0x3748); }
  m.step(0x3135, 10);
  regs.hl = 0x80e8; m.step(0x3138, 10);
  regs.de = 0x8083; m.step(0x313b, 10);
  regs.bc = 0x0011; m.step(0x313e, 10);
  m.ldirAt(0x313e, 0x3140);
  m.push16(0x3143); m.step(0x319d, 17); m.call(0x319d);
  regs.hl = 0x8083; m.step(0x3146, 10);
  regs.de = 0x80e8; m.step(0x3149, 10);
  regs.bc = 0x0011; m.step(0x314c, 10);
  m.ldirAt(0x314c, 0x314e);
  regs.de = 0x8230; m.step(0x3151, 10);
  regs.hl = 0x80e8; m.step(0x3154, 10);
  regs.bc = 0x0003; m.step(0x3157, 10);
  m.ldirAt(0x3157, 0x3159);
  regs.a = mem.read8(0x8051); m.step(0x315c, 13);
  regs.b = regs.a; m.step(0x315d, 4);
  regs.a = mem.read8(regs.hl); m.step(0x315e, 7);
  regs.add(regs.b); m.step(0x315f, 4);
  mem.write8(regs.de, regs.a); m.step(0x3160, 7);
  regs.a = mem.read8(0x8001); m.step(0x3163, 13);
  regs.cp(0x04); m.step(0x3165, 7);
  if (regs.fNZ) { m.step(0x316f, 12); return m.call(0x316f); }
  m.step(0x3167, 7);
  regs.a = mem.read8(0x8010); m.step(0x316a, 13);
  regs.cp(0x0a); m.step(0x316c, 7);
  if (regs.fC) { m.ret(); return; } // BUG: tail-jump to 0x3748 modelled as a plain ret
  m.step(0x316f, 10);
  return m.call(0x316f);
}

test("mutation (tail-jump to 0x3748 modelled as ret) is caught by the spec", () => {
  const bad = run(loc_312d_mutant, 0x09, 0x04);
  // Sanity: the mutant builds the SAME sprite record at the SAME cycle count --
  // the break is control-flow only.
  assert.equal(bad.cycles, 991, "mutant mischarges nothing -- same T total");
  assert.deepEqual(bad.spr1, EXP_SPR1, "mutant still builds sprite record 1");
  // ...but it returned to the caller instead of tail-jumping into 0x3748.
  assert.equal(bad.pc, SENTINEL, "mutant returned to the caller directly");
  assert.notEqual(bad.pc, 0x3748, "mutant never reached 0x3748");
  // The spec the real routine passes must REJECT the mutant.
  assert.throws(() => checkStopAfterObj1(bad));
});
