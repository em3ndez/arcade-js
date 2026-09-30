// SPDX-License-Identifier: GPL-3.0-only
/** endApproachNow — zero the countdown byte inside the record a caller points at: one store, to the
 * fifth byte of that record. What the countdown gates is not decided here. LIVE-OUT: memory.
 *
 * ROM 0x41EC-0x41F0 (lift: translated/loc_41ec.js — `ld (ix+0x04),0x00 / ret`). Grounding: [seen].
 *
 * Role in the machine: an object that is flying in toward a point near the player's ship holds a
 * delay in its record at +0x04. Its only caller, flyTowardShipStandoffThenEndApproach, re-aims the
 * record at that point every sixteenth frame and calls here only once BOTH axis distances to it are
 * under 16 — so the trigger is arrival, not a timer. Zeroing the countdown makes the record's
 * handler (stepSlotApproachThenBreakawayRetire, 0x4194, which reads it) take its expired arm on
 * the next frame instead of counting out the rest of the delay. The only path in requires era 4.
 *
 * `record` carries the object's record address (the ROM's IX).
 */

import { u16 } from "../../../core/int.js";

// The countdown's offset inside the object record (+0x04 in the ROM's `ld (ix+0x04),0x00`).
const COUNTDOWN_IN_RECORD = 4;

export function endApproachNow(m, record = m.regs.ix) {
  // The single store. Under MAME the countdown was non-zero on every dispatch, so this cuts a live
  // delay short rather than restating a zero. The address wraps at 16 bits like the Z80's IX+d.
  m.mem8[u16(record + COUNTDOWN_IN_RECORD)] = 0;
}
