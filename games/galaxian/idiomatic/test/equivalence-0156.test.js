// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0156 — crafted-entry equivalence vs the frozen translated oracle at ROM 0x0156. A top-level
 * game-state handler (game-state slot 1 of loc_0066): it runs the per-frame formation prep (sweep
 * oscillator 0x090d + occupancy summary 0x098e), then dispatches on the sequence-state selector
 * (SEQUENCE_STATE 0x400a) through the inline word table at 0x0164 to one of the sub-state handlers, and
 * finishes at advanceGameStateOnCredit (0x03d7), the continuation the ROM pushes before its rst-28.
 *
 * The idiomatic form ABSORBS the rst-28 computed jump into the SEQUENCE_HANDLERS table, calling the named
 * handler for each index directly, so the m.call(0x0028) + its inline word table (0x0164-0x018b) dissolve.
 * The table has 20 entries: indices 0..18 are real handlers (idx 8 duplicates idx 2, idx 17 duplicates
 * idx 11), and index 19's word is 0x0000 — a cold-reset terminator sentinel, unreachable by valid
 * SEQUENCE_STATE; the idiomatic form guards it (and any out-of-range selector) as a throw, not a reset.
 *
 * One craft per reachable selector value 0..18 asserts ramDiff==null against the oracle; because each
 * dispatched handler and the prep/continuation are independently equivalence-proven, the whole dispatch
 * agrees only when every index maps to the same handler the oracle picks — so the loop is itself the
 * mapping guard (idx 8 and idx 17 dup arms included). Each craft zeroes the credit count (0x4002) so the
 * pushed continuation is inert and the per-state effect is isolated, and seats a caller-return word for
 * the dispatch seam. Non-vacuous positive controls confirm the oracle mutates work RAM on covered arms.
 * Teeth: a no-op twin, a dropped-handler twin (prep+continuation, no dispatch), and a wrong-index twin
 * (always dispatch enterSequenceStep1) each diverge — the last on the dup arms 8/17 too; an out-of-range
 * selector (>= 20) throws (caught wrapper). The dispatcher seats + dispatches, so an SP-seam tooth
 * confirms the stack-neutral body places at the seam on several arms and refuses a stray-push mutant.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { runAttractSequenceAndAdvanceOnCredit as cand } from "../runAttractSequenceAndAdvanceOnCredit.js";
import { loc_0156 as oracle } from "../../translated/loc_0156.js";
import { advanceFormationSweepOscillator } from "../advanceFormationSweepOscillator.js";
import { summarizeFormationOccupancy } from "../summarizeFormationOccupancy.js";
import { advanceGameStateOnCredit } from "../advanceGameStateOnCredit.js";
import { enterSequenceStep1 } from "../enterSequenceStep1.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const SEQ = 0x400a;        // sequence-state selector (dispatch index)
const CREDITS = 0x4002;    // credit count read by the pushed continuation (0 -> inert)
const STEP_TIMER = 0x4008; // dwell sub-timer armed by the state-0 / state-18 handlers
const DWELL = 0x4009;      // dwell tier armed by the state-18 handler
const FLAG_4007 = 0x4007;  // frame flag raised by the state-0 handler

// A bounded-attract clone seeded at sequence-state k, credits zeroed (inert continuation), with a
// caller-return word seated for the dispatch seam.
function stateEntry(k) {
  return craft((mem, mm) => {
    mm.push16(0x9999);
    mem[CREDITS] = 0;
    mem[SEQ] = k;
  });
}

function runOracle(entry) { const a = entry.clone(); a.routines = STUBS; oracle(a); return a; }

test("EQUAL (crafted): loc_0156 == oracle on every reachable sequence-state arm (0..18)", { skip }, () => {
  for (let k = 0; k <= 18; k++) {
    assert.equal(ramDiff(oracle, cand, stateEntry(k)), null, `sequence-state ${k} diverged`);
  }

  // Non-vacuous positive controls: the oracle mutates work RAM on arms the EQUAL comparison covers.
  const s0 = runOracle(stateEntry(0));   // idx 0 -> initSequenceEnableStarfield
  assert.equal(s0.mem8[SEQ], 1, "state 0: selector advanced 0->1");
  assert.equal(s0.mem8[FLAG_4007], 1, "state 0: frame flag 0x4007 raised");
  assert.equal(s0.mem8[STEP_TIMER], 96, "state 0: dwell sub-timer armed to 96");

  const s18 = runOracle(stateEntry(18)); // idx 18 -> enterSequenceStep1
  assert.equal(s18.mem8[SEQ], 1, "state 18: selector set to 1");
  assert.equal(s18.mem8[STEP_TIMER], 3, "state 18: dwell sub-timer armed to 3");
  assert.equal(s18.mem8[DWELL], 3, "state 18: dwell tier armed to 3");

  console.log("  EQUAL: loc_0156 == oracle on all 19 reachable arms (dup arms 8/17 included)");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  // Dropped-handler twin: run the prep + continuation but skip the dispatched handler entirely.
  const droppedHandler = (m) => {
    advanceFormationSweepOscillator(m);
    summarizeFormationOccupancy(m);
    return advanceGameStateOnCredit(m);
  };
  // Wrong-index twin: always dispatch enterSequenceStep1, whatever the selector holds.
  const misdispatch = (m) => {
    advanceFormationSweepOscillator(m);
    summarizeFormationOccupancy(m);
    enterSequenceStep1(m);
    return advanceGameStateOnCredit(m);
  };

  assert.ok(ramDiff(oracle, noOp, stateEntry(0)), "no-op twin escaped (state 0)");
  assert.ok(ramDiff(oracle, droppedHandler, stateEntry(0)), "dropped-handler twin escaped (state 0)");
  // On state 0 the oracle runs initSequenceEnableStarfield; the twin runs enterSequenceStep1 -> diverges.
  assert.ok(ramDiff(oracle, misdispatch, stateEntry(0)), "wrong-index twin escaped (state 0)");
  // Dup-arm bite: idx 8 must map to primeVramFillAndAdvanceStep, idx 17 to tickSequenceDwellTimer, so the
  // enterSequenceStep1 twin diverges on both.
  assert.ok(ramDiff(oracle, misdispatch, stateEntry(8)), "wrong-index twin escaped (state 8, dup of 2)");
  assert.ok(ramDiff(oracle, misdispatch, stateEntry(17)), "wrong-index twin escaped (state 17, dup of 11)");

  // The cold-reset sentinel (19) and any out-of-range selector (>= 20) cannot occur in valid play; the
  // self-contained dispatch guards both as a throw rather than reproducing the ROM's soft reset.
  assert.throws(() => cand(stateEntry(19)), /no sub-state handler/, "reset sentinel (19) did not throw");
  assert.throws(() => cand(stateEntry(20)), /no sub-state handler/, "out-of-range selector did not throw");

  console.log("  TEETH: no-op, dropped-handler, wrong-index (incl. dup arms), and out-of-range all caught");
});

test("SP-SEAM TOOTH: the absorbed dispatch places at the seam", { skip }, () => {
  for (const k of [0, 7, 18]) {
    const r = seamPlaceable(withOmittedRet, cand, 0x0156, stateEntry(k));
    assert.equal(r.placeable, true, `seam refused the stack-neutral body on state ${k}: ${r.error}`);
  }
  // Null-mutant: a body that leaves a word adrift on the stack (an un-dissolved push16) moves SP off the
  // seat, so the seam MUST refuse it -- invisible to ramDiff.
  const strayPush = (m) => { cand(m); m.push16(0x9999); };
  const rm = seamPlaceable(withOmittedRet, strayPush, 0x0156, stateEntry(0));
  assert.equal(rm.placeable, false, "the stray-push mutant placed at the seam (tooth has no teeth)");
  console.log("  SP-SEAM: stack-neutral dispatch places on three arms; stray-push mutant refused");
});
