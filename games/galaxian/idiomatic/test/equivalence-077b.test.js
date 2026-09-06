// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_077b — crafted-entry equivalence vs the frozen translated oracle at ROM 0x077b. A top-level game-state
 * handler (the restore-saved-board play-state dispatcher; sibling of loc_0536, differing at sub-states
 * 2/6/7): it runs the per-frame formation prep (sweep oscillator + occupancy summary), then dispatches on
 * the sequence-state selector (0x400a) to one of EIGHT play sub-state handlers.
 *
 * Unlike loc_03f2, the ROM pushes NO continuation before its rst-28, so the selected handler's own return
 * goes straight to loc_077b's caller -- a pure tail dispatch. The idiomatic form ABSORBS the rst-28 computed
 * jump into a JS switch that calls the named handler for each index directly, so the m.call(0x0028) and its
 * inline word table (0x0785-0x0794 {0x0550,0x0583,0x0795,0x0605,0x0614,0x0661,0x07e8,0x0818}) dissolve. The
 * selector holds 0..7 in this state (all eight slots are real handlers); an out-of-range value cannot occur
 * (the ROM would jp past the table into code), so the switch has no default and no arm throws.
 *
 * One craft per selector value 0..7 (each seeded to drive its handler down an observable path) asserts
 * ramDiff==null against the oracle, with per-arm positive controls proving the compared arms are non-vacuous.
 * Teeth: a drop-handler twin (prep only, dispatch removed) diverges on every arm, proving each handler is
 * load-bearing; a rotated-table mis-dispatcher (prep intact, handler k -> handler k+1) diverges on every arm,
 * proving the index->handler MAPPING is load-bearing. The dispatcher seats + dispatches, so an SP-seam tooth
 * confirms the stack-neutral absorbed body places at the dispatch seam; a stray-push mutant is refused.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { loc_077b as cand } from "../loc_077b.js";
import { loc_077b as oracle } from "../../translated/loc_077b.js";

import { advanceFormationSweepOscillator } from "../advanceFormationSweepOscillator.js";
import { summarizeFormationOccupancy } from "../summarizeFormationOccupancy.js";
import { initPlayfieldState } from "../initPlayfieldState.js";
import { blankScreenRowsThenAdvanceSequence } from "../blankScreenRowsThenAdvanceSequence.js";
import { restoreSavedStateAndEnterPlaySubstate } from "../restoreSavedStateAndEnterPlaySubstate.js";
import { advanceSubstateAfterDwellAndQueue } from "../advanceSubstateAfterDwellAndQueue.js";
import { activateObjectsAndBeginPlayPhase } from "../activateObjectsAndBeginPlayPhase.js";
import { runGameplayFrameAndAdvanceOnFieldClear } from "../runGameplayFrameAndAdvanceOnFieldClear.js";
import { stepAltPlaySubstate6 } from "../stepAltPlaySubstate6.js";
import { saveFlagsToSnapshotAndSwitchPlayerState } from "../saveFlagsToSnapshotAndSwitchPlayerState.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const SEQ = 0x400a;         // sequence-state selector (dispatch index)
const DWELL = 0x4009;       // dwell / phase timer ticked by several arms
const VRAM_LO = 0x400b;     // 16-bit VRAM fill cursor low
const VRAM_HI = 0x400c;     // 16-bit VRAM fill cursor high
const FIELD_226 = 0x4226;   // idx-0 sets this flag byte to 1
const OBJ_ACTIVE = 0x4200;  // idx-4 seeds this active flag
const XREF = 0x4202;        // idx-4 seeds the reference X to 128
const MODE6_GATE = 0x4195;  // idx-6 advance gate
const ARM6 = 0x421d;        // idx-6 arm selector
const SOUND_GATE = 0x4006;  // sound-enable bit0
const GAME_STATE = 0x4005;  // idx-7 sets this to 3
const CUR_PLAYER = 0x400d;  // idx-7 clears this to 0

// The eight handlers in table order; used by the rotated mis-dispatch tooth.
const HANDLERS = [
  initPlayfieldState,
  blankScreenRowsThenAdvanceSequence,
  restoreSavedStateAndEnterPlaySubstate,
  advanceSubstateAfterDwellAndQueue,
  activateObjectsAndBeginPlayPhase,
  runGameplayFrameAndAdvanceOnFieldClear,
  stepAltPlaySubstate6,
  saveFlagsToSnapshotAndSwitchPlayerState,
];

// Each seed pokes SEQUENCE_STATE=k plus just enough to drive that arm's handler down an observable path.
const state0 = () => craft((mem, mm) => { mm.push16(0x9999); mem[SEQ] = 0; });
const state1 = () => craft((mem, mm) => {
  mm.push16(0x9999); mem[SEQ] = 1; mem[VRAM_LO] = 0x00; mem[VRAM_HI] = 0x50; mem[DWELL] = 3;
});
const state2 = () => craft((mem, mm) => { mm.push16(0x9999); mem[SEQ] = 2; });
const state3 = () => craft((mem, mm) => { mm.push16(0x9999); mem[SEQ] = 3; mem[DWELL] = 1; });
const state4 = () => craft((mem, mm) => { mm.push16(0x9999); mem[SEQ] = 4; mem[DWELL] = 1; });
const state5 = () => craft((mem, mm) => { mm.push16(0x9999); mem[SEQ] = 5; });
const state6 = () => craft((mem, mm) => {
  mm.push16(0x9999); mem[SEQ] = 6; mem[MODE6_GATE] = 1; mem[ARM6] = 0; mem[SOUND_GATE] = 1; mem[DWELL] = 50;
});
const state7 = () => craft((mem, mm) => { mm.push16(0x9999); mem[SEQ] = 7; mem[DWELL] = 1; });

const seeds = [state0, state1, state2, state3, state4, state5, state6, state7];

function runOracle(mk) { const a = mk(); a.routines = STUBS; oracle(a); return a; }

test("EQUAL (crafted): loc_077b == oracle on every sub-state arm 0..7", { skip }, () => {
  for (let k = 0; k < 8; k++) {
    assert.equal(ramDiff(oracle, cand, seeds[k]()), null, `loc_077b diverged on selector ${k}`);
  }

  // Per-arm positive controls: the oracle mutates RAM on the arm the EQUAL comparison covers.
  const a0 = runOracle(state0);
  assert.equal(a0.mem8[SEQ], 1, "idx0: sequence advanced 0->1");
  assert.equal(a0.mem8[DWELL], 32, "idx0: dwell armed to 32");
  assert.equal(a0.mem8[VRAM_LO], 0x00, "idx0: VRAM cursor low reset to 0x00");
  assert.equal(a0.mem8[VRAM_HI], 0x50, "idx0: VRAM cursor high reset to 0x50");
  assert.equal(a0.mem8[FIELD_226], 1, "idx0: flag byte 0x4226 set to 1");

  const a1 = runOracle(state1);
  assert.equal(a1.mem8[VRAM_LO], 0x20, "idx1: VRAM cursor advanced +32 (low 0x00->0x20)");
  assert.equal(a1.mem8[VRAM_HI], 0x50, "idx1: VRAM cursor high unchanged mid-page");
  assert.equal(a1.mem8[DWELL], 2, "idx1: phase counter ticked 3->2 (still mid-clear)");

  const a2 = runOracle(state2);
  assert.equal(a2.mem8[SEQ], 3, "idx2: sequence advanced 2->3");
  assert.equal(a2.mem8[DWELL], 150, "idx2: state timer armed to 150");

  const a3 = runOracle(state3);
  assert.equal(a3.mem8[SEQ], 4, "idx3: dwell expiry advanced sequence 3->4");
  assert.equal(a3.mem8[DWELL], 20, "idx3: dwell reloaded to 20 on expiry");

  const a4 = runOracle(state4);
  assert.equal(a4.mem8[SEQ], 5, "idx4: timer expiry advanced sequence 4->5");
  assert.equal(a4.mem8[DWELL], 10, "idx4: timer reloaded to 10 on expiry");
  assert.equal(a4.mem8[OBJ_ACTIVE], 1, "idx4: object subsystem enabled (0x4200=1)");
  assert.equal(a4.mem8[XREF], 128, "idx4: reference X seeded to 128");

  const a6 = runOracle(state6);
  assert.equal(a6.mem8[SEQ], 7, "idx6: default-advance arm advanced sequence 6->7");
  assert.equal(a6.mem8[DWELL], 130, "idx6: dwell re-armed to 130 on the default arm");

  const a7 = runOracle(state7);
  assert.equal(a7.mem8[SEQ], 0, "idx7: dwell expiry cleared the sequence state");
  assert.equal(a7.mem8[GAME_STATE], 3, "idx7: game state switched to 3");
  assert.equal(a7.mem8[CUR_PLAYER], 0, "idx7: current player reset to 0");

  console.log("  EQUAL: loc_077b == oracle on all eight sub-state arms, controls non-vacuous");
});

test("TEETH: drop-handler and mis-dispatch twins are caught on every arm", { skip }, () => {
  // Drop-handler twin: run the prep but omit the dispatch entirely. Proves each handler is load-bearing.
  const dropHandler = (m) => { advanceFormationSweepOscillator(m); summarizeFormationOccupancy(m); };
  // Mis-dispatch twin: prep intact, but each index runs the NEXT handler (rotated table). Proves the
  // index->handler MAPPING (not merely "a handler ran") is load-bearing.
  const misdispatch = (m) => {
    advanceFormationSweepOscillator(m);
    summarizeFormationOccupancy(m);
    return HANDLERS[(m.mem8[SEQ] + 1) & 7](m);
  };
  for (let k = 0; k < 8; k++) {
    assert.ok(ramDiff(oracle, dropHandler, seeds[k]()), `drop-handler twin escaped on selector ${k}`);
    assert.ok(ramDiff(oracle, misdispatch, seeds[k]()), `mis-dispatch twin escaped on selector ${k}`);
  }
  console.log("  TEETH: drop-handler and rotated mis-dispatch twins caught on all eight arms");
});

test("SP-SEAM TOOTH: the absorbed tail dispatch places at the seam", { skip }, () => {
  for (const [name, mk] of [["idx0", state0], ["idx5", state5], ["idx7", state7]]) {
    const r = seamPlaceable(withOmittedRet, cand, 0x077b, mk());
    assert.equal(r.placeable, true, `seam refused the stack-neutral body on ${name}: ${r.error}`);
  }
  // Null-mutant: a body leaving a word adrift on the stack (an un-dissolved push16) moves SP off the seat,
  // so the seam MUST refuse it -- invisible to ramDiff.
  const strayPush = (m) => { cand(m); m.push16(0x9999); };
  const rm = seamPlaceable(withOmittedRet, strayPush, 0x077b, state0());
  assert.equal(rm.placeable, false, "the stray-push mutant placed at the seam (tooth has no teeth)");
  console.log("  SP-SEAM: stack-neutral dispatch places on all arms; stray-push mutant refused");
});
