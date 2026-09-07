// SPDX-License-Identifier: GPL-3.0-only
/**
 * commitQueueWriteHead -- persist the advanced command-queue write head, then return via the shared
 * stack epilogue.
 *
 * WHAT IT IS
 *   The store-back step of an enqueue. Handlers rarely draw or make sound inline; instead they append a
 *   16-bit channel/parameter word to a small ring buffer whose body lives at 0x40c0-0x40ff. After a word
 *   is written, the advanced write-head index must be saved so the next enqueue lands on the following
 *   slot. This routine writes that head (default: register A) into loc_40a0, then tail-calls loc_090b, the
 *   shared stack epilogue that restores the caller's saved HL and returns.
 *
 * ROLE IN THE MACHINE
 *   The commit half of enqueueCommandWord: that routine stores the two bytes into the current
 *   free slot, advances and floors the head, and this persists the head back to loc_40a0. Through this one
 *   path every deferred draw and sound cue -- HUD redraws, message columns, score-field clears, spawn cues,
 *   board-start sounds -- reaches the per-frame queue drain (decodeDisplayListSlotAndDispatch).
 *
 * ROM 0x0908.  Grounding: [seen].
 *
 * LIVE-OUT: loc_40a0 (queue write head) := head; then loc_090b restores HL and performs the RET.
 */
import { loc_090b } from "./loc_090b.js";
import { loc_40a0 } from "./names.js";

export function commitQueueWriteHead(m, head = m.regs.a) {
  const { mem8 } = m;
  // Save the advanced write-head index so the next enqueue targets the next queue slot.
  mem8[loc_40a0] = head;
  // Chain to the shared epilogue: it pops the caller's saved HL and returns.
  return loc_090b(m);
}
