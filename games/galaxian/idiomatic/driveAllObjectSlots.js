// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveAllObjectSlots (ROM 0x0cc3) -- per-frame driver of all eight enemy object slots.
 *
 * WHAT IT IS
 *   The outer walk of the object state machine. Galaxian's diving aliens live in eight object records
 *   beginning at SPRITE_SOURCE_OBJ_BASE (0x42b0) on a 32-byte stride. Once per frame this routine visits
 *   each record in turn and hands it to driveObjectSlot, which reads that record's flags and state index
 *   and runs the appropriate object-AI handler (dying-animation handoff, inactive skip, or the
 *   state-indexed handler). This routine itself only owns the loop -- pointer advance across the slots.
 *
 * ROLE IN THE MACHINE
 *   Runs from the sequence/gameplay per-frame subsystem updates (e.g. dwellThenAdvanceSequence and the
 *   play pipeline). The same eight records are separately projected to the sprite shadow by
 *   stageObjectsToSpriteShadow; here they are advanced as AI actors, not drawn. driveObjectSlot returns
 *   per slot, so the loop simply steps the record base forward by the stride.
 *
 * Grounding: [seen] (names.js cert for 0x0cc3; subsystem in mechanisms.md "The object-AI driver").
 *
 * LIVE-OUT: none of interest -- the effect is whatever the eight per-slot handlers wrote into the records
 *   and shared tables; this routine returns nothing meaningful.
 */
import { SPRITE_SOURCE_OBJ_BASE } from "./names.js";
import { driveObjectSlot } from "./driveObjectSlot.js";

// Eight object records, 32 bytes each -- the fixed geometry of the object pool.
const SLOT_COUNT = 8;
const SLOT_STRIDE = 0x20; // bytes per object record

export function driveAllObjectSlots(m) {
  // Start at the first object record and walk forward one 32-byte record per iteration.
  let rec = SPRITE_SOURCE_OBJ_BASE;
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    // Drive this one record through the object dispatcher; it self-selects dying/inactive/state-handler.
    driveObjectSlot(m, rec); // drive one slot: dying-anim handoff / inactive skip / state handler
    rec += SLOT_STRIDE; // 8 object slots, well under the 16-bit wrap
  }
}
