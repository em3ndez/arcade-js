// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_32d6 — an object's interval down-counter with a position-gated reload, then a periodic-timer
 * tick.
 *
 * Services one object record, whose pointer arrives in a register. It runs a down-counter in record
 * field +0x1C:
 *
 *   • While the counter is still counting — nonzero, and its decrement does not reach zero — the
 *     whole routine is: step it down and reset the object's state field (+0x0D) to 0. Nothing else.
 *   • On the pass that steps it TO zero, OR when the counter is already zero and the object is NOT
 *     armed (+0x1D != 1), it clears the object's two exit fields (+0x19 and +0x1C, on the
 *     step-to-zero arm) and ticks the object's periodic timer.
 *   • When the counter is already zero AND the object IS armed (+0x1D == 1), it disarms and compares
 *     MARIO_Y against the object's limit field (+0x0F):
 *       – MARIO_Y numerically below the limit (the compare borrows): clear both exit fields and
 *         tick, exactly as the step-to-zero arm does.
 *       – MARIO_Y at or above it: reload the counter to 0xFF and reset the state field to 0.
 *
 * So the ONLY thing that keeps the counter alive is Mario's position at the moment it runs out;
 * every other path drains it and hands the object on to its periodic timer.
 *
 * WHY THE NAME IS STILL AN ADDRESS. The control flow is fully pinned by the body, but the record
 * fields it turns on carry no shared names, and what the armed flag at +0x1D actually ARMS is not
 * derivable here.
 *
 * Reads: the record's +0x1C, +0x1D and +0x0F, and MARIO_Y. Writes: the record's +0x1C, +0x1D, +0x19
 * and +0x0D, plus whatever the periodic tick writes.
 * LIVE-OUT: memory-only. The record pointer is unchanged and nothing consumes a return value.
 */

import { MARIO_Y, OBJ_STATE } from "./names.js";
import { tickFireTimerAndRerollDirection } from "./tickFireTimerAndRerollDirection.js";

// Object-record field offsets, relative to the record pointer that arrives in a register.
// None of them carries a shared cell name, so they stay local offsets.
const DWELL_COUNTER = 0x1c; // interval down-counter; reloads to 0xFF on the pass gate
const ARM_FLAG = 0x1d;      // == 1 arms the position-compare branch; then disarmed
const LIMIT_FIELD = 0x0f;   // compared against MARIO_Y (borrow => below)
const EXIT_FIELD_19 = 0x19; // cleared to 0 alongside the counter on the tick-out branches

export function loc_32d6(m) {
  const { mem } = m;
  const record = m.regs.ix;
  const at = (off) => (record + off) & 0xffff;

  // Clear the two exit fields, then tick the object's periodic timer. Three of the arms below
  // converge here.
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
      // Still counting: reset the state and stop.
      mem.write8(at(OBJ_STATE), 0);
      return;
    }
    // Stepped to zero: fall into the clear-and-tick exit.
    clearExitAndTick();
    return;
  }

  // Counter already zero.
  if (mem.read8(at(ARM_FLAG)) !== 1) {
    // Not armed — go straight to the periodic-timer tick, leaving the exit fields alone.
    tickFireTimerAndRerollDirection(m);
    return;
  }

  // Armed: disarm, then compare MARIO_Y against the object's limit.
  mem.write8(at(ARM_FLAG), 0);
  if (mem.read8(MARIO_Y) < mem.read8(at(LIMIT_FIELD))) {
    // Numerically below the limit (the compare borrows): clear the exit fields and tick.
    clearExitAndTick();
    return;
  }

  // At or above the limit: reload the counter and reset the state.
  mem.write8(at(DWELL_COUNTER), 0xff);
  mem.write8(at(OBJ_STATE), 0);
}
