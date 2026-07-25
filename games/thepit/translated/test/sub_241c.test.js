// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated sub_241c (ROM 0x241c, The Pit).
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags,
 * a flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine) so the
 * routine is exercised in isolation without a ROM image. Asserts T-state totals,
 * memory/register/flag effects, and control flow against the disassembly, plus a
 * deliberate mutation the T-state assertion must catch.
 *
 * Run: node --test games/thepit/translated/test/sub_241c.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { sub_241c } from "../sub_241c.js";

// Minimal machine matching the surface sub_241c uses: regs, mem, step, call, ret,
// push16/pop16. `calls` records every m.call target in order; `tstates` accumulates
// the charged cycles; `pc` tracks the last step target.
function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => {
      ram[a & 0xffff] = v & 0xff;
      ram[(a + 1) & 0xffff] = (v >> 8) & 0xff;
    },
  };
  return {
    regs,
    mem,
    ram,
    calls: [],
    tstates: 0,
    pc: 0x241c,
    step(nextAddr, cycles) {
      this.pc = nextAddr;
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
      this.step(this.pop16(), cycles);
    },
    call(addr) {
      this.calls.push(addr);
      return undefined; // callees are stubbed in this isolated draft harness
    },
  };
}

// Simulate the caller's CALL: seat a return address on the stack so any `ret`
// inside the routine pops a known value.
const CALLER_RET = 0xabcd;
function seatCaller(m) {
  m.regs.sp = 0x8780; // inside work RAM (0x8000-0x87FF)
  m.push16(CALLER_RET);
}

// -- Path A: full step -- timer fires, marker fixup, tile advances, jp 0x23e8 -----
// The golden assertions live in one function so the mutation test can prove they fire.
function assertPathAGolden(m) {
  assert.equal(m.tstates, 256, "Path A T-state total");
  assert.deepEqual(m.calls, [0x4c8b, 0x23e8], "calls: sub_4c8b then tail-jump 0x23e8");
  assert.equal(m.pc, 0x23e8, "PC ends at the tail-jump target 0x23e8");
  assert.equal(m.mem.read8(0x9260), 0x24, "loc_2444 wrote 0x24 to (ix-0x20)");
  assert.equal(m.mem.read8(0x9280), 0x11, "inc a stored back to (ix+0x00)");
  assert.equal(m.regs.a, 0x11, "A = incremented tile id (0x10 -> 0x11)");
}

function runPathA(m) {
  seatCaller(m);
  m.mem.write8(0x8010, 0x0a); // >= 0x0A -> no early `ret c`
  m.mem.write8(0x8067, 0x01); // timer decrements to 0 -> `jr z` proceeds
  m.mem.write16(0x8065, 0x9280); // ix pointer into video RAM
  m.mem.write8(0x9260, 0x00); // (ix-0x20) != 0xAE -> loc_2444 branch
  m.mem.write8(0x9280, 0x10); // (ix+0x00) not a wall/edge tile -> inc & advance
  sub_241c(m);
}

test("sub_241c Path A: timer fires, tile advances, tail-jumps to 0x23e8", () => {
  const m = makeMachine();
  runPathA(m);
  assertPathAGolden(m);
});

// -- Path B: early `ret c` when the phase byte 0x8010 is below 0x0A ----------------
test("sub_241c Path B: (0x8010) < 0x0A -> immediate `ret c`, no work", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8010, 0x05); // 0x05 < 0x0A -> carry set by `cp 0x0a`
  sub_241c(m);

  assert.equal(m.tstates, 31, "ld a,(nn)=13 + cp n=7 + ret c taken=11");
  assert.ok(m.regs.fC, "carry set (0x05 - 0x0A borrows)");
  assert.deepEqual(m.calls, [], "returned before loc_242c -- no sub_4c8b call");
  assert.equal(m.pc, CALLER_RET, "`ret c` popped the caller's return address");
});

// -- Path C: timer still counting down -> decrement, store, `ret nz` --------------
test("sub_241c Path C: (0x8067) != 1 -> decrement, store, `ret nz`", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8010, 0x0a); // no early ret c
  m.mem.write8(0x8067, 0x05); // timer -> 4, non-zero -> ret nz
  sub_241c(m);

  assert.equal(m.tstates, 73, "13+7+5+13+4+7+13+11");
  assert.equal(m.mem.read8(0x8067), 0x04, "timer decremented and stored back");
  assert.deepEqual(m.calls, [], "no step ran -- returned at `ret nz`");
  assert.equal(m.pc, CALLER_RET, "`ret nz` popped the caller's return address");
});

// -- MUTATION: the T-state total must have teeth ----------------------------------
// Mistranslate `ld ix,(0x8065)` (DD 2A, 20 T) as the `ld hl,(nn)` timing (16 T) -- a
// plausible copy error. Same logic, wrong cycle budget. Run Path A with that one
// instruction mis-charged and confirm the golden T-state assertion catches it.
test("sub_241c MUTATION: `ld ix,(nn)` mis-charged 16T (not 20T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) =>
    realStep(nextAddr, nextAddr === 0x2433 ? 16 : cycles); // the ld ix,(nn) step

  runPathA(m);

  assert.equal(m.tstates, 252, "mutation loses exactly 4 T (20 -> 16)");
  assert.throws(
    () => assertPathAGolden(m),
    /Path A T-state total/,
    "the golden T-state assertion must fail on the mutant",
  );
});
