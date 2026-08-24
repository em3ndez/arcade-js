// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_618a } from "./loc_618a.js";
import { resetActorRecordQueueSoundAndAbortFrame } from "./resetActorRecordQueueSoundAndAbortFrame.js";
import { loc_615d } from "./loc_615d.js";
import { ROUND_COUNTER, ACTIVE_OBJECT_TYPE, SPRITE_OBJECT_TABLE } from "./names.js";
/**
 * loc_613d — matched-record handler: pick how to retire the record IY points at.
 *
 * If the record's +0 flag bit0 is clear it is retired at once. Otherwise, while the round
 * is odd or the active object type is not 3, the actor record is reset. When both hold, A
 * takes the record's +0x14 tag and a six-record scan of the sprite object table runs to
 * engage the first matching target. Every branch ends by aborting the caller's frame.
 *
 * LIVE-OUT: none of its own; returns the chosen continuation's boolean (always false).
 */
const TAG_FIELD = 0x14;
const SCAN_STRIDE = 0x18;
const SCAN_COUNT = 0x06;

export function loc_613d(m, iy = m.regs.iy) {
  const { mem8 } = m;
  if ((mem8[iy] & 0x01) === 0) return loc_618a(m); // flag bit0 clear -> retire the record, forward abort
  if ((mem8[ROUND_COUNTER] & 0x01) !== 0) return resetActorRecordQueueSoundAndAbortFrame(m, iy); // odd round -> reset
  if (mem8[ACTIVE_OBJECT_TYPE] !== 0x03) return resetActorRecordQueueSoundAndAbortFrame(m, iy); // wrong type -> reset
  const a = mem8[u16(iy + TAG_FIELD)];
  return loc_615d(m, a, SPRITE_OBJECT_TABLE, SCAN_STRIDE, SCAN_COUNT);
}
