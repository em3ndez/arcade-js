// SPDX-License-Identifier: GPL-3.0-only
import { SLOT_LOOP_INDEX, OBJ_DEPTH, loc_9e, loc_10f, loc_110, loc_113 } from "./names.js";
import { projectAllLanesThroughMathbox } from "./projectAllLanesThroughMathbox.js";
import { snapCoordUpToReference } from "./snapCoordUpToReference.js";
import { drawFramedCounterSlot } from "./drawFramedCounterSlot.js";
import { drawGatedRecordLoop } from "./drawGatedRecordLoop.js";
import { emitBlankVectorWordTag70 } from "./emitBlankVectorWordTag70.js";
import { emitTaggedVectorWord } from "./emitTaggedVectorWord.js";

/**
 * initAndDrawRimDepthCounters -- first-time setup and draw of the rim depth counters. ROM 0xc30d.
 *
 * Role in the machine: the tube's rim carries a pair of depth counters that mark how far the play field
 * extends. This routine lazily projects those two counters into display space the first time they are
 * needed (seeding them through the same mathbox projection the lanes use), then emits the vector records
 * that draw them. It is called from the rim-lane paint pass (paintRimLanes) as its pre-pass.
 *
 * Behavior: if the high counter loc_110 is still zero this is first-time setup. Load OBJ_DEPTH with the
 * far value 0xf0 and project all lanes through the mathbox (projectAllLanesThroughMathbox) to get the
 * far counter; store it into loc_110, and mirror it into the near counter loc_10f when nonzero. If the
 * near counter is still zero it lagged, so nudge it: set OBJ_DEPTH to the near value 0x10, snap it up to
 * the reference (snapCoordUpToReference), and re-project to seat loc_10f. Then always emit a header word
 * (emitBlankVectorWordTag70) and set the record colour loc_9e to 0x06. Bail out unless both counters are
 * live -- return if loc_110 is nonzero (already seated, nothing more to draw this pass) and return if the
 * enable flag loc_113 is zero. Otherwise clear the record slots: loop from index 0x0f calling
 * drawFramedCounterSlot, reading the callee-stepped index back from SLOT_LOOP_INDEX (loc_114) and
 * decrementing, until it goes negative (bit7 set). Reset loc_9e, emit a tagged framing word
 * (emitTaggedVectorWord), and draw each counter's record set via drawGatedRecordLoop -- the far counter
 * loc_110 with limit 0x4f, then tail-return the near counter loc_10f with limit 0x0f.
 *
 * Live-out: the seeded depth counters loc_110/loc_10f, OBJ_DEPTH scratch, the record colour loc_9e, the
 * loop index loc_114, and the emitted vector records for the rim counters. Grounding: [seen].
 */
export function initAndDrawRimDepthCounters(m) {
  const { mem8 } = m;
  if (mem8[loc_110] === 0) {                                     // first-time counter setup
    mem8[OBJ_DEPTH] = 0xf0;                                      // far depth
    const first = projectAllLanesThroughMathbox(m, 0xf0, 0x4f);
    mem8[loc_110] = first;                                       // seat the far counter
    if (first !== 0) mem8[loc_10f] = first;                      // mirror into the near counter
    if (mem8[loc_10f] === 0) {                                   // near counter lagged: nudge it
      mem8[OBJ_DEPTH] = 0x10;                                    // near depth
      snapCoordUpToReference(m);
      mem8[loc_10f] = projectAllLanesThroughMathbox(m, mem8[OBJ_DEPTH], 0x0f);
    }
  }
  emitBlankVectorWordTag70(m, 0x01);                            // always emit the header
  mem8[loc_9e] = 0x06;                                          // record colour
  if (mem8[loc_110] !== 0) return;                              // already seated -- nothing to draw
  if (mem8[loc_113] === 0) return;                              // counters disabled
  // Clear the record slots two indices per pass (the callee steps the index too).
  let slot = 0x0f;
  do {
    drawFramedCounterSlot(m, slot, 0xc0);
    slot = (mem8[SLOT_LOOP_INDEX] - 1) & 0xff;                  // read back the callee-stepped index
  } while ((slot & 0x80) === 0);                               // until it goes negative
  mem8[loc_9e] = 0x06;
  emitTaggedVectorWord(m, 0x08, 0x06);
  drawGatedRecordLoop(m, mem8[loc_110], 0x4f);                 // far counter's record set
  return drawGatedRecordLoop(m, mem8[loc_10f], 0x0f);          // near counter's record set (tail)
}
