// SPDX-License-Identifier: GPL-3.0-only
import { climbHunterToLaunchRowThenPromoteGroup } from "./climbHunterToLaunchRowThenPromoteGroup.js";
import { runHunterMoveScriptStep } from "./runHunterMoveScriptStep.js";
import { climbHunterStepAndRetireAtTop } from "./climbHunterStepAndRetireAtTop.js";
import { clearWaveHoldTimerToArmNextWave } from "./clearWaveHoldTimerToArmNextWave.js";
/**
 * dispatchOneHunterRecordState — per-hunter-record state dispatcher for the hunter attack wave.
 *
 * WHAT IT IS
 *   The router for one hunter's own little state machine. Pooyan's "hunter" attackers are seeded as a
 *   group into the enemy-actor pool; each hunter lives in one 0x18-byte record based at
 *   ENEMY_ACTOR_TABLE (0x8ae0), and each record carries its own dispatch-state byte at field +0x02.
 *   Once per frame the hunter sweep (dispatchAllHunterRecordStates, 0x2c2c) hands each of the 17
 *   records in turn to THIS routine, which decides — for that single record — whether the slot is even
 *   alive, and if so which of four per-state handlers runs the record's behaviour this frame.
 *
 * WHAT IT DOES
 *   Two guards, then a four-way dispatch:
 *     1. Dormant-slot guard. A record is active only when bit 0 of (rec+0) OR (rec+1) is set; a record
 *        with that bit clear is an empty slot, so this routine touches nothing and tells the sweep to
 *        keep walking (returns true).
 *     2. State-range guard. The hunter dispatch band is states 0x11..0x14. The state byte is masked to
 *        its low five bits; any value below 0x11 belongs to a different (non-hunter-dispatch) phase of
 *        the record's life and is skipped, again returning true so the sweep continues.
 *     3. Dispatch. Subtracting the 0x11 base turns the state into a 0..3 index that selects one of four
 *        handlers, and whatever boolean that handler returns is propagated straight back to the sweep.
 *
 * THE FOUR HANDLERS (state → handler)
 *   0x11 → climbHunterToLaunchRowThenPromoteGroup              — climb the freshly-seeded hunter up its column at a fixed step; the
 *                                  frame the formation reaches the top row it promotes every still-
 *                                  gathering hunter into the move-script state and caller-skips (false).
 *   0x12 → runHunterMoveScriptStep — consume one command from the hunter's ROM movement script (a
 *                                  signed position delta, a direction reload, or the turn/animate
 *                                  opcode); returns true (the normal, keep-sweeping result).
 *   0x13 → climbHunterStepAndRetireAtTop             — climb one vertical step and, at the top row, retire the record and
 *                                  caller-skip (false).
 *   0x14 → clearWaveHoldTimerToArmNextWave            — collapse the inter-wave hold countdown so the next attack wave can
 *                                  arm, then caller-skip (false).
 *
 * THE CALLER-SKIP PROTOCOL
 *   A handler returns true to mean "record handled, keep sweeping the rest"; it returns false to mean
 *   "abort the whole remaining pass over the records" (on the hardware such a handler drops the saved
 *   return before it exits, unwinding a level so the walk does not resume). dispatchOneHunterRecordState is transparent to
 *   this: it forwards the handler's boolean unchanged, and both of its own guard exits return true.
 *   The sweep breaks its loop the first time it sees false.
 *
 * ROM: 0x2c3f–0x2c4f (the four handler addresses live in an inline table at 0x2c50).
 *
 * GROUNDING: names.js carries no cert entry for this routine's own address; the caller that drives it
 * (dispatchAllHunterRecordStates 0x2c2c) and the enemy-actor record region it walks
 * (ENEMY_ACTOR_TABLE 0x8ae0) are both [seen].
 *
 * LIVE-OUT: the returned boolean — true = keep sweeping the remaining hunter records, false =
 * caller-skip (abort the rest of the dispatch pass). Every other effect is memory, performed inside
 * the selected handler. The `rec` argument is the base of the one hunter record being dispatched.
 */
export function dispatchOneHunterRecordState(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Dormant-slot guard. A live record has bit 0 set in (rec+0) OR (rec+1); when that bit is clear the
  // slot is empty, so leave it untouched and let the sweep move on to the next record.
  if (((mem8[rec + 0x00] | mem8[rec + 0x01]) & 1) === 0) return true; // inactive slot

  // Read the record's dispatch-state byte, keeping only its low five bits (the upper bits carry
  // unrelated per-record flags).
  const state = mem8[rec + 0x02] & 0x1f;

  // State-range guard. The hunter dispatch band starts at 0x11; a lower state belongs to a different
  // phase of this record's life and is not ours to run, so skip it and keep the sweep going.
  if (state < 0x11) return true; // state below the dispatch range

  // Four-way dispatch. Rebase the state to a 0..3 index and run the matching per-state handler,
  // forwarding its caller-skip boolean straight back to the sweep.
  switch (state - 0x11) {
    // State 0x11: climb the hunter up its column; at the top it promotes the whole formation into the
    // move-script state and caller-skips.
    case 0: return climbHunterToLaunchRowThenPromoteGroup(m, rec);
    // State 0x12: consume one command from the hunter's movement script; returns true (normal).
    case 1: return runHunterMoveScriptStep(m, rec);
    // State 0x13: climb one vertical step, retiring the record and caller-skipping at the top row.
    case 2: return climbHunterStepAndRetireAtTop(m, rec);
    // State 0x14: collapse the inter-wave hold countdown so the next wave can arm, then caller-skip.
    case 3: return clearWaveHoldTimerToArmNextWave(m, rec);
    // Guard-slack. The state-range guard only proves state >= 0x11, but the hardware's handler table
    // holds just four entries (states 0x11..0x14). A hunter record never carries a higher state in
    // this band, so this arm is unreachable in correct play; throwing makes any such out-of-range
    // state loud rather than silently indexing past the four-entry table.
    default:
      throw new Error("dispatchOneHunterRecordState: hunter state index > 3 (guard-slack; the table has 4 entries)");
  }
}
