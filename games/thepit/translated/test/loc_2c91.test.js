// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_2c91 (ROM 0x2c91-0x2cb6), The Pit.
//
// loc_2c91 is the shared overlap-record tail: it tests whether the just-placed cell
// (target bytes 0x80a9/0x80ac) overlaps the tracked object at 0x8068/0x806b, publishes
// the 0/1 result to the per-tick flag 0x8080, then tail-jumps to 0x2bd3.
//
// d = 1 (overlap) iff BOTH axes hit:
//   row band: (0x80ac)+0x0c == (0x806b)
//   X window: (0x80a9) < (0x8068) <= (0x80a9)+0x08
// otherwise d = 0.
//
// The three internal `jr` guards all target 0x2cb0 (still inside the routine); the final
// `jp 0x2bd3` is a TAIL-JUMP that pushed nothing, so its stub pops the SENTINEL and the
// T-state total stays loc_2c91's OWN cost. loc_2c91 makes no register-returning calls.
//
// Four path specs -- Y mismatch (jr nz), X guard-1 miss (jr nc), X guard-2 miss (jr c),
// and the full overlap (all guards fall through) -- plus a deliberate mutation (the final
// `jr c,0x2cb0` at 0x2cac flipped to `jr nc`) that the overlap spec must catch.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_2c91 } from "../loc_2c91.js";

const TAIL = 0x2bd3; // tail-jump target (record builder)
const SENTINEL = 0xbeef; // caller return address the tail-callee's ret lands on
const SP0 = 0x8780; // SP inside work RAM so pushes/pops are mapped

function buildRom() {
  return new Uint8Array(0x5000); // AddressSpace requires a 20480-byte ROM; contents unused
}

// Minimal machine: real mem/io/regs + the step/call/push16 seam. The call stub records the
// target and models a bare `ret` (pop -> pc). loc_2c91 has no register-returning calls.
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x2c91;
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
  call(addr) {
    this.calls.push(addr);
    this.pc = this.pop16(); // bare ret: pop the caller's return address
    return undefined;
  }
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }
}

function run(mem = {}) {
  const m = new TestMachine(buildRom());
  for (const [addr, val] of Object.entries(mem)) m.mem.write8(Number(addr), val);
  m.push16(SENTINEL); // the caller's return address
  loc_2c91(m);
  return {
    cycles: m.cycles,
    calls: m.calls,
    pc: m.pc,
    sp: m.regs.sp,
    flag8080: m.mem.read8(0x8080),
  };
}

// ============================================================================
// SPEC 1: row band mismatch -> jr nz at 0x2c9d TAKEN -> d stays 0.
//   0x80ac=0x20 -> +0x0c=0x2c; 0x806b=0x10 (!=): band differs.
//   head-to-cp b = 7+13+4+13+7+4 = 48; +12(jr nz TAKEN); loc_2cb0 = 4+13+10 = 27 -> 87
// ============================================================================
test("loc_2c91: row-band mismatch -> jr nz, d=0, 0x8080=0, 87 T", () => {
  const r = run({ 0x80ac: 0x20, 0x806b: 0x10 });
  assert.equal(r.cycles, 87, "band-mismatch path is 87 T");
  assert.equal(r.flag8080, 0x00, "no overlap -> 0x8080 = 0");
  assert.deepEqual(r.calls, [TAIL], "tail-jumps to 0x2bd3");
  assert.equal(r.pc, SENTINEL, "0x2bd3's ret returns to loc_2c91's caller");
  assert.equal(r.sp, SP0, "stack balanced");
});

// ============================================================================
// SPEC 2: band hits, first X guard misses -> jr nc at 0x2ca7 TAKEN -> d stays 0.
//   band pass (0x80ac=0x20->0x2c == 0x806b=0x2c). 0x80a9=0x40 >= 0x8068=0x10 -> jr nc.
//   48 +7(jr nz nt) +13+4+13+4(2c9f..cp c) +12(jr nc TAKEN) +27 = 128
// ============================================================================
test("loc_2c91: X guard-1 miss (0x80a9 >= 0x8068) -> jr nc, d=0, 128 T", () => {
  const r = run({ 0x80ac: 0x20, 0x806b: 0x2c, 0x80a9: 0x40, 0x8068: 0x10 });
  assert.equal(r.cycles, 128, "X guard-1 miss path is 128 T");
  assert.equal(r.flag8080, 0x00, "no overlap -> 0x8080 = 0");
  assert.deepEqual(r.calls, [TAIL], "tail-jumps to 0x2bd3");
});

// ============================================================================
// SPEC 3: band + guard-1 pass, second X guard misses -> jr c at 0x2cac TAKEN -> d=0.
//   band pass; 0x80a9=0x40 < 0x8068=0x50 (guard-1 falls through); +0x08=0x48 < 0x50 -> jr c.
//   128-shape but jr nc falls through(7): 48+7 +34 +7(jr nc nt) +7+4(add/cp) +12(jr c TAKEN) +27 = 146
// ============================================================================
test("loc_2c91: X guard-2 miss (0x80a9+8 < 0x8068) -> jr c, d=0, 146 T", () => {
  const r = run({ 0x80ac: 0x20, 0x806b: 0x2c, 0x80a9: 0x40, 0x8068: 0x50 });
  assert.equal(r.cycles, 146, "X guard-2 miss path is 146 T");
  assert.equal(r.flag8080, 0x00, "no overlap -> 0x8080 = 0");
  assert.deepEqual(r.calls, [TAIL], "tail-jumps to 0x2bd3");
});

// ============================================================================
// SPEC 4: FULL OVERLAP -- band hits and 0x80a9 < 0x8068 <= 0x80a9+8 -> all guards fall
//   through, ld d,0x01, 0x8080 = 1.
//   band pass; 0x80a9=0x40 < 0x8068=0x44 (guard-1 nt); +0x08=0x48 >= 0x44 (guard-2 nt).
//   48+7 +34 +7 +7+4 +7(jr c nt) +7(ld d,1) +27 = 148
// ============================================================================
const OVERLAP_FIXTURE = { 0x80ac: 0x20, 0x806b: 0x2c, 0x80a9: 0x40, 0x8068: 0x44 };
function specOverlap(r) {
  assert.equal(r.cycles, 148, "full-overlap path is 148 T");
  assert.equal(r.flag8080, 0x01, "overlap -> 0x8080 = 1");
  assert.deepEqual(r.calls, [TAIL], "tail-jumps to 0x2bd3");
  assert.equal(r.pc, SENTINEL, "0x2bd3's ret returns to loc_2c91's caller");
  assert.equal(r.sp, SP0, "stack balanced");
}
test("loc_2c91: full overlap -> d=1, 0x8080=1, 148 T", () => {
  specOverlap(run(OVERLAP_FIXTURE));
});

// ============================================================================
// MUTATION: flip the final X guard `jr c,0x2cb0` (0x2cac) to `jr nc`. On the overlap
// fixture, C is CLEAR at 0x2cac (0x48 >= 0x44 = c), so the real routine falls through and
// sets d=1; the mutant with `jr nc` instead TAKES the branch to loc_2cb0 with d still 0 --
// no overlap flag. specOverlap rejects it (0x8080 and cycles both differ: 128 vs 148).
// ============================================================================
function loc_2c91_mutant(m) {
  const { regs, mem } = m;
  regs.d = 0x00; m.step(0x2c93, 7);
  regs.a = mem.read8(0x806b); m.step(0x2c96, 13);
  regs.b = regs.a; m.step(0x2c97, 4);
  regs.a = mem.read8(0x80ac); m.step(0x2c9a, 13);
  regs.add(0x0c); m.step(0x2c9c, 7);
  regs.cp(regs.b); m.step(0x2c9d, 4);
  if (regs.fNZ) {
    m.step(0x2cb0, 12);
  } else {
    m.step(0x2c9f, 7);
    regs.a = mem.read8(0x8068); m.step(0x2ca2, 13);
    regs.c = regs.a; m.step(0x2ca3, 4);
    regs.a = mem.read8(0x80a9); m.step(0x2ca6, 13);
    regs.cp(regs.c); m.step(0x2ca7, 4);
    if (regs.fNC) {
      m.step(0x2cb0, 12);
    } else {
      m.step(0x2ca9, 7);
      regs.add(0x08); m.step(0x2cab, 7);
      regs.cp(regs.c); m.step(0x2cac, 4);
      if (regs.fNC) { // BUG: real is `jr c` (branch on carry SET)
        m.step(0x2cb0, 12);
      } else {
        m.step(0x2cae, 7);
        regs.d = 0x01; m.step(0x2cb0, 7);
      }
    }
  }
  regs.a = regs.d; m.step(0x2cb1, 4);
  mem.write8(0x8080, regs.a); m.step(0x2cb4, 13);
  m.step(0x2bd3, 10); return m.call(0x2bd3);
}

test("mutation (jr c -> jr nc at 0x2cac) is caught by the overlap spec", () => {
  const m = new TestMachine(buildRom());
  for (const [addr, val] of Object.entries(OVERLAP_FIXTURE)) m.mem.write8(Number(addr), val);
  m.push16(SENTINEL);
  loc_2c91_mutant(m);
  const bad = {
    cycles: m.cycles,
    calls: m.calls,
    pc: m.pc,
    sp: m.regs.sp,
    flag8080: m.mem.read8(0x8080),
  };
  assert.equal(bad.flag8080, 0x00, "mutant escapes to loc_2cb0 with d=0 (no overlap flag)");
  assert.throws(() => specOverlap(bad), "the overlap spec rejects the flipped-branch mutant");
});
