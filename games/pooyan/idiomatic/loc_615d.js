// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { engageMatchedSpriteObjectAndResetActor } from "./engageMatchedSpriteObjectAndResetActor.js";
import { resetActorRecordQueueSoundAndAbortFrame } from "./resetActorRecordQueueSoundAndAbortFrame.js";
/**
 * loc_615d — scan up to `count` actor records for one whose tag matches A.
 *
 * Walks records from IX in DE-sized strides, comparing A against each record's +0x14 tag.
 * The first match is handed on to be marked engaged; if none match within `count` records
 * the actor record is reset. Both continuations end by aborting the caller's frame.
 *
 * LIVE-OUT: none of its own; returns the continuation's boolean (always false).
 */
const TAG_FIELD = 0x14;

export function loc_615d(m, a = m.regs.a, ix = m.regs.ix, de = m.regs.de, count = m.regs.b) {
  const { mem8 } = m;
  let rec = ix;
  for (let n = count === 0 ? 256 : count; n > 0; n--) { // count 0 wraps to 256 (djnz)
    if (a === mem8[u16(rec + TAG_FIELD)]) return engageMatchedSpriteObjectAndResetActor(m, rec); // match -> engage
    rec = u16(rec + de);
  }
  return resetActorRecordQueueSoundAndAbortFrame(m); // no match -> reset the actor record
}
