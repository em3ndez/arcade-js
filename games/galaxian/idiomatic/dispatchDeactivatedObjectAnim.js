// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchDeactivatedObjectAnim (ROM 0x10e4) -- the deactivated/dying-object animation sub-state
 * dispatcher.
 *
 * WHAT IT IS
 *   An object record (base pointer in IX) carries a one-byte animation sub-state at offset +2. This
 *   reads that field and vectors to the matching per-phase handler. In the ROM the vector is an rst-28
 *   table jump with no continuation pushed, so it is a tail-dispatch: the selected handler's own return
 *   returns to THIS routine's caller, not back here.
 *
 * ROLE IN THE MACHINE
 *   Runs the multi-frame death/deactivation animation of a downed enemy object. The four sub-states
 *   step in sequence:
 *     0 -> armObjectAnimAndRequestSound   -- kick off the animation and request its sound cue
 *     1 -> tickDeactivatedObjectAnim      -- advance the animation frame by frame
 *     2 -> endObjectAnimOnTimerExpiry     -- retire the object once its timer runs out
 *     3 -> noopAnimDispatchSlot           -- the spent/idle slot (does nothing)
 *   Reads only the object record's +2 sub-state byte; the handler does the real work.
 *
 * ROM 0x10e4.  Grounding: [seen] (names.js cert for 0x10e4).
 *
 * LIVE-OUT: whatever the selected phase handler leaves.
 */
import { u16 } from "../../../core/int.js";
import { armObjectAnimAndRequestSound } from "./armObjectAnimAndRequestSound.js";
import { tickDeactivatedObjectAnim } from "./tickDeactivatedObjectAnim.js";
import { endObjectAnimOnTimerExpiry } from "./endObjectAnimOnTimerExpiry.js";
import { noopAnimDispatchSlot } from "./noopAnimDispatchSlot.js";

// Object-record field offset: the animation sub-state index (0..3) that selects the handler.
const SUBSTATE = 2;

export function dispatchDeactivatedObjectAnim(m, record = m.regs.ix) {
  // u16 wraps the +2 add into a 16-bit address; the byte there is the sub-state selector.
  switch (m.mem8[u16(record + SUBSTATE)]) {
    case 0:
      // Phase 0: start the death animation and enqueue its sound.
      return armObjectAnimAndRequestSound(m, record);
    case 1:
      // Phase 1: tick the running animation one frame.
      return tickDeactivatedObjectAnim(m, record);
    case 2:
      // Phase 2: end the animation and free the object when its timer expires.
      return endObjectAnimOnTimerExpiry(m, record);
    case 3:
      // Phase 3: spent slot -- deliberately does nothing.
      return noopAnimDispatchSlot(m, record);
  }
}
