// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_32d6 — an object's interval down-counter with position-gated reload, then
 * a periodic-timer tick.  ROM 0x32D6.
 *
 * Services one object record (the record pointer is the register live-in). It runs
 * a down-counter in record field +0x1C:
 *
 *   • While the counter is still counting (nonzero, and its decrement does not reach
 *     zero), the whole routine is: step it down and reset the object's state (+0x0D)
 *     to 0. Nothing else runs.
 *   • On the pass that steps it to zero — OR when the counter is already zero and the
 *     object is NOT armed (+0x1D != 1) — it clears the object's two exit fields
 *     (+0x19 and +0x1C to 0, on the step-to-zero branch) and ticks the object's
 *     periodic timer via tickFireTimerAndRerollDirection.
 *   • When the counter is already zero AND the object is armed (+0x1D == 1), it
 *     disarms (+0x1D := 0) and compares MARIO_Y against the object's limit field
 *     (+0x0F):
 *       – MARIO_Y below the limit (a borrow): clear +0x19 and +0x1C, then tick
 *         tickFireTimerAndRerollDirection (same exit as the step-to-zero branch).
 *       – MARIO_Y at or above the limit: reload the counter to 0xFF and reset the
 *         state (+0x0D) to 0.
 *
 * The three ROM join points (loc_32F8 "still counting / reloaded", loc_3303 "clear
 * both exit fields", loc_330B "tick ROM 0x330F") are written inline where reached.
 *
 * The record pointer is not modified and nothing consumes a return value, so this
 * is void.
 *
 * Memory-equivalent to the frozen oracle — equivalence-32d6.test.js.
 * GATE:     crafted-entry. 0x32D6 hangs off the entry_3202 chain and is never
 *           dispatched during attract (re-derived: 0 in 2500 frames), so the gate is a
 *           real attract-base machine with surgical pokes covering all five exit
 *           paths, crossed with tickFireTimerAndRerollDirection's own timer/random arms. Teeth: a twin that
 *           reads a stale zero-test and so never takes the counter's hit-zero branch.
 *           ★ CORRECTION: an earlier version of this line called the entry_3202 chain
 *           "(untranslated)". It is not -- ROM 0x3202 has both a frozen oracle
 *           (translated/loc_3202.js) and a readable twin (idiomatic/loc_3202.js), and is
 *           itself dispatched 481x in those same 2500 frames. What is true is only that
 *           no attract path reaches THIS routine through it.
 * LIVE-OUT: memory-only. The oracle's residual registers/flags and its terminal
 *           return are dead ABI; the record pointer is unchanged.
 * NAMES:    MARIO_Y (0x6205) from names.js. The touched record fields at pointer+0x0D,
 *           +0x0F, +0x19, +0x1C, +0x1D are object-record offsets with no names.js name
 *           (the record layout is not yet named) — reported for the lead. tickFireTimerAndRerollDirection
 *           (ROM 0x330F) is direct-called; it reads the same record pointer, so no
 *           register marshalling is needed.
 */

import { MARIO_Y, OBJ_STATE } from "./names.js";
import { tickFireTimerAndRerollDirection } from "./tickFireTimerAndRerollDirection.js"; // ROM 0x330F — tick the object's periodic timer

// Object-record field offsets (relative to the live-in record pointer). Unnamed in
// names.js; kept as local offsets, mirroring tickFireTimerAndRerollDirection's TIMER/STATE.
const DWELL_COUNTER = 0x1c; // interval down-counter; reloads to 0xFF on the pass gate
const ARM_FLAG = 0x1d;      // == 1 arms the position-compare branch; then disarmed
const LIMIT_FIELD = 0x0f;   // compared against MARIO_Y (borrow => below)
const EXIT_FIELD_19 = 0x19; // cleared to 0 alongside the counter on the tick-out branches

export function loc_32d6(m) {
  const { mem } = m;
  const record = m.regs.ix;
  const at = (off) => (record + off) & 0xffff;

  // Clear the two exit fields, then tick the object's periodic timer. This is the
  // ROM's loc_3303 -> loc_330B join (the `call 0x330f` dissolves to a direct call).
  const clearExitAndTick = () => {
    mem.write8(at(EXIT_FIELD_19), 0);
    mem.write8(at(DWELL_COUNTER), 0);
    tickFireTimerAndRerollDirection(m);
  };

  const counter = mem.read8(at(DWELL_COUNTER));
  if (counter !== 0) {
    // Counter still armed: step it down.
    const dec = (counter - 1) & 0xff;
    mem.write8(at(DWELL_COUNTER), dec);
    if (dec !== 0) {
      // loc_32F8 — still counting: reset the state and stop.
      mem.write8(at(OBJ_STATE), 0);
      return;
    }
    // Stepped to zero: fall into the clear-and-tick exit (loc_3303).
    clearExitAndTick();
    return;
  }

  // Counter already zero.
  if (mem.read8(at(ARM_FLAG)) !== 1) {
    // Not armed — go straight to the periodic-timer tick (loc_330B).
    tickFireTimerAndRerollDirection(m);
    return;
  }

  // Armed: disarm, then compare MARIO_Y against the object's limit.
  mem.write8(at(ARM_FLAG), 0);
  if (mem.read8(MARIO_Y) < mem.read8(at(LIMIT_FIELD))) {
    // Below the limit (borrow): clear the exit fields and tick.
    clearExitAndTick();
    return;
  }

  // At or above the limit: reload the counter and reset the state.
  mem.write8(at(DWELL_COUNTER), 0xff);
  mem.write8(at(OBJ_STATE), 0);
}
