// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0ddd — crafted-entry equivalence vs the frozen translated oracle at ROM 0x0ddd. The routine picks
 * a horizontal target X for the actor record (IX) from the gap to the reference X (0x4202), then falls
 * through into the move-commit tail (0x0df6), which the candidate dissolves into a direct call. Every
 * live-out is work RAM in the actor record (target ix+0x19, delta ix+0x09, accumulator ix+0x1a..0x1c,
 * sub-state ix+0x02), all in the state dump, so EQUAL is asserted with ramDiff==null on both branches:
 *   - LEFT: actor left of the reference -> target clamps into [144,208].
 *   - RIGHT: actor at/right of the reference -> target clamps into [48,112].
 * Teeth: a no-op and a wrong-target twin (commits a target neither branch produces). The oracle rets
 * through its tail, so a return word is laid; the return-stack window is masked by ramDiff.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { commitMoveAcrossPlayerX as cand } from "../commitMoveAcrossPlayerX.js";
import { loc_0ddd as oracle } from "../../translated/loc_0ddd.js";
import { commitMoveToTargetX } from "../commitMoveToTargetX.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const REF_X = 0x4202;   // reference X the target is chosen against
const RECORD = 0x4270;  // scratch actor record base (in work RAM, clear of the return-stack window)
const X_O = 0x04, TARGET_O = 0x19; // actor X and stashed-target offsets within the record

// Zero the record so every commit write is observable, seat IX, poke the reference + actor X, lay a ret.
const seedRecord = (mem8, m, actorX) => {
  m.push16(0x9999); // ret for the oracle's move-commit tail
  m.regs.ix = RECORD;
  for (let i = 0; i <= TARGET_O + 4; i++) mem8[RECORD + i] = 0;
  mem8[REF_X] = 0x80;
  mem8[RECORD + X_O] = actorX;
};
const leftEntry = () => craft((mem8, m) => seedRecord(mem8, m, 0x40));  // actor left of the reference
const rightEntry = () => craft((mem8, m) => seedRecord(mem8, m, 0xc0)); // actor right of the reference

const noOp = () => {};
// Commits the SAME cells as the oracle but with a target neither band produces — proves the ramDiff
// catches a wrong chosen target, not merely "wrote nothing".
const wrongTarget = (m) => commitMoveToTargetX(m, 0x50, m.regs.ix);

test("EQUAL (crafted): loc_0ddd == oracle picks + commits the LEFT-band target", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, leftEntry()), null, "loc_0ddd diverged on the left branch");
  const a = leftEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[RECORD + TARGET_O], 0xd0, "positive control: oracle stashed the clamped left target");
  console.log("  EQUAL: loc_0ddd == oracle, left branch -> target 0xd0");
});

test("EQUAL (crafted): loc_0ddd == oracle picks + commits the RIGHT-band target", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, rightEntry()), null, "loc_0ddd diverged on the right branch");
  const a = rightEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[RECORD + TARGET_O], 0x30, "positive control: oracle stashed the clamped right target");
  console.log("  EQUAL: loc_0ddd == oracle, right branch -> target 0x30");
});

test("TEETH: broken twins are caught", { skip }, () => {
  assert.ok(ramDiff(oracle, noOp, leftEntry()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongTarget, leftEntry()), "wrong-target twin escaped");
  console.log("  TEETH: no-op + wrong-target both caught (ramDiff)");
});
