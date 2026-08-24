// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { initActorRecord } from "./initActorRecord.js";
import { dispatchHitToEnemyRecordElseQueueSound } from "./dispatchHitToEnemyRecordElseQueueSound.js";
import { OBJ_HIT_FLAG_I0, OBJ_HIT_FLAG_I1 } from "./names.js";
/**
 * markHitFlagSeedActorAndScanEnemyRecords — mark a fresh hit-flag slot, seed its actor record, then run the record scan.
 *
 * Marks the interrupt-parity hit-flag slot active (the odd-parity slot, or the even one
 * when the interrupt register is zero), stamps the opening state into the fresh actor
 * record at HL, then backs the pointer up to the record's tag and runs the scan that finds
 * the matching enemy record.
 *
 * LIVE-OUT: a boolean forwarded from the scan — false aborts the caller's frame, true is
 * the normal continuation. No register survives.
 */
const RECORD_INIT_VALUE = (0x04 << 8) | 0x04; // little-endian datum stamped at rec+0x16/+0x17
const SCAN_BACKUP = u16(-3); // backs the pointer from rec+0x17 down to the tag at rec+0x14

export function markHitFlagSeedActorAndScanEnemyRecords(m, rec = m.regs.hl, ireg = m.regs.i) {
  const { mem8 } = m;
  mem8[ireg !== 0 ? OBJ_HIT_FLAG_I1 : OBJ_HIT_FLAG_I0] = 0x01;
  const advanced = initActorRecord(m, rec, RECORD_INIT_VALUE);
  return dispatchHitToEnemyRecordElseQueueSound(m, advanced, SCAN_BACKUP);
}
