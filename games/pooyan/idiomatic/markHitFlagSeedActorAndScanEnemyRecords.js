// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { initActorRecord } from "./initActorRecord.js";
import { dispatchHitToEnemyRecordElseQueueSound } from "./dispatchHitToEnemyRecordElseQueueSound.js";
import { OBJ_HIT_FLAG_I0, OBJ_HIT_FLAG_I1 } from "./names.js";
/**
 * markHitFlagSeedActorAndScanEnemyRecords — register a landed hit, birth the record that
 * will carry it, then resolve which enemy the shot struck.
 *
 * WHAT IT IS
 *   The entry point taken when a projectile lands on a catchable target slot. It threads
 *   three collision-bookkeeping jobs together, in order:
 *     1. mark one of the two paired hit-flag cells active — the parity of the Z80 interrupt
 *        register picks which of the two I-parity target slots the hit belongs to;
 *     2. seed a fresh 0x18-byte actor record at the pointer it was handed, stamping the fixed
 *        opening state and a 0x0404 payload into it;
 *     3. back that record pointer up to its collision-tag field and run the enemy-record scan,
 *        which finds the enemy whose tag matches and routes the outcome.
 *
 * ROLE IN THE MACHINE
 *   Part of the projectile-collision pipeline (see mechanisms.md "Collision"). Upstream
 *   proximity passes decide that a shot overlapped a target and stamp the record's tag; this
 *   routine flags that hit for the correct parity slot, brings the record to life, and then
 *   turns the stamped tag into a concrete "which enemy, do what" decision.
 *
 *   ROM: 0x60d9 (0x60d9-0x60f1).
 *   Grounding: [seen]
 *
 * LIVE-OUT
 *   - writes 0x01 into the selected hit-flag cell (0x8d1c when the interrupt register is
 *     nonzero, 0x8d1b when it is zero), marking that slot's hit pending for the frame;
 *   - seeds the head/marker/datum bytes of the fresh actor record at HL (via initActorRecord);
 *   - returns the scan's boolean, forwarded unchanged: false aborts the caller's frame (an
 *     enemy matched and the matched-record handler tore it down / re-armed it and unwound the
 *     frame), true is the normal continuation. No register survives.
 */
// The 16-bit datum stamped into the fresh actor record: 0x0404, stored little-endian across
// rec+0x16 (low byte) and rec+0x17 (high byte) by initActorRecord.
const RECORD_INIT_VALUE = (0x04 << 8) | 0x04;
// The -3 offset that walks the record pointer from where initActorRecord leaves it (rec+0x17)
// back down to the record's collision-tag field at rec+0x14, the key the enemy scan hunts for.
const SCAN_BACKUP = u16(-3);

export function markHitFlagSeedActorAndScanEnemyRecords(m, rec = m.regs.hl, ireg = m.regs.i) {
  const { mem8 } = m;
  // Step 1 — mark the interrupt-parity hit-flag slot active.
  // The two one-frame hit-flag cells OBJ_HIT_FLAG_I0 (0x8d1b) and OBJ_HIT_FLAG_I1 (0x8d1c) are
  // the paired "a hit landed this frame" flags for the two I-parity target slots (they partner
  // the enemy/target records 0x8c90 / 0x8ca8). The Z80 interrupt register carries the parity
  // that alternates the two slots: a nonzero value selects the 0x8d1c slot, zero selects 0x8d1b.
  // Writing 0x01 marks that slot's hit as pending; the target-actor state handler clears the flag
  // and tears the struck object down on a later frame.
  mem8[ireg !== 0 ? OBJ_HIT_FLAG_I1 : OBJ_HIT_FLAG_I0] = 0x01;
  // Step 2 — seed the fresh actor record.
  // Stamp the fixed opening state into the 0x18-byte record whose base is `rec`, carrying the
  // 0x0404 datum (little-endian across rec+0x16/+0x17). initActorRecord leaves the pointer
  // advanced to the last byte it wrote (rec+0x17); that advanced pointer is the base the scan
  // reads from next.
  const advanced = initActorRecord(m, rec, RECORD_INIT_VALUE);
  // Step 3 — back up to the collision tag and run the enemy-record scan.
  // The scan reads its collision key at base+offset. Handing it the advanced pointer (rec+0x17)
  // with SCAN_BACKUP (= -3) points the read at rec+0x14 — the record's collision-tag byte. The
  // scan walks the six enemy records at 0x8ae0 (stride 0x18) for one whose +0x14 tag equals that
  // key: a match diverts to the matched-record handler (retire / reset / engage, which aborts the
  // frame and reports false); a clean miss enqueues the "shot hit nothing" sound cue unless the
  // active object type (0x8d44) is already 3, then reports true. That boolean is returned as-is.
  return dispatchHitToEnemyRecordElseQueueSound(m, advanced, SCAN_BACKUP);
}
