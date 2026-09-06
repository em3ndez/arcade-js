// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0f66 — memory-equivalent to the frozen oracle at ROM 0x0f66. Object-AI planner arm-window handler:
 * always tick the arm counter (record+3); once both it and the position (record+4) land inside the
 * [96,160) window, advance the planner sub-state by two, seed the move timers (record+0x10=3, +0x11=12,
 * +5=0, +0x13=0) and set the direction (record+6) from the reference-X compare; otherwise (either field
 * outside the window) hand off to the shared cross-player move tail. Whole contract is the object record
 * in work RAM (the tail delegate is itself an already-verified record mutator), so EQUAL asserts
 * ramDiff==null across the interior (both direction arms) and both tail arms. Teeth: no-op, a
 * forget-the-pre-inc twin, a wrong-direction twin, a skip-interior twin and a skip-tail-delegate twin.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { armDirectedMoveWhenInWindow as cand } from "../armDirectedMoveWhenInWindow.js";
import { loc_0f66 as oracle } from "../../translated/loc_0f66.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const REC = 0x42b0;   // object record base (IX)
const REF_X = 0x4202; // reference X the direction compare reads
const SENT = 0xee;    // sentinel poked into interior cells so the writes are demonstrable

// Both fields in-window; reference left of the position -> direction record+6 = 1.
const interiorBelow = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.regs.ix = REC;
  mem[REC + 0x03] = 0x6f; // ticks to 0x70, in [96,160)
  mem[REC + 0x04] = 0x70; // position in window
  mem[REF_X] = 0x60;      // reference below the position
  for (const off of [0x02, 0x05, 0x06, 0x10, 0x11, 0x13]) mem[REC + off] = SENT;
  mem[REC + 0x02] = 0x10; // known sub-state so the +2 is checkable
});
// Same window, reference at/right of the position -> direction record+6 = 0.
const interiorAbove = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.regs.ix = REC;
  mem[REC + 0x03] = 0x6f;
  mem[REC + 0x04] = 0x70;
  mem[REF_X] = 0x90;      // reference at/above the position
  for (const off of [0x02, 0x05, 0x06, 0x10, 0x11, 0x13]) mem[REC + off] = SENT;
  mem[REC + 0x02] = 0x10;
});
// Arm counter ticks OUT of the window -> tail delegate (record+4 never consulted for the window).
const counterOut = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.regs.ix = REC;
  mem[REC + 0x03] = 0x9f; // ticks to 0xa0, outside [96,160)
  mem[REC + 0x04] = 0x80; // actor X for the delegate
  mem[REF_X] = 0x40;
  mem[REC + 0x19] = SENT; mem[REC + 0x18] = 0x99; mem[REC + 0x10] = 0x99;
});
// Arm counter in-window but the position outside -> tail delegate.
const positionOut = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.regs.ix = REC;
  mem[REC + 0x03] = 0x6f; // ticks to 0x70, in window
  mem[REC + 0x04] = 0x00; // position outside [96,160)
  mem[REF_X] = 0x40;
  mem[REC + 0x19] = SENT; mem[REC + 0x18] = 0x99; mem[REC + 0x10] = 0x99;
});

test("EQUAL (crafted): loc_0f66 == oracle across interior and both tail arms", { skip }, () => {
  for (const [name, e] of [["interior-below", interiorBelow], ["interior-above", interiorAbove],
                           ["counter-out", counterOut], ["position-out", positionOut]]) {
    assert.equal(ramDiff(oracle, cand, e()), null, `${name} path diverged on RAM`);
  }
  // Positive control — interior arms the timers and picks each direction, and the pre-inc always fires.
  const a = interiorBelow(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[REC + 0x03], 0x70, "control: arm counter not ticked");
  assert.equal(a.mem8[REC + 0x02], 0x12, "control: planner sub-state not advanced by two");
  assert.equal(a.mem8[REC + 0x10], 3, "control: move timer +0x10 not seeded");
  assert.equal(a.mem8[REC + 0x11], 12, "control: move timer +0x11 not seeded");
  assert.equal(a.mem8[REC + 0x05], 0, "control: +5 not cleared");
  assert.equal(a.mem8[REC + 0x13], 0, "control: +0x13 not cleared");
  assert.equal(a.mem8[REC + 0x06], 1, "control: direction not set (reference below)");
  const b = interiorAbove(); b.routines = STUBS; oracle(b);
  assert.equal(b.mem8[REC + 0x06], 0, "control: direction not cleared (reference above)");
  // Positive control — the tail delegate arms its own counters (+0x18=3, +0x10=100) after the pre-inc.
  const c = counterOut(); c.routines = STUBS; oracle(c);
  assert.equal(c.mem8[REC + 0x03], 0xa0, "control: tail path skipped the pre-inc");
  assert.equal(c.mem8[REC + 0x18], 3, "control: tail delegate did not arm the leg counter");
  assert.equal(c.mem8[REC + 0x10], 100, "control: tail delegate did not arm the move throttle");
  console.log("  EQUAL: loc_0f66 == oracle (record RAM), interior + both directions + both tail arms");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const forgetInc = (m) => { cand(m); m.mem8[REC + 0x03] = (m.mem8[REC + 0x03] - 1) & 0xff; };
  const wrongDir = (m) => { cand(m); m.mem8[REC + 0x06] ^= 1; };
  const skipInterior = (m) => { m.mem8[REC + 0x03] = (m.mem8[REC + 0x03] + 1) & 0xff; }; // tick only
  const skipTail = (m) => { m.mem8[REC + 0x03] = (m.mem8[REC + 0x03] + 1) & 0xff; };       // tick only
  assert.ok(ramDiff(oracle, noOp, interiorBelow()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, forgetInc, interiorBelow()), "the forget-pre-inc twin escaped");
  assert.ok(ramDiff(oracle, wrongDir, interiorBelow()), "the wrong-direction twin escaped");
  assert.ok(ramDiff(oracle, skipInterior, interiorBelow()), "the skip-interior twin escaped");
  assert.ok(ramDiff(oracle, skipTail, counterOut()), "the skip-tail-delegate twin escaped");
  console.log("  TEETH: no-op, forget-pre-inc, wrong-direction, skip-interior, skip-tail all caught");
});
