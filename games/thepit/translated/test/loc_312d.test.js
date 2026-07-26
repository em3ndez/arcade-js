// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_312d (ROM 0x312d-0x319a), The Pit.
//
// Runs the routine on a lightweight machine built from the REAL thepit address
// space (boards/thepit/memory.js) + Io + the shared Z80 Regs, with a fresh
// (zeroed) fake ROM (the copyrighted image is never committed; this routine
// touches only work RAM, never ROM content).
//
// loc_312d advances up to two objects: for each it copies a 17-byte object
// record to scratch (0x8083), CALLS 0x319d (the move/collision driver), copies
// scratch back, then builds a 4-byte sprite record (0x8230 / 0x8234) whose 4th
// byte is object[3] + (0x8051). It has NO `ret`: every exit is a TAIL-JUMP to
// 0x3748, so 0x3748's own ret returns to loc_312d's caller.
//
// The two callees are stubbed:
//   0x319d -> a stub that just `ret`s (pops the pushed return address, charges 0
//             test T-states) so the routine's OWN cycle count is isolated and the
//             pushed return addresses (0x3143, 0x317d) are observable.
//   0x3748 -> the tail-jump target: recorded, but NOT run/ret'd, so the exit
//             pc/sp/stack-top are frozen at the moment of delegation.
//
// Covers all four control-flow exits (skip when 0x8010<8; stop-after-object-1
// when 0x8001==4 && 0x8010<0x0a; process both via the jr-nz branch; process both
// via the fall-through into loc_316f), the T-state total of each, both sprite
// records, the object round-trips, and the exact call sequence. The MUTATION
// replaces the final tail-jump `jp 0x3748` with a `ret` -- the classic
// tail-jump-vs-ret confusion, a SAME-CYCLE control-flow break (jp and ret are
// both 10 T) that returns to the wrong place; the spec must reject it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_312d } from "../loc_312d.js";

const BIAS = 0x10; // (0x8051)
const SENTINEL = 0xbeef; // the caller's return address; a tail-jump must preserve it on top

// Object records: [0..2] are copied verbatim into the sprite record, [3] is
// biased by BIAS; [4..16] are carried through the scratch round-trip untouched.
const OBJ1 = Array.from({ length: 17 }, (_, i) => (i < 4 ? [0xaa, 0xbb, 0xcc, 0x40][i] : 0xd0 + i));
const OBJ2 = Array.from({ length: 17 }, (_, i) => (i < 4 ? [0x11, 0x22, 0x33, 0x44][i] : 0xe0 + i));

const EXP_SPR1 = [0xaa, 0xbb, 0xcc, (0x40 + BIAS) & 0xff]; // 0x8230..0x8233 -> [aa,bb,cc,50]
const EXP_SPR2 = [0x11, 0x22, 0x33, (0x44 + BIAS) & 0xff]; // 0x8234..0x8237 -> [11,22,33,54]

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
    // Callee stubs. 0x319d returns (pops its pushed return addr, 0 test cycles);
    // 0x3748 is the tail target and is only recorded (no ret) so exit state freezes.
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
    // Record target + the return address sitting on top of the stack at the
    // moment of transfer: for a real CALL that is the just-pushed addr; for a
    // tail-jump it is the caller's own return (SENTINEL), left intact.
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
  const sp0 = m.regs.sp; // == 0x877e; a tail-jump exit must leave SP here
  fn(m);
  return {
    cycles: m.cycles,
    spr1: [0, 1, 2, 3].map((i) => m.mem.read8(0x8230 + i)),
    spr2: [0, 1, 2, 3].map((i) => m.mem.read8(0x8234 + i)),
    obj1: [0, 1, 2, 3].map((i) => m.mem.read8(0x80e8 + i)), // must survive the round-trip
    obj2: [0, 1, 2, 3].map((i) => m.mem.read8(0x80f9 + i)),
    pc: m.pc,
    sp: m.regs.sp,
    sp0,
    a: m.regs.a,
    b: m.regs.b,
    hl: m.regs.hl,
    de: m.regs.de,
    bc: m.regs.bc,
    calls: m.calls,
  };
}

// ---- both objects processed via the jr-nz branch (0x8010>=8, 0x8001!=4) ------
function checkBoth(res) {
  assert.equal(res.cycles, 1880, "T-state total (both objects)");
  assert.deepEqual(res.spr1, EXP_SPR1, "sprite record 1: 3 bytes + biased 4th");
  assert.deepEqual(res.spr2, EXP_SPR2, "sprite record 2: 3 bytes + biased 4th");
  assert.deepEqual(res.obj1, OBJ1.slice(0, 4), "object 1 record restored by round-trip");
  assert.deepEqual(res.obj2, OBJ2.slice(0, 4), "object 2 record restored by round-trip");
  assert.equal(res.pc, 0x3748, "tail-jumped INTO 0x3748 (not returned)");
  assert.equal(res.sp, res.sp0, "SP balanced at the tail-jump (SENTINEL still on top)");
  assert.equal(res.a, EXP_SPR2[3], "A = last biased sum (0x54)");
  assert.equal(res.b, BIAS, "B = bias on exit");
  assert.equal(res.hl, 0x80fc, "HL past object 2's copied triple");
  assert.equal(res.de, 0x8237, "DE at sprite2[3]");
  // C = 0 (final ldir drained it); B = bias (the trailing `ld b,a`), so BC = bias<<8.
  assert.equal(res.bc, BIAS << 8, "C = 0 after the final ldir, B = bias");
  // exact call sequence: two real CALLs to 0x319d (returns 0x3143, 0x317d) then
  // the tail-jump to 0x3748 with the caller's own return (SENTINEL) on top.
  assert.equal(res.calls.length, 3, "two 0x319d calls + the 0x3748 tail-jump");
  assert.deepEqual(
    res.calls.map((c) => c.addr),
    [0x319d, 0x319d, 0x3748],
    "call targets in order",
  );
  assert.equal(res.calls[0].retTop, 0x3143, "object-1 CALL 0x319d returns to 0x3143");
  assert.equal(res.calls[1].retTop, 0x317d, "object-2 CALL 0x319d returns to 0x317d");
  assert.equal(res.calls[2].retTop, SENTINEL, "tail-jump keeps the caller's return on top");
}

test("loc_312d: both objects via jr-nz branch, 1880 T", () => {
  checkBoth(run(loc_312d, 0x10, 0x00));
});

test("loc_312d: both objects via fall-through into loc_316f (0x8001==4, 0x8010>=0x0a), 1905 T", () => {
  const res = run(loc_312d, 0x10, 0x04);
  assert.equal(res.cycles, 1905, "T-state total (fall-through path is +25 vs jr-nz)");
  assert.deepEqual(res.spr1, EXP_SPR1, "sprite record 1");
  assert.deepEqual(res.spr2, EXP_SPR2, "sprite record 2 still built via fall-through");
  assert.equal(res.pc, 0x3748, "tail-jumped into 0x3748");
  assert.equal(res.sp, res.sp0, "SP balanced");
  assert.deepEqual(res.calls.map((c) => c.addr), [0x319d, 0x319d, 0x3748], "both objects run");
});

test("loc_312d: skip everything when 0x8010 < 8 (30 T, straight to 0x3748)", () => {
  const res = run(loc_312d, 0x05, 0x00);
  assert.equal(res.cycles, 30, "T-state total (guard only)");
  assert.deepEqual(res.spr1, [0, 0, 0, 0], "no sprite record 1 written");
  assert.deepEqual(res.spr2, [0, 0, 0, 0], "no sprite record 2 written");
  assert.equal(res.pc, 0x3748, "tail-jumped into 0x3748");
  assert.equal(res.sp, res.sp0, "SP untouched (SENTINEL on top)");
  assert.deepEqual(res.calls.map((c) => c.addr), [0x3748], "only the tail-jump, no 0x319d");
});

test("loc_312d: stop after object 1 when 0x8001==4 && 0x8010<0x0a (991 T)", () => {
  const res = run(loc_312d, 0x09, 0x04);
  assert.equal(res.cycles, 991, "T-state total (object 1 only)");
  assert.deepEqual(res.spr1, EXP_SPR1, "sprite record 1 built");
  assert.deepEqual(res.spr2, [0, 0, 0, 0], "sprite record 2 NOT built");
  assert.equal(res.pc, 0x3748, "tail-jumped into 0x3748");
  assert.equal(res.sp, res.sp0, "SP balanced");
  assert.deepEqual(res.calls.map((c) => c.addr), [0x319d, 0x3748], "one 0x319d call + tail-jump");
});

// -- MUTATION: model the final `jp 0x3748` (0x319a) as a `ret` instead of a
// tail-jump delegation. This is the exact trap doc 03 warns about: a jp that
// discards the current frame must be `return m.call(target)`, NOT m.ret(). The
// mutant pops SENTINEL and "returns" to the caller directly, skipping 0x3748 --
// wrong control flow at the IDENTICAL 1880 T (jp and ret are both 10 T). Only a
// full copy up to the last instruction changes; everything before 0x319a is the
// real routine's logic so the mutant still builds both records correctly.
function loc_312d_mutant(m) {
  const { regs, mem } = m;
  function loc_316f() {
    regs.hl = 0x80f9; m.step(0x3172, 10);
    regs.de = 0x8083; m.step(0x3175, 10);
    regs.bc = 0x0011; m.step(0x3178, 10);
    m.ldirAt(0x3178, 0x317a);
    m.push16(0x317d); m.step(0x319d, 17); m.call(0x319d);
    regs.hl = 0x8083; m.step(0x3180, 10);
    regs.de = 0x80f9; m.step(0x3183, 10);
    regs.bc = 0x0011; m.step(0x3186, 10);
    m.ldirAt(0x3186, 0x3188);
    regs.de = 0x8234; m.step(0x318b, 10);
    regs.hl = 0x80f9; m.step(0x318e, 10);
    regs.bc = 0x0003; m.step(0x3191, 10);
    m.ldirAt(0x3191, 0x3193);
    regs.a = mem.read8(0x8051); m.step(0x3196, 13);
    regs.b = regs.a; m.step(0x3197, 4);
    regs.a = mem.read8(regs.hl); m.step(0x3198, 7);
    regs.add(regs.b); m.step(0x3199, 4);
    mem.write8(regs.de, regs.a); m.step(0x319a, 7);
    m.ret(); // BUG: `jp 0x3748` modelled as a plain ret -- pops SENTINEL, skips 0x3748
    return;
  }
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
  if (regs.fNZ) { m.step(0x316f, 12); return loc_316f(); }
  m.step(0x3167, 7);
  regs.a = mem.read8(0x8010); m.step(0x316a, 13);
  regs.cp(0x0a); m.step(0x316c, 7);
  if (regs.fC) { m.step(0x3748, 10); return m.call(0x3748); }
  m.step(0x316f, 10);
  return loc_316f();
}

test("mutation (final tail-jump modelled as ret) is caught by the spec", () => {
  const bad = run(loc_312d_mutant, 0x10, 0x00);
  // Sanity: the mutant builds the SAME records at the SAME cycle count -- the
  // break is control-flow only.
  assert.equal(bad.cycles, 1880, "mutant mischarges nothing -- same T total");
  assert.deepEqual(bad.spr1, EXP_SPR1, "mutant still builds record 1");
  assert.deepEqual(bad.spr2, EXP_SPR2, "mutant still builds record 2");
  // ...but it returned to the caller instead of tail-jumping into 0x3748.
  assert.equal(bad.pc, SENTINEL, "mutant returned to the caller directly");
  assert.notEqual(bad.pc, 0x3748, "mutant never reached 0x3748");
  // The spec the real routine passes must REJECT the mutant.
  assert.throws(() => checkBoth(bad));
});
