// SPDX-License-Identifier: GPL-3.0-only
import { ACTIVE_OBJECT_TYPE } from "./names.js";
/**
 * loc_618a — the shared "give up on this object" exit for the actor / collision handlers.
 *
 * ROM address: 0x618a. Grounding tag: [seen].
 *
 * WHAT IT IS
 * Each frame the machine runs a bank of per-record collision and record-matching passes over the
 * enemy and object tables. While one of those passes is working, ACTIVE_OBJECT_TYPE (0x8d44) is the
 * scratch byte that names WHICH object this pass currently owns: the hit-resolution and sound-
 * dispatch code around 0x611f..0x6190 read it to pick their branch — value 3 selects the main hit
 * path, and a non-3 value routes to the "enqueue a miss sound" branch. This routine is the common
 * tail those handlers fall into once they have decided to abandon the object they were handling —
 * dispatchHitToEnemyRecordElseQueueSound (0x611f) after it hands a projectile hit to a matched
 * enemy record, and resetActorRecordQueueSoundAndAbortFrame (0x6166) / engageMatchedSpriteObject-
 * AndResetActor (0x6190) after they reset the struck actor record. It clears the selector and bows
 * out of the whole handler.
 *
 * ROLE IN THE MACHINE — the double unwind
 * Reaching this routine does NOT resume the code that reached it. It does two things: it wipes
 * ACTIVE_OBJECT_TYPE back to 0, then it returns ONE FRAME FURTHER UP the call chain than an
 * ordinary return would. The immediate caller's own return address is dropped off the stack, so
 * control lands not back in that caller but in the caller's caller. The practical effect is that any
 * handler which lands here is aborted along with the object it handles: its remaining work is
 * skipped, and it is the routine that invoked that handler which resumes. This is how a single
 * "this object is done — stop processing it and move on" decision, made deep inside a hit handler,
 * tears down the current pass in one step instead of threading a status flag back through every
 * layer.
 *
 * ENTRY / EXITS
 * It is reached both by a direct call and by a jump from the adjacent handler code (near 0x619d),
 * and it calls nothing itself.
 *
 * LIVE-OUT: ACTIVE_OBJECT_TYPE (0x8d44) cleared to 0, and the boolean signal — always false,
 * because the abort is the only path through here. No register value is meant to survive the skip.
 */
export function loc_618a(m) {
  // Release the active-object selector (0x8d44): the object this pass had claimed is abandoned,
  // so the next per-frame collision/record pass starts fresh with no type latched — and the type-3
  // special-case branch in the hit/sound dispatch is no longer selected until a new object claims it.
  m.mem8[ACTIVE_OBJECT_TYPE] = 0x00;
  // Abort the frame: control unwinds one level past the immediate caller, so the handler that
  // reached here does not continue and its caller's caller resumes instead. The false is the outward
  // signal that this object is given up on — the abort path, which is the only outcome this tail has.
  return false; // give-up tail: the caller's frame is skipped, not resumed
}
