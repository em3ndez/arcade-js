// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_613d } from "./loc_613d.js";
import { queueSoundCommand05 } from "./queueSoundCommand05.js";
import { ENEMY_ACTOR_TABLE, ACTIVE_OBJECT_TYPE } from "./names.js";
/**
 * dispatchHitToEnemyRecordElseQueueSound — find the enemy actor record whose tag matches the key at HL+DE.
 *
 * Reads the scan key from the byte at HL+DE, then walks up to six enemy actor records
 * (stride 0x18) looking for the first whose +0x14 tag equals the key. A match is handed
 * to the matched-record handler, which always aborts the caller's frame. With no match a
 * fixed sound command is enqueued unless the active object type is already 3.
 *
 * LIVE-OUT: a boolean — false when the match handler aborts the caller frame, true on the
 * no-match normal return. No register survives; the callers read none back.
 */
const TAG_FIELD = 0x14;
const SCAN_STRIDE = 0x18;
const SCAN_COUNT = 0x06;
const OBJECT_TYPE_QUIET = 0x03;

export function dispatchHitToEnemyRecordElseQueueSound(m, hl = m.regs.hl, de = m.regs.de) {
  const { mem8 } = m;
  const key = mem8[u16(hl + de)];
  let rec = ENEMY_ACTOR_TABLE;
  for (let n = 0; n < SCAN_COUNT; n++) {
    if (key === mem8[u16(rec + TAG_FIELD)]) return loc_613d(m, rec); // match: handler aborts the frame
    rec = u16(rec + SCAN_STRIDE);
  }
  if (mem8[ACTIVE_OBJECT_TYPE] === OBJECT_TYPE_QUIET) return true; // no match, type already 3: continue
  queueSoundCommand05(m); // no match: enqueue the fixed sound command
  return true; // normal continuation
}
