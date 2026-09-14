// SPDX-License-Identifier: GPL-3.0-only
import { SLOT_LOOP_INDEX, OBJ_DEPTH, loc_9e, loc_10f, loc_110, loc_113 } from "./names.js";
import { projectAllLanesThroughMathbox } from "./projectAllLanesThroughMathbox.js";
import { snapCoordUpToReference } from "./snapCoordUpToReference.js";
import { drawFramedCounterSlot } from "./drawFramedCounterSlot.js";
import { drawGatedRecordLoop } from "./drawGatedRecordLoop.js";
import { emitBlankVectorWordTag70 } from "./emitBlankVectorWordTag70.js";
import { emitTaggedVectorWord } from "./emitTaggedVectorWord.js";

// First-time setup seeds two counters through the integrator (nudging the low one when
// it lags), always emits a header, and returns unless both counters are live; then it
// clears the record slots and draws each counter's record set.
export function initAndDrawRimDepthCounters(m) {
  const { mem8 } = m;
  if (mem8[loc_110] === 0) {
    mem8[OBJ_DEPTH] = 0xf0;
    const first = projectAllLanesThroughMathbox(m, 0xf0, 0x4f);
    mem8[loc_110] = first;
    if (first !== 0) mem8[loc_10f] = first;
    if (mem8[loc_10f] === 0) {
      mem8[OBJ_DEPTH] = 0x10;
      snapCoordUpToReference(m);
      mem8[loc_10f] = projectAllLanesThroughMathbox(m, mem8[OBJ_DEPTH], 0x0f);
    }
  }
  emitBlankVectorWordTag70(m, 0x01);
  mem8[loc_9e] = 0x06;
  if (mem8[loc_110] !== 0) return;
  if (mem8[loc_113] === 0) return;
  // Clear the record slots two indices per pass (the callee steps the index too).
  let slot = 0x0f;
  do {
    drawFramedCounterSlot(m, slot, 0xc0);
    slot = (mem8[SLOT_LOOP_INDEX] - 1) & 0xff;
  } while ((slot & 0x80) === 0);
  mem8[loc_9e] = 0x06;
  emitTaggedVectorWord(m, 0x08, 0x06);
  drawGatedRecordLoop(m, mem8[loc_110], 0x4f);
  return drawGatedRecordLoop(m, mem8[loc_10f], 0x0f);
}
