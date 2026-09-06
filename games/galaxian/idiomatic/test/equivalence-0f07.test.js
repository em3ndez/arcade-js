// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0f07 — memory-equivalent to the frozen object frame-step handler at ROM 0x0f07. All live-outs are
 * memory (object record fields, the flag block, the command queue), so ramDiff covers everything. Five
 * paths are exercised off an object struct at IX:
 *   - RESET (gap 0): deactivate the object, flag its cell, enqueue a command word.
 *   - STEP UP (small even gap, direction bit clear): increment the phase byte.
 *   - STEP DOWN (small even gap, direction bit set): decrement the phase byte.
 *   - RETURN (gap >= limit): the object is left alone apart from the reposition + frame write.
 *   - ODD gap: same — no nudge.
 * Teeth: no-op, no-deactivate, no-flag, no-head-advance (reset), no-nudge (step), over-nudge (return).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_0f07 as cand } from "../loc_0f07.js";
import { loc_0f07 as oracle } from "../../translated/loc_0f07.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const OBJ = 0x4260;      // object record base (IX)
const ACTIVE = 0, FRAME = 3, PHASE = 5, DIRECTION = 6, CELL = 7;
const FLAG_BASE = 0x4100; // FLAG_BITS_BASE
const Q_HEAD = 0x40a0;    // command-queue write-head
const Q_SLOT = 0x40c0;    // slot for head 0xc0 (0x4000 + head)

// Cell 0 -> the reposition writes 124 into the frame field, so `positioned` is 124; the gap is
// 124 - (initialFrame + 1). Pick initialFrame to land each path.
const base = (mut) => craft((mem, mm) => {
  mm.regs.ix = OBJ;
  mm.push16(0x9999);
  mem[OBJ + CELL] = 0x00; // row 0 / col 0 -> positioned 124
  mut(mem, mm);
});

const resetEntry = () => base((mem) => {
  mem[OBJ + ACTIVE] = 0x01; // active, so deactivation is observable
  mem[OBJ + FRAME] = 123;   // frame 124 -> gap 0
  mem[FLAG_BASE + 0] = 0x00; // cell flag, so raising it to 1 is observable
  mem[Q_HEAD] = 0xc0;        // write-head
  mem[Q_SLOT] = 0x80;        // slot free (bit7 set) so the enqueue commits
  mem[Q_SLOT + 1] = 0xff;    // lo-byte slot, so the store to 0 is observable
});
const upEntry = () => base((mem) => {
  mem[OBJ + FRAME] = 121;    // frame 122 -> gap 2
  mem[OBJ + PHASE] = 0x10;
  mem[OBJ + DIRECTION] = 0x00; // clear -> step up
});
const downEntry = () => base((mem) => {
  mem[OBJ + FRAME] = 121;    // gap 2
  mem[OBJ + PHASE] = 0x10;
  mem[OBJ + DIRECTION] = 0x01; // set -> step down
});
const returnEntry = () => base((mem) => {
  mem[OBJ + ACTIVE] = 0x01;  // must stay active
  mem[OBJ + FRAME] = 98;     // frame 99 -> gap 25 (>= limit)
  mem[OBJ + PHASE] = 0x10;   // must be unchanged
});
const oddEntry = () => base((mem) => {
  mem[OBJ + FRAME] = 122;    // frame 123 -> gap 1 (odd)
  mem[OBJ + PHASE] = 0x10;   // must be unchanged
});

function afterOracle(e) { const a = e.clone(); a.routines = STUBS; oracle(a); return a; }

test("EQUAL (crafted): loc_0f07 == oracle on the reset/enqueue path", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, resetEntry()), null, "loc_0f07 diverged on reset");
  const a = afterOracle(resetEntry());
  assert.equal(a.mem8[OBJ + ACTIVE], 0, "positive control: object not deactivated");
  assert.equal(a.mem8[FLAG_BASE + 0], 1, "positive control: cell flag not raised");
  assert.equal(a.mem8[Q_HEAD], 0xc2, "positive control: queue head not advanced");
  console.log("  EQUAL: loc_0f07 == oracle (reset) — deactivated, flagged, enqueued");
});

test("EQUAL (crafted): loc_0f07 == oracle steps the phase up and down", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, upEntry()), null, "loc_0f07 diverged on step-up");
  assert.equal(ramDiff(oracle, cand, downEntry()), null, "loc_0f07 diverged on step-down");
  assert.equal(afterOracle(upEntry()).mem8[OBJ + PHASE], 0x11, "positive control: phase not incremented");
  assert.equal(afterOracle(downEntry()).mem8[OBJ + PHASE], 0x0f, "positive control: phase not decremented");
  console.log("  EQUAL: loc_0f07 == oracle — phase 0x10 -> 0x11 (up) / 0x0f (down)");
});

test("EQUAL (crafted): loc_0f07 == oracle leaves a large or odd gap alone", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, returnEntry()), null, "loc_0f07 diverged on the return path");
  assert.equal(ramDiff(oracle, cand, oddEntry()), null, "loc_0f07 diverged on the odd-gap path");
  const r = afterOracle(returnEntry());
  assert.equal(r.mem8[OBJ + ACTIVE], 1, "positive control: return path deactivated the object");
  assert.equal(r.mem8[OBJ + PHASE], 0x10, "positive control: return path nudged the phase");
  assert.equal(r.mem8[OBJ + FRAME], 99, "positive control: return path did not write the frame");
  console.log("  EQUAL: loc_0f07 == oracle — large/odd gap: only reposition + frame write");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const noDeactivate = (m) => { cand(m); m.mem8[OBJ + ACTIVE] = 1; };
  const noFlag = (m) => { cand(m); m.mem8[FLAG_BASE + 0] = 0; };
  const noHeadAdvance = (m) => { cand(m); m.mem8[Q_HEAD] = 0xc0; };
  const noNudge = (m) => { cand(m); m.mem8[OBJ + PHASE] = 0x10; };
  const overNudge = (m) => { cand(m); m.mem8[OBJ + PHASE] = (m.mem8[OBJ + PHASE] + 1) & 0xff; };
  assert.ok(ramDiff(oracle, noOp, upEntry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, noDeactivate, resetEntry()), "the no-deactivate twin escaped");
  assert.ok(ramDiff(oracle, noFlag, resetEntry()), "the no-flag twin escaped");
  assert.ok(ramDiff(oracle, noHeadAdvance, resetEntry()), "the no-head-advance twin escaped");
  assert.ok(ramDiff(oracle, noNudge, upEntry()), "the no-nudge twin escaped");
  assert.ok(ramDiff(oracle, overNudge, returnEntry()), "the over-nudge twin escaped");
  console.log("  TEETH: no-op, no-deactivate, no-flag, no-head-advance, no-nudge, over-nudge all caught");
});
