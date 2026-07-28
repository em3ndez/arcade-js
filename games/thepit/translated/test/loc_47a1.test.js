// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_47a1 (ROM 0x47A1-0x47E0), The Pit.
//
// Runs the routine on a lightweight machine built from the REAL thepit address
// space (boards/thepit/memory.js) + Io + the shared Z80 Regs, over a seeded stub
// ROM (the copyrighted image is never committed). The one callee (0x3e1d) is
// stubbed as a bare "pop-and-return": it balances the stack, adds NO cycles and
// touches NO registers, so the asserted T-state total and register values are
// loc_47a1's OWN cost/effect. The stub records {addr, a, c, ix} at entry, which
// pins the pre-call setup (c=0x02, a=0x1f) — the routine's control-flow effect.
//
// Source strip lives in WORK RAM at 0x8282 (IX base), seeded with a distinct,
// order-sensitive pattern so a wrong copy direction / stride cannot hide.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_47a1 } from "../loc_47a1.js";

const SENTINEL = 0xbeef; // the caller's return address; the final `ret` lands here
const SP0 = 0x8780; // initial SP (inside work RAM so pushes are mapped)

const SRC = 0x8282; // IX base — the work-RAM source strip
const N = 0x1c; // 28 bytes copied
const srcByte = (i) => (i * 7 + 0x11) & 0xff; // distinct, order-sensitive

// -- T-state accounting (own instruction cost; the stubbed callee adds 0) -----
// Prologue 47a1-47ac.
const PROLOGUE = 14 + 10 + 10 + 7; // 41
// Loop body (47ad-47b3) x28; djnz (47b4) taken 27x@13, not taken 1x@8.
const BODY = 19 + 7 + 10 + 11; // 47
const LOOP = N * BODY + (N - 1) * 13 + 8; // 1675
// ld c / ld a / call (stub 0 T).
const PRECALL = 7 + 7 + 17; // 31
// ld hl / ld de / ld bc.
const SETUP = 10 + 10 + 10; // 30
// The trim: 9 `ld (hl),n` @10 + 8 `add hl,rr` @11.
const FILL = 9 * 10 + 8 * 11; // 178
const RET = 10;
const EXP_CYCLES = PROLOGUE + LOOP + PRECALL + SETUP + FILL + RET; // 1965

// -- expected RAM images ------------------------------------------------------
// Loop: 28 bytes UP the video column from 0x93BF, stride -0x20.
function expectVideo() {
  const v = new Uint8Array(0x400);
  for (let i = 0; i < N; i++) {
    v[((0x93bf - i * 0x20) - 0x9000) & 0x3ff] = srcByte(i);
  }
  return v;
}
// Trim: 0x06 down 0x8B9F/0x8B7F/0x8B5F, then hop; 0x04 down 0x8A7F/0x8A5F/0x8A3F,
// then hop; 0x07 down 0x895F/0x893F/0x891F. Built from the exact write cursor so
// the two strides (DE=-0x20, BC=-0xE0) are exercised, not hand-indexed.
const TRIM_ADDRS = [
  [0x8b9f, 0x06], [0x8b7f, 0x06], [0x8b5f, 0x06],
  [0x8a7f, 0x04], [0x8a5f, 0x04], [0x8a3f, 0x04],
  [0x895f, 0x07], [0x893f, 0x07], [0x891f, 0x07],
];
function expectColor() {
  const c = new Uint8Array(0x400);
  for (const [addr, val] of TRIM_ADDRS) c[(addr - 0x8800) & 0x3ff] = val;
  return c;
}
const EXP_VIDEO = expectVideo();
const EXP_COLOR = expectColor();

// -- minimal machine: real mem/io/regs + step/call/push/pop/ret seam ----------
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x47a1;
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
  // Stubbed callee: snapshot the passed-in registers, then behave as a bare
  // `ret` (pop the address the CALL pushed). No cycles, no register mutation.
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

function run(fn) {
  const m = new TestMachine(buildRom());
  for (let i = 0; i < N; i++) m.mem.write8(SRC + i, srcByte(i)); // seed the strip
  m.push16(SENTINEL); // the caller's return address (consumed by the final ret)
  fn(m);
  return {
    cycles: m.cycles,
    calls: m.calls,
    video: m.mem.videoRam.slice(),
    color: m.mem.colorRam.slice(),
    pc: m.pc,
    sp: m.regs.sp,
    a: m.regs.a,
    b: m.regs.b,
    bc: m.regs.bc,
    de: m.regs.de,
    hl: m.regs.hl,
    ix: m.regs.ix,
    fC: m.regs.fC,
  };
}

function checkSpec(res) {
  assert.equal(res.cycles, EXP_CYCLES, "T-state total");

  // -- memory: the video strip + the three colour trim runs -----------------
  assert.deepEqual(res.video, EXP_VIDEO, "video RAM column copy");
  assert.deepEqual(res.color, EXP_COLOR, "colour RAM trim runs");

  // -- control flow: the single call to loc_3e1d, with its setup snapshot ----
  assert.equal(res.calls.length, 1, "exactly one call (0x3e1d)");
  assert.equal(res.calls[0].addr, 0x3e1d, "call target");
  assert.equal(res.calls[0].a, 0x1f, "A=0x1f selects the colour column");
  assert.equal(res.calls[0].c, 0x02, "C=0x02 is the fill byte");
  assert.equal(res.calls[0].ix, 0x829e, "IX = source+0x1C at the call");

  // -- registers / flags / stack --------------------------------------------
  assert.equal(res.ix, 0x829e, "IX advanced past the 28-byte source strip");
  assert.equal(res.hl, 0x891f, "HL = last trim cursor");
  assert.equal(res.de, 0xffe0, "DE = the -0x20 stride");
  assert.equal(res.bc, 0xff20, "BC = the -0xE0 hop stride");
  assert.equal(res.a, 0x1f, "A untouched since ld a,0x1f");
  assert.equal(res.b, 0xff, "B = 0xFF from ld bc,0xff20 (the loop's B=0 is reloaded)");
  assert.equal(res.fC, true, "carry from the final add hl,de (0x893F+0xFFE0)");
  assert.equal(res.pc, SENTINEL, "ret lands on OUR caller");
  assert.equal(res.sp, SP0, "stack balanced");
}

test("loc_47a1: copies the column, calls 0x3e1d, paints 06/04/07 trim; 1965 T", () => {
  checkSpec(run(loc_47a1));
});

// Pin the copy DIRECTION: first write at 0x93BF (tile 0), last at the bottom of
// the column (0x905F, tile 27), so a stride sign-flip cannot hide.
test("loc_47a1: column walked UP (stride -0x20)", () => {
  const res = run(loc_47a1);
  assert.equal(res.video[(0x93bf - 0x9000) & 0x3ff], srcByte(0), "0x93BF gets byte 0");
  assert.equal(res.video[((0x93bf - 27 * 0x20) - 0x9000) & 0x3ff], srcByte(27), "0x905F gets byte 27");
});

// -- MUTATION: the FIRST `add hl,bc` (0x47CE, the -0xE0 column hop) is changed
// to `add hl,de` (-0x20). Both are 11 T, so the T-state total is UNCHANGED and
// the call trace is byte-identical -- ONLY the colour-RAM image and final HL move
// (the 0x04/0x07 runs land in the wrong columns). Proves the memory/register
// assertions earn their keep (docs/translation.md: DE=0xFFE0 vs BC=0xFF20 trap).
function loc_47a1_mutant(m) {
  const { regs, mem } = m;
  regs.ix = 0x8282; m.step(0x47a5, 14);
  regs.hl = 0x93bf; m.step(0x47a8, 10);
  regs.de = 0xffe0; m.step(0x47ab, 10);
  regs.b = 0x1c; m.step(0x47ad, 7);
  for (;;) {
    regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x47b0, 19);
    mem.write8(regs.hl, regs.a); m.step(0x47b1, 7);
    regs.ix = (regs.ix + 1) & 0xffff; m.step(0x47b3, 10);
    regs.addHl(regs.de); m.step(0x47b4, 11);
    if (regs.djnz() !== 0) { m.step(0x47ad, 13); }
    else { m.step(0x47b6, 8); break; }
  }
  regs.c = 0x02; m.step(0x47b8, 7);
  regs.a = 0x1f; m.step(0x47ba, 7);
  m.push16(0x47bd); m.step(0x3e1d, 17); m.call(0x3e1d);
  regs.hl = 0x8b9f; m.step(0x47c0, 10);
  regs.de = 0xffe0; m.step(0x47c3, 10);
  regs.bc = 0xff20; m.step(0x47c6, 10);
  mem.write8(regs.hl, 0x06); m.step(0x47c8, 10);
  regs.addHl(regs.de); m.step(0x47c9, 11);
  mem.write8(regs.hl, 0x06); m.step(0x47cb, 10);
  regs.addHl(regs.de); m.step(0x47cc, 11);
  mem.write8(regs.hl, 0x06); m.step(0x47ce, 10);
  regs.addHl(regs.de); m.step(0x47cf, 11); // BUG: should be add hl,bc (-0xE0)
  mem.write8(regs.hl, 0x04); m.step(0x47d1, 10);
  regs.addHl(regs.de); m.step(0x47d2, 11);
  mem.write8(regs.hl, 0x04); m.step(0x47d4, 10);
  regs.addHl(regs.de); m.step(0x47d5, 11);
  mem.write8(regs.hl, 0x04); m.step(0x47d7, 10);
  regs.addHl(regs.bc); m.step(0x47d8, 11);
  mem.write8(regs.hl, 0x07); m.step(0x47da, 10);
  regs.addHl(regs.de); m.step(0x47db, 11);
  mem.write8(regs.hl, 0x07); m.step(0x47dd, 10);
  regs.addHl(regs.de); m.step(0x47de, 11);
  mem.write8(regs.hl, 0x07); m.step(0x47e0, 10);
  m.ret();
}

test("mutation (first add hl,bc -> add hl,de) is caught by the memory/HL spec", () => {
  const bad = run(loc_47a1_mutant);
  // Same cycles, same call trace -- a cycle-only / control-flow-only diff MISSES it.
  assert.equal(bad.cycles, EXP_CYCLES, "cycles unchanged (both adds are 11 T)");
  assert.equal(bad.calls.length, 1, "call trace identical");
  // The colour image and final HL actually diverge.
  assert.notDeepEqual(bad.color, EXP_COLOR, "mutant painted the trim in the wrong columns");
  assert.equal(bad.hl, 0x89df, "mutant HL walked the wrong way");
  // The spec the real routine passes MUST reject the mutant.
  assert.throws(() => checkSpec(bad));
});
