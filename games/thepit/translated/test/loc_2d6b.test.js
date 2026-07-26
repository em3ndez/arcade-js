// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_2d6b (ROM 0x2d6b-0x2da8), The Pit.
//
// loc_2d6b is the countdown-expiry "stamp + reset" path reached from loc_2cb7's
// `jp z,0x2d6b`. It reads the object pointer word at (0x806e) into both IX and HL:
//   - IX -> five fixed tile codes at scattered offsets:
//       (ix+0x3f)=0x23 (ix+0x1f)=0x18 (ix-0x01)=0x17 (ix-0x21)=0x14 (ix-0x41)=0x3e
//   - HL = ptr + 0xf800 + 0xffbf (= ptr - 0x0841) -> a 5-pass djnz loop writing
//       colour 0x06 at stride 0x20.
// Then (0x8078)=0x00, (0x807c)=0xb4, and `jp 0x2f71` (a TAIL-JUMP: nothing pushed,
// so its stub pops the SENTINEL and the T-state total stays loc_2d6b's OWN cost).
//
// Fixture pointer BASE = 0x9100 places the tile writes in video RAM (0x90bf-0x913f)
// and the colour column at ptr-0x0841 = 0x88bf..0x893f in colour RAM -- all mapped.
//
// T-states (single linear path, loop runs 5x):
//   pre-loop 232 + loop (5*(7+11) + djnz 4*13+1*8 = 150) + post 50 = 432.
//
// One full-path spec plus a deliberate MUTATION (loop count `ld b,0x05` -> 0x04)
// that the spec must catch (fewer colour cells + fewer T-states).

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_2d6b } from "../loc_2d6b.js";

const PTR = 0x806e; // pointer word source (IX and HL both loaded from it)
const BASE = 0x9100; // fixture pointer value -> all effective addresses mapped
const TAIL = 0x2f71; // tail-jump target (shared tail)
const SENTINEL = 0xbeef; // caller return address the tail-callee's ret lands on
const SP0 = 0x8780; // SP inside work RAM so pushes/pops are mapped

// The five (ix+d) tile writes: [effective address, value].
const TILES = [
  [(BASE + 0x3f) & 0xffff, 0x23],
  [(BASE + 0x1f) & 0xffff, 0x18],
  [(BASE - 0x01) & 0xffff, 0x17],
  [(BASE - 0x21) & 0xffff, 0x14],
  [(BASE - 0x41) & 0xffff, 0x3e],
];
// Colour column base = ptr + 0xf800 + 0xffbf, then five cells at stride 0x20.
const COL_BASE = (BASE + 0xf800 + 0xffbf) & 0xffff; // = 0x88bf
const COL_CELLS = [0, 1, 2, 3, 4].map((i) => (COL_BASE + i * 0x20) & 0xffff);

function buildRom() {
  return new Uint8Array(0x5000); // AddressSpace requires a 20480-byte ROM; contents unused
}

// Minimal machine: real mem/io/regs + the step/call/push16 seam. The call stub records
// the target and models a bare `ret` (pop -> pc). loc_2d6b makes no register-returning calls.
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x2d6b;
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

function setup() {
  const m = new TestMachine(buildRom());
  m.mem.write16(PTR, BASE); // the object pointer word
  m.push16(SENTINEL); // the caller's return address
  return m;
}

function snapshot(m) {
  return {
    cycles: m.cycles,
    calls: m.calls,
    pc: m.pc,
    sp: m.regs.sp,
    ix: m.regs.ix,
    tiles: TILES.map(([addr]) => m.mem.read8(addr)),
    col: COL_CELLS.map((addr) => m.mem.read8(addr)),
    s8078: m.mem.read8(0x8078),
    s807c: m.mem.read8(0x807c),
  };
}

// The complete expected effect of a correct run.
function specComplete(r) {
  assert.equal(r.cycles, 432, "linear path is 432 T (232 + loop 150 + post 50)");
  assert.equal(r.ix, BASE, "IX loaded from (0x806e)");
  assert.deepEqual(
    r.tiles,
    TILES.map(([, v]) => v),
    "five tile codes stamped at the (ix+d) offsets",
  );
  assert.deepEqual(r.col, [0x06, 0x06, 0x06, 0x06, 0x06], "five colour cells = 0x06 at stride 0x20");
  assert.equal(r.s8078, 0x00, "(0x8078) reset to 0");
  assert.equal(r.s807c, 0xb4, "(0x807c) reset to 0xb4");
  assert.deepEqual(r.calls, [TAIL], "tail-jumps to 0x2f71");
  assert.equal(r.pc, SENTINEL, "0x2f71's ret returns to loc_2d6b's caller");
  assert.equal(r.sp, SP0, "stack balanced");
}

test("loc_2d6b: stamps 5 tiles + 5 colour cells, resets state, tail-jumps to 0x2f71, 432 T", () => {
  const m = setup();
  loc_2d6b(m);
  specComplete(snapshot(m));
});

test("loc_2d6b: colour column base = pointer - 0x0841 (0x88bf for BASE 0x9100)", () => {
  assert.equal(COL_BASE, 0x88bf, "ptr + 0xf800 + 0xffbf wraps to ptr - 0x0841");
});

// ============================================================================
// MUTATION: loop count `ld b,0x05` (0x2d98) flipped to `ld b,0x04`. The mutant
// paints only 4 colour cells (the 5th, 0x893f, stays 0) and spends one fewer
// djnz iteration (150 -> 119 T, total 401). specComplete rejects it on BOTH the
// colour-column contents and the cycle total.
// ============================================================================
function loc_2d6b_mutant(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  regs.ix = mem.read16(0x806e); m.step(0x2d6f, 20);
  regs.a = 0x23; m.step(0x2d71, 7);
  mem.write8(R(0x3f), regs.a); m.step(0x2d74, 19);
  regs.a = 0x18; m.step(0x2d76, 7);
  mem.write8(R(0x1f), regs.a); m.step(0x2d79, 19);
  regs.a = 0x17; m.step(0x2d7b, 7);
  mem.write8(R(-0x01), regs.a); m.step(0x2d7e, 19);
  regs.a = 0x14; m.step(0x2d80, 7);
  mem.write8(R(-0x21), regs.a); m.step(0x2d83, 19);
  regs.a = 0x3e; m.step(0x2d85, 7);
  mem.write8(R(-0x41), regs.a); m.step(0x2d88, 19);
  regs.hl = mem.read16(0x806e); m.step(0x2d8b, 16);
  regs.bc = 0xf800; m.step(0x2d8e, 10);
  regs.de = 0xffbf; m.step(0x2d91, 10);
  regs.addHl(regs.bc); m.step(0x2d92, 11);
  regs.addHl(regs.de); m.step(0x2d93, 11);
  regs.de = 0x0020; m.step(0x2d96, 10);
  regs.a = 0x06; m.step(0x2d98, 7);
  regs.b = 0x04; m.step(0x2d9a, 7); // BUG: real count is 0x05
  for (;;) {
    mem.write8(regs.hl, regs.a); m.step(0x2d9b, 7);
    regs.addHl(regs.de); m.step(0x2d9c, 11);
    if (regs.djnz() !== 0) { m.step(0x2d9a, 13); continue; }
    m.step(0x2d9e, 8); break;
  }
  regs.a = 0x00; m.step(0x2da0, 7);
  mem.write8(0x8078, regs.a); m.step(0x2da3, 13);
  regs.a = 0xb4; m.step(0x2da5, 7);
  mem.write8(0x807c, regs.a); m.step(0x2da8, 13);
  m.step(0x2f71, 10); return m.call(0x2f71);
}

test("mutation (ld b,0x05 -> 0x04) is caught by the completeness spec", () => {
  const m = setup();
  loc_2d6b_mutant(m);
  const bad = snapshot(m);
  assert.equal(bad.col[4], 0x00, "mutant leaves the 5th colour cell unpainted");
  assert.equal(bad.cycles, 401, "mutant spends one fewer djnz iteration");
  assert.throws(() => specComplete(bad), "the completeness spec rejects the short-loop mutant");
});
