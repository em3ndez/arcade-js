// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_06ac (ROM 0x06AC-0x0737): the per-frame animator that
// decrements the 0x805C countdown, dispatches on its value (8..1, wrapping
// 0->8) to one of eight fixed screen cells, and for each cell either advances
// its colour attribute mod 8 (when the on-screen tile is that cell's animate
// glyph) or forces the colour to 0x03 / 0x07.
//
// Asserts the T-state total, the memory effects, the flag-driven control flow
// (which cell is written proves which branch was taken), and the register/flag
// residue -- each against the disassembly. Ends with a MUTATION (loc_0732 with
// its `inc a` dropped) proven to be caught.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_06ac } from "../loc_06ac.js";

const RET = 0x1234; // sentinel return address pushed before the call

// Minimal machine: real Regs + real Pit AddressSpace, plus the step/call/ret
// seam loc_06ac drives. It only needs regs, mem, step, ret (no m.call here).
function makeMachine(presets = {}) {
  const io = new Io();
  const mem = new AddressSpace(new Uint8Array(0x5000), io);
  const regs = new Regs();
  regs.sp = 0x8700; // stack inside work RAM (0x8000-0x87FF)

  const m = {
    regs,
    mem,
    tstates: 0,
    pc: 0x06ac,
    returned: false,
    step(addr, cycles) {
      this.pc = addr;
      this.tstates += cycles;
    },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) {
      this.pc = this.pop16();
      this.tstates += cycles;
      this.returned = true;
    },
    call(addr) {
      throw new Error(`unexpected m.call(0x${addr.toString(16).padStart(4, "0")})`);
    },
  };

  for (const [addr, val] of Object.entries(presets)) {
    mem.write8(Number(addr), val);
  }
  m.push16(RET); // the return address loc_06ac's `ret` must pop
  return m;
}

// ---- the golden facts, straight off the disassembly --------------------------
// counter (post-dec value, before any wrap) -> { cell, glyph, colour }
//   cell   = colour-RAM byte written / cycled
//   video  = video-RAM byte the tile is read from
//   glyph  = the "animate" tile value that triggers loc_0732
//   fixed  = colour forced when the tile is NOT the glyph (0x03=B, 0x07=C)
const CASES = {
  4: { cell: 0x89fd, video: 0x91fd, glyph: 0x3c, fixed: 0x03 }, // loc_06c3
  7: { cell: 0x8873, video: 0x9073, glyph: 0x3a, fixed: 0x07 }, // loc_06d0
  6: { cell: 0x895d, video: 0x915d, glyph: 0x3b, fixed: 0x03 }, // loc_06e1
  5: { cell: 0x88d9, video: 0x90d9, glyph: 0x3a, fixed: 0x07 }, // loc_06f2
  3: { cell: 0x89b6, video: 0x91b6, glyph: 0x3a, fixed: 0x07 }, // loc_0703
  2: { cell: 0x8a7d, video: 0x927d, glyph: 0x3d, fixed: 0x03 }, // loc_0714
  1: { cell: 0x8b3a, video: 0x933a, glyph: 0x3a, fixed: 0x07 }, // loc_0725
};

test("counter 5 -> cell 4, tile mismatch: forces colour to B (0x03)", () => {
  const m = makeMachine({ 0x805c: 5 });
  loc_06ac(m);

  assert.equal(m.mem.read8(0x805c), 4, "counter decremented 5->4");
  assert.equal(m.mem.read8(0x89fd), 0x03, "cell colour forced to B");
  // control flow: the ret landed back at the caller
  assert.equal(m.returned, true);
  assert.equal(m.pc, RET);
  // key register residue: B/C loaded at the top, never touched again
  assert.equal(m.regs.b, 0x03);
  assert.equal(m.regs.c, 0x07);
  // flag residue from the final `cp 0x3c` (a=0 vs 0x3c): borrow -> C & S set, NZ
  assert.equal(m.regs.fC, true, "carry from the tile compare");
  assert.equal(m.regs.fZ, false);
  assert.equal(m.regs.fM, true, "sign from the tile compare");
  // T-states: head(63) + loc_06c3 write path(58)
  assert.equal(m.tstates, 121);
});

test("counter 5 -> cell 4, tile matches glyph: colour-cycles (loc_0732)", () => {
  const m = makeMachine({ 0x805c: 5, 0x91fd: 0x3c, 0x89fd: 0x00 });
  loc_06ac(m);

  assert.equal(m.mem.read8(0x805c), 4);
  assert.equal(m.mem.read8(0x89fd), 0x01, "colour advanced 0 -> 1 mod 8");
  assert.equal(m.returned, true);
  assert.equal(m.pc, RET);
  // T-states: head(63) + loc_06c3-to-jr(46) + loc_0732(35)
  assert.equal(m.tstates, 144);
});

test("counter 8 -> cell 7 (loc_06d0), tile mismatch forces colour to C", () => {
  const m = makeMachine({ 0x805c: 8 });
  loc_06ac(m);

  assert.equal(m.mem.read8(0x805c), 7);
  assert.equal(m.mem.read8(0x8873), 0x07);
  assert.equal(m.returned, true);
  // head to jr-nz-taken(74) + loc_06d0 write path(72)
  assert.equal(m.tstates, 146);
});

test("counter 2 -> a=1: full cascade to the default cell (loc_0725)", () => {
  const m = makeMachine({ 0x805c: 2 });
  loc_06ac(m);

  assert.equal(m.mem.read8(0x805c), 1);
  assert.equal(m.mem.read8(0x8b3a), 0x07, "default cell colour forced to C");
  assert.equal(m.returned, true);
  // head(74) + five cp/jr-nz-taken hops (19*5) + loc_0725 write path(58)
  assert.equal(m.tstates, 74 + 19 * 5 + 58);
});

test("counter 3 -> a=2 (loc_0714), tile matches 0x3d: colour cycles 6 -> 7", () => {
  const m = makeMachine({ 0x805c: 3, 0x927d: 0x3d, 0x8a7d: 0x06 });
  loc_06ac(m);

  assert.equal(m.mem.read8(0x805c), 2);
  assert.equal(m.mem.read8(0x8a7d), 0x07, "colour advanced 6 -> 7 mod 8");
  assert.equal(m.returned, true);
  // head(74) + four hops(19*4) + loc_0714-to-jr(60) + loc_0732(35)
  assert.equal(m.tstates, 74 + 19 * 4 + 60 + 35);
});

test("counter 1 -> 0 wraps the countdown back to 8, then runs cell 4", () => {
  const m = makeMachine({ 0x805c: 1 });
  loc_06ac(m);

  assert.equal(m.mem.read8(0x805c), 8, "0 wrapped back to 8 (loc via `and a` == 0)");
  assert.equal(m.mem.read8(0x89fd), 0x03, "then cell 4 forced to B");
  assert.equal(m.returned, true);
  // head-with-reset(89) + loc_06c3 write path(58)
  assert.equal(m.tstates, 147);
});

// A single point-check over every dispatch arm at once: for each counter value
// present the cell's animate glyph and confirm exactly that cell colour-cycles
// (0x02 -> 0x03) and nothing else does. This is the flag-driven dispatch table
// verified end to end.
test("each counter value routes to its own cell (dispatch table)", () => {
  for (const [counterStr, c] of Object.entries(CASES)) {
    const counter = Number(counterStr);
    // pre-dec counter so the post-dec value is `counter`; wrap 0..8 stays in range
    const start = counter + 1;
    const m = makeMachine({ 0x805c: start, [c.video]: c.glyph, [c.cell]: 0x02 });
    loc_06ac(m);
    assert.equal(m.mem.read8(0x805c), counter, `counter ${start}->${counter}`);
    assert.equal(m.mem.read8(c.cell), 0x03, `cell 0x${c.cell.toString(16)} cycled`);
    assert.equal(m.returned, true);
  }
});

// ---- MUTATION: loc_0732 with its `inc a` (and 4 T-states) dropped ------------
// A faithful reproduction of the counter-5 match path (head -> loc_06c3 ->
// loc_0732) but with the increment removed. The correct routine leaves colour
// 0 -> 1 and spends 144 T; the mutant leaves colour 0 and spends 140 T. Both
// the memory and the T-state assertions must reject it.
function loc_06ac_mut(m) {
  const { regs, mem } = m;
  regs.b = 0x03; m.step(0x06ae, 7);
  regs.c = 0x07; m.step(0x06b0, 7);
  regs.a = mem.read8(0x805c); m.step(0x06b3, 13);
  regs.a = regs.dec8(regs.a); m.step(0x06b4, 4);
  mem.write8(0x805c, regs.a); m.step(0x06b7, 13);
  regs.cp(0x04); m.step(0x06b9, 7);
  m.step(0x06c3, 12); // jr z taken (counter==4)
  regs.hl = 0x89fd; m.step(0x06c6, 10);
  regs.de = 0x91fd; m.step(0x06c9, 10);
  regs.a = mem.read8(regs.de); m.step(0x06ca, 7);
  regs.cp(0x3c); m.step(0x06cc, 7);
  m.step(0x0732, 12); // jr z taken (tile matches)
  regs.a = mem.read8(regs.hl); m.step(0x0733, 7);
  // BUG: `inc a` (regs.inc8) and its 4 T-states omitted here.
  regs.and(0x07); m.step(0x0736, 7);
  mem.write8(regs.hl, regs.a); m.step(0x0737, 7);
  m.ret();
}

function assertMatchPath(fn) {
  const m = makeMachine({ 0x805c: 5, 0x91fd: 0x3c, 0x89fd: 0x00 });
  fn(m);
  assert.equal(m.mem.read8(0x89fd), 0x01, "colour must advance 0 -> 1");
  assert.equal(m.tstates, 144, "match path must cost 144 T");
}

test("the assertions have teeth: the mutation is caught", () => {
  assertMatchPath(loc_06ac); // the real routine passes it
  assert.throws(() => assertMatchPath(loc_06ac_mut), /colour must advance|144 T/);
});
