// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0536 — crafted-entry equivalence vs the frozen translated oracle at ROM 0x0536. The fresh-board
 * play-state dispatcher: it runs the per-frame formation prep (sweep oscillator + occupancy summary),
 * then dispatches on the sequence-state selector (0x400a) to one of eight play sub-state handlers. The
 * dispatched target rets to loc_0536's caller (0x00d8), so the rst-28 is a pure tail-dispatch (no
 * post-dispatch continuation).
 *
 * The idiomatic form ABSORBS the rst-28 computed jump into a JS handler table indexed by the selector,
 * direct-calling each handler, so the m.call(0x0028) + its inline word table (0x0540-0x054f) dissolve.
 * The index->handler map under test is 0->initPlayfieldState, 1->blankScreenRowsThenAdvanceSequence,
 * 2->restoreFormationAndEnterPlaySubstate, 3->advanceSubstateAfterDwellAndQueue,
 * 4->activateObjectsAndBeginPlayPhase, 5->runGameplayFrameAndAdvanceOnFieldClear, 6->stepPlaySubstate6,
 * 7->packFlagsToBitmapAndSwitchPlayerState.
 *
 * One craft per reachable selector value 0..7 asserts ramDiff==null against the oracle. Teeth: a no-op
 * twin per state (which also proves each EQUAL arm is non-vacuous — the oracle writes RAM on every arm),
 * a wrong-index mis-dispatch twin (shifted handler) on clearly-divergent arms, and an out-of-range wrapper
 * that throws (the eight-entry table has no ninth arm). The dispatcher seats + tail-dispatches, so an
 * SP-seam tooth confirms the stack-neutral body places at the dispatch seam; a stray-push mutant is refused.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { runPlayerOnePlayFrame as cand } from "../runPlayerOnePlayFrame.js";
import { loc_0536 as oracle } from "../../translated/loc_0536.js";
import { initPlayfieldState } from "../initPlayfieldState.js";
import { blankScreenRowsThenAdvanceSequence } from "../blankScreenRowsThenAdvanceSequence.js";
import { restoreFormationAndEnterPlaySubstate } from "../restoreFormationAndEnterPlaySubstate.js";
import { advanceSubstateAfterDwellAndQueue } from "../advanceSubstateAfterDwellAndQueue.js";
import { activateObjectsAndBeginPlayPhase } from "../activateObjectsAndBeginPlayPhase.js";
import { runGameplayFrameAndAdvanceOnFieldClear } from "../runGameplayFrameAndAdvanceOnFieldClear.js";
import { stepPlaySubstate6 } from "../stepPlaySubstate6.js";
import { packFlagsToBitmapAndSwitchPlayerState } from "../packFlagsToBitmapAndSwitchPlayerState.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const SEQ = 0x400a; // sequence-state selector (dispatch index)

// The eight handlers in table order — used to build a mis-dispatch (shifted-mapping) twin.
const HANDLERS = [
  initPlayfieldState,
  blankScreenRowsThenAdvanceSequence,
  restoreFormationAndEnterPlaySubstate,
  advanceSubstateAfterDwellAndQueue,
  activateObjectsAndBeginPlayPhase,
  runGameplayFrameAndAdvanceOnFieldClear,
  stepPlaySubstate6,
  packFlagsToBitmapAndSwitchPlayerState,
];

// A fresh attract-seed clone with a caller-return word seated (for the tail-dispatch) and the selector
// poked to state k. All eight handlers write work RAM from this seed (timer tick / cursor / fill / etc.).
const stateEntry = (k) => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[SEQ] = k;
});

test("EQUAL (crafted): loc_0536 == oracle on every reachable selector 0..7", { skip }, () => {
  for (let k = 0; k < 8; k++) {
    assert.equal(ramDiff(oracle, cand, stateEntry(k)), null, `loc_0536 diverged on selector ${k}`);
  }
  console.log("  EQUAL: loc_0536 == oracle on all eight play sub-state arms");
});

test("TEETH: dropped-handler and mis-dispatch twins are caught (each arm non-vacuous)", { skip }, () => {
  const noOp = () => {};
  // No-op twin per state: a writing arm must diverge -> proves the handler is load-bearing AND that the
  // EQUAL arm above is non-vacuous (the oracle writes RAM on every selector).
  for (let k = 0; k < 8; k++) {
    assert.ok(ramDiff(oracle, noOp, stateEntry(k)), `no-op twin escaped on selector ${k}`);
  }
  // Wrong-index mis-dispatch twins on clearly-divergent arms: run a different handler than the mapping
  // selects (init<->gameplay, blank<->restore) -> the RAM effects are unmistakably different.
  const misAt = (wrong) => (m) => HANDLERS[wrong](m);
  assert.ok(ramDiff(oracle, misAt(5), stateEntry(0)), "mis-dispatch twin escaped (0 ran gameplay)");
  assert.ok(ramDiff(oracle, misAt(0), stateEntry(5)), "mis-dispatch twin escaped (5 ran init)");
  assert.ok(ramDiff(oracle, misAt(2), stateEntry(1)), "mis-dispatch twin escaped (1 ran restore)");
  assert.ok(ramDiff(oracle, misAt(1), stateEntry(2)), "mis-dispatch twin escaped (2 ran blank)");
  console.log("  TEETH: no-op (all 8) and mis-dispatch twins all caught");
});

test("TEETH: an out-of-range selector has no arm (the table is exactly eight)", { skip }, () => {
  // The absorbed table has eight entries; selector 8 cannot occur in this game state, and the idiomatic
  // form has no ninth handler to call -> it throws rather than silently dispatching to garbage.
  assert.throws(() => cand(stateEntry(8)), "out-of-range selector 8 did not throw");
  console.log("  TEETH: out-of-range selector throws (no ninth arm)");
});

test("SP-SEAM TOOTH: the stack-neutral tail-dispatch places at the seam", { skip }, () => {
  for (const k of [0, 3, 7]) {
    const r = seamPlaceable(withOmittedRet, cand, 0x0536, stateEntry(k));
    assert.equal(r.placeable, true, `selector ${k}: seam refused the stack-neutral body: ${r.error}`);
  }
  // Null-mutant: a body that leaves a word adrift on the stack (an un-dissolved push16) moves SP off the
  // seat, so the seam MUST refuse it -- invisible to ramDiff.
  const strayPush = (m) => { cand(m); m.push16(0x9999); };
  const rm = seamPlaceable(withOmittedRet, strayPush, 0x0536, stateEntry(0));
  assert.equal(rm.placeable, false, "the stray-push mutant placed at the seam (tooth has no teeth)");
  console.log("  SP-SEAM: stack-neutral tail-dispatch places on three arms; stray-push mutant refused");
});
