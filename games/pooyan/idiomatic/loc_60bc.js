// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { initActorRecord } from "./initActorRecord.js";
import { loc_611f } from "./loc_611f.js";
import { queueSoundCommand09 } from "./queueSoundCommand09.js";
import {
  ENEMY_ACTOR_TABLE,
  ACTIVE_OBJECT_TYPE,
  ENEMY_TARGET_REC0,
  ENEMY_TARGET_REC1,
  OBJ_HIT_FLAG_I0,
  OBJ_HIT_FLAG_I1,
} from "./names.js";
/**
 * loc_60bc — tail of the hit handler: match an enemy record by tag, then either engage the
 * struck target pair or seed a fresh actor record and scan.
 *
 * Scans the enemy-actor table (stride 0x18, up to six records) for a record whose +0x14 tag
 * equals the key. On a match whose state byte +0x16 has bit1 set while the active object type is
 * not 3, it flags the interrupt-parity target-record pair active (+0x01 and +0x07) and enqueues
 * the fixed sound command, then aborts the caller's frame. Every other outcome (no match, bit1
 * clear, or type 3) backs the pointer up to the record base, marks the interrupt-parity hit-flag
 * slot active, seeds a fresh actor record, and enters the record finder.
 *
 * LIVE-OUT: a boolean — false aborts the caller's frame (the skip path, and a matched finder),
 * true is the finder's normal continuation. No register survives.
 */
const SCAN_STRIDE = 0x18;
const SCAN_COUNT = 0x06;
const TAG_FIELD = 0x14;
const STATE_FIELD = 0x16;
const STATE_BIT1 = 0x02;
const OBJECT_TYPE_ENGAGED = 0x03;
const RECORD_BACKUP = u16(-0x14); // undo the caller's +0x14 advance, back to the record base
const RECORD_INIT_VALUE = (0x04 << 8) | 0x04; // little-endian datum stamped at rec+0x16/+0x17
const SCAN_BACKUP = u16(-3); // from the seeded pointer (rec+0x17) down to the tag at rec+0x14

export function loc_60bc(m, hl = m.regs.hl, key = m.regs.a, ireg = m.regs.i) {
  const { mem8 } = m;

  let rec = ENEMY_ACTOR_TABLE;
  for (let n = 0; n < SCAN_COUNT; n++, rec = u16(rec + SCAN_STRIDE)) {
    if (key !== mem8[u16(rec + TAG_FIELD)]) continue; // no match at this record
    const bit1Set = (mem8[u16(rec + STATE_FIELD)] & STATE_BIT1) !== 0;
    if (bit1Set && mem8[ACTIVE_OBJECT_TYPE] !== OBJECT_TYPE_ENGAGED) {
      const target = ireg !== 0 ? ENEMY_TARGET_REC1 : ENEMY_TARGET_REC0;
      mem8[u16(target + 0x01)] = 0x01;
      mem8[u16(target + 0x07)] = 0x01;
      queueSoundCommand09(m); // enqueue the fixed sound command
      return false; // skip path: abort the caller's frame
    }
    break; // matched but not engaged -> main path
  }

  // main path: mark the parity hit-flag slot, seed a fresh actor, then scan
  mem8[ireg !== 0 ? OBJ_HIT_FLAG_I1 : OBJ_HIT_FLAG_I0] = 0x01;
  const advanced = initActorRecord(m, u16(hl + RECORD_BACKUP), RECORD_INIT_VALUE);
  return loc_611f(m, advanced, SCAN_BACKUP);
}
