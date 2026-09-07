// SPDX-License-Identifier: GPL-3.0-only
/**
 * dwellThenAdvanceSequence — a pure "hold" step of the attract show.
 *
 * WHAT IT IS
 *   One sub-state of the attract sequence that does no staging of its own — it just runs the shared
 *   per-frame subsystem updates and then ticks the dwell timer that eventually carries the sequence on.
 *
 * ROLE IN THE MACHINE
 *   An RST-28 dispatch target: SEQUENCE_STATE index 7 of the attract loop
 *   (runAttractSequenceAndAdvanceOnCredit's table @0x0164). It runs the four shared subsystem updates every
 *   attract sub-state runs — clear the strided work table, stage objects into the sprite shadow, drive all
 *   object slots, and periodically redraw tile columns — then tail-ticks the prescaled sequence-dwell
 *   timer. That timer (tickPrescaledSequenceTimer, 0x0336) decrements sub-timer 0x4008 each frame; on wrap
 *   it reloads to 60 and cascades a tick into dwell tier 0x4009, which carries into SEQUENCE_STATE (0x400a)
 *   on its own expiry — so this state simply holds until the dwell runs out.
 *
 * ROM 0x028e.  Grounding: [seen].
 *
 * Tail-call shape: the timer tick is returned directly. In the original this was a jp (tail-jump) with the
 *   ret left to the RST-28 dispatch seam; here the `return` hands the seam the same completion.
 */
import { clearStridedTable } from "./clearStridedTable.js";
import { stageObjectsToSpriteShadow } from "./stageObjectsToSpriteShadow.js";
import { driveAllObjectSlots } from "./driveAllObjectSlots.js";
import { redrawTileColumnsPeriodically } from "./redrawTileColumnsPeriodically.js";
import { tickPrescaledSequenceTimer } from "./tickPrescaledSequenceTimer.js";

export function dwellThenAdvanceSequence(m) {
  // The four shared per-frame subsystem updates, run by every attract sub-state.
  clearStridedTable(m);
  stageObjectsToSpriteShadow(m);
  driveAllObjectSlots(m);
  redrawTileColumnsPeriodically(m);

  // Tail-tick the prescaled dwell timer; this is the only thing that can advance the sequence out of the
  // hold. Returned directly so the RST-28 dispatch seam completes the tail-jump.
  return tickPrescaledSequenceTimer(m);
}
