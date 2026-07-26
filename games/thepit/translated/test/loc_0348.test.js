// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_0348 (ROM 0x0348-0x0370, The Pit) -- the
// in-game main loop.
//
//   0348  ld sp,0x83ff        ; re-seat the stack (this is the loop head)
//   034b  ld a,(0xb800)       ; the READ kicks the watchdog
//   034e  call 0x4b14         ; per-frame service
//   0351  ld a,(0x8001)       ; game-mode byte
//   0354  cp 0x04             ; Z <- (0x8001 == 4)
//   0356  call z,0x03e8       ; only when the mode byte is 4
//   0359  call 0x13c9         ; per-frame service
//   035c  call 0x241c         ; ...
//   035f  call 0x06ac         ; ...
//   0362  call 0x24f3         ; ...
//   0365  ld a,(0x8011)       ; outer delay count
//   0368  ld b,0x00           ; inner delay count (0 -> 256 spins)
// loc_036a:
//   036a  djnz 0x036a         ; inner busy spin (256 per pass)
//   036c  dec a               ; Z when the outer count hits 0
//   036d  jr nz,0x036a        ; another pass while A != 0
//   036f  jr 0x0348           ; loop back to the top, FOREVER
//
// Runs on a minimal machine built from the REAL thepit address space
// (boards/thepit/memory.js) + Io + the shared Z80 Regs, so the `ld a,(0xb800)`
// watchdog kick is exercised authentically. Callees are stubbed as
// "pop-and-return" routines that balance the stack but add no cycles, so the
// asserted T-state total is loc_0348's OWN instruction cost.
//
// The routine loops forever (`jr 0x0348` -> its own first instruction), so the
// mock's step() throws a StopLoop sentinel the instant PC targets 0x0348 -- which
// happens ONLY at the loop-back (entry's first step goes to 0x034b). Catching it
// stops the run after EXACTLY one pass and PROVES the loop-back fired and the
// routine never returned.
//
// A deliberate MUTATION (the `call z,0x03e8` polarity flipped to NZ) is asserted
// to be caught by the golden spec.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_0348 } from "../loc_0348.js";

// Thrown by step() when the loop jumps back to the top; stops the infinite loop.
class StopLoop extends Error {}

const LOOP_TOP = 0x0348;

// -- T-state accounting -------------------------------------------------------
// Prologue WITHOUT the conditional call (0348..0368):
//   ldsp(10)+lda_b800(13)+call(17)+lda_8001(13)+cp(7) +call(17)*4 +lda_8011(13)+ldb(7)
const PROLOGUE_BASE = 10 + 13 + 17 + 13 + 7 + 4 * 17 + 13 + 7; // 148
const CALLZ_TAKEN = 17; // call z taken
const CALLZ_SKIP = 10; // call z not taken
// One inner djnz pass with B = 0: 255 taken@13 + 1 not-taken@8.
const INNER = 255 * 13 + 8; // 3323
// Outer delay of N passes: N inner passes + N dec a@4 + (N-1) jr-taken@12 + 1 not@7.
const delay = (n) => n * INNER + n * 4 + ((n - 1) * 12 + 7);
const LOOPBACK = 12; // jr 0x0348 (charged before StopLoop stops the run)
const total = (n, callZTaken) =>
  PROLOGUE_BASE + (callZTaken ? CALLZ_TAKEN : CALLZ_SKIP) + delay(n) + LOOPBACK;

function buildRom() {
  return new Uint8Array(0x5000); // AddressSpace requires exactly 20480 bytes
}

// -- minimal machine: real mem/io/regs + the step/call/push seam --------------
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = LOOP_TOP;
    this.calls = [];
    this.retCount = 0; // MUST stay 0 -- the main loop never rets
    this.regs.sp = 0x8780; // some mapped stack; the routine's first op re-seats it
  }
  step(nextAddr, t) {
    this.pc = nextAddr;
    this.cycles += t;
    if (nextAddr === LOOP_TOP) throw new StopLoop(); // the 036f jr 0x0348 loop-back
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
  // Stubbed callee: record it, behave as a bare `ret` (pop the pushed address),
  // no cycle charge -- the callee's own cost is not loc_0348's.
  call(addr) {
    this.calls.push(addr);
    this.pc = this.pop16();
    return undefined;
  }
  ret(cycles = 10) {
    this.retCount += 1;
    this.step(this.pop16(), cycles);
  }
}

// mode = value at (0x8001) selecting the conditional call; n = (0x8011) delay count.
function run(fn, mode, n) {
  const m = new TestMachine(buildRom());
  m.mem.write8(0x8001, mode & 0xff);
  m.mem.write8(0x8011, n & 0xff);
  m.io.watchdog.framesSinceKick = 5; // poison; the 0xb800 read must reset it to 0
  let stopped = false;
  try {
    fn(m);
  } catch (e) {
    if (!(e instanceof StopLoop)) throw e;
    stopped = true;
  }
  return {
    stopped,
    cycles: m.cycles,
    calls: m.calls,
    retCount: m.retCount,
    pc: m.pc,
    sp: m.regs.sp,
    a: m.regs.a,
    b: m.regs.b,
    watchdog: m.io.watchdog.framesSinceKick,
  };
}

// -- Golden: mode == 4 -> the conditional 0x03e8 fires; delay n = 2 -----------
function checkModeFour(res) {
  assert.equal(res.stopped, true, "reached the jr 0x0348 loop-back (stopped after one pass)");
  assert.equal(res.retCount, 0, "the main loop NEVER rets");
  assert.deepEqual(
    res.calls,
    [0x4b14, 0x03e8, 0x13c9, 0x241c, 0x06ac, 0x24f3],
    "call order incl. the conditional 0x03e8 (mode == 4)",
  );
  assert.equal(res.pc, LOOP_TOP, "PC left at the loop-back target 0x0348");
  assert.equal(res.sp, 0x83ff, "SP re-seated to 0x83ff; all 6 calls balanced");
  assert.equal(res.a, 0x00, "A counted the outer delay down to 0");
  assert.equal(res.b, 0x00, "B wrapped back to 0 after the inner spin");
  assert.equal(res.watchdog, 0, "ld a,(0xb800) kicked the watchdog (5 -> 0)");
  assert.equal(res.cycles, total(2, true), "T-state total (mode 4, n=2)");
}

test("loc_0348: mode==4 pass fires 0x03e8, kicks watchdog, loops back; 6850 T", () => {
  const res = run(loc_0348, 0x04, 0x02);
  assert.equal(res.cycles, 6850, "explicit golden total for one pass (n=2, call z taken)");
  checkModeFour(res);
});

// -- Non-4 mode: the conditional call is SKIPPED; delay n = 1 -----------------
test("loc_0348: mode!=4 skips 0x03e8, still loops back; 3504 T", () => {
  const res = run(loc_0348, 0x00, 0x01);
  assert.equal(res.stopped, true, "still reaches the loop-back");
  assert.equal(res.retCount, 0, "still never rets");
  assert.deepEqual(
    res.calls,
    [0x4b14, 0x13c9, 0x241c, 0x06ac, 0x24f3],
    "0x03e8 absent when mode != 4",
  );
  assert.equal(res.watchdog, 0, "watchdog kicked regardless of mode");
  assert.equal(res.a, 0x00, "one outer pass (n=1) -> A = 0");
  assert.equal(res.cycles, 3504, "T-state total (mode!=4, n=1)");
  assert.equal(res.cycles, total(1, false), "matches the parameterised model");
});

// -- The (0x8011) count drives the outer delay: n=3 runs one more 256-spin pass
test("loc_0348: (0x8011) drives the outer delay-loop length", () => {
  const two = run(loc_0348, 0x00, 0x02).cycles;
  const three = run(loc_0348, 0x00, 0x03).cycles;
  // Each extra pass adds one inner spin (3323) + dec a (4) + one more jr-taken (12).
  assert.equal(three - two, INNER + 4 + 12, "n+1 adds exactly one inner spin + dec + jr");
});

// -- MUTATION: `call z,0x03e8` polarity flipped to fNZ. With mode == 4 (Z set)
// the mutant WRONGLY skips 0x03e8 (charging 10 T instead of 17) instead of
// calling it. The mode-4 golden spec MUST reject it. Full copy so the only
// difference is the flipped branch.
function loc_0348_mutant(m) {
  const { regs, mem } = m;
  for (;;) {
    regs.sp = 0x83ff;
    m.step(0x034b, 10);
    regs.a = mem.read8(0xb800);
    m.step(0x034e, 13);
    m.push16(0x0351);
    m.step(0x4b14, 17);
    m.call(0x4b14);
    regs.a = mem.read8(0x8001);
    m.step(0x0354, 13);
    regs.cp(0x04);
    m.step(0x0356, 7);
    if (regs.fNZ) { // BUG: should be fZ (call z, not call nz)
      m.push16(0x0359);
      m.step(0x03e8, 17);
      m.call(0x03e8);
    } else {
      m.step(0x0359, 10);
    }
    m.push16(0x035c);
    m.step(0x13c9, 17);
    m.call(0x13c9);
    m.push16(0x035f);
    m.step(0x241c, 17);
    m.call(0x241c);
    m.push16(0x0362);
    m.step(0x06ac, 17);
    m.call(0x06ac);
    m.push16(0x0365);
    m.step(0x24f3, 17);
    m.call(0x24f3);
    regs.a = mem.read8(0x8011);
    m.step(0x0368, 13);
    regs.b = 0x00;
    m.step(0x036a, 7);
    for (;;) {
      for (;;) {
        if (regs.djnz() !== 0) {
          m.step(0x036a, 13);
        } else {
          m.step(0x036c, 8);
          break;
        }
      }
      regs.a = regs.dec8(regs.a);
      m.step(0x036d, 4);
      if (regs.fNZ) {
        m.step(0x036a, 12);
      } else {
        m.step(0x036f, 7);
        break;
      }
    }
    m.step(0x0348, 12);
  }
}

test("mutation (call z polarity flipped to NZ) is caught by the mode-4 spec", () => {
  const bad = run(loc_0348_mutant, 0x04, 0x02);
  // Sanity: the mutant really diverges on the mode-4 input.
  assert.deepEqual(
    bad.calls,
    [0x4b14, 0x13c9, 0x241c, 0x06ac, 0x24f3],
    "mutant skipped 0x03e8 when it should have called it",
  );
  assert.equal(bad.cycles, total(2, false), "mutant mischarged the fork (17 -> 10 T)");
  // The spec the real routine passes must REJECT the mutant.
  assert.throws(() => checkModeFour(bad));
});
