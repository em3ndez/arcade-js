// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { initActorRecord } from "./initActorRecord.js";
import { dispatchHitToEnemyRecordElseQueueSound } from "./dispatchHitToEnemyRecordElseQueueSound.js";
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
 * resolveShotHitEngageOrSeedRecord — tail of the hit handler: resolve a landed shot against the enemy pool and either
 * engage the struck target pair or seed a fresh actor record and re-scan.
 *
 * WHAT IT IS
 *   Control reaches here from the proximity gate (gateEvenRoundOverlapAndRouteHit) the moment a projectile is found to
 *   overlap a record: the gate has advanced its pointer to the record's collision tag and handed
 *   that tag in as the key. This routine turns the hit into a concrete outcome. It walks the
 *   enemy actor pool (0x8ae0, six records a stride 0x18 apart) looking for the enemy that owns
 *   the key, then branches:
 *     - ENGAGE — the key matches an enemy that is in the "grabbable" state (its state byte at
 *       +0x16 has bit1 set) and the machine is not already in the engaged object mode
 *       (ACTIVE_OBJECT_TYPE != 3). It flags the active collision slot's target-record pair
 *       (the +0x01 and +0x07 bytes), plays the fixed capture cue, and aborts the whole per-frame
 *       update so nothing downstream runs this frame.
 *     - MAIN — every other case: the key matched nothing, or matched an enemy that is not
 *       grabbable, or the machine is already engaged. It marks the active collision slot's
 *       one-shot hit flag, brings a fresh enemy record to life, and drops into the record finder
 *       to complete the collision resolution.
 *
 *   Which of the two collision slots this pass services is chosen by the interrupt vector
 *   register (I): a nonzero I selects the odd-parity slot (target record 0x8ca8, hit flag
 *   0x8d1c), a zero I selects the even-parity slot (0x8c90 / 0x8d1b). The collision pass runs
 *   once per parity every frame, so one routine body handles both slots.
 *
 *   ROLE IN THE MACHINE: the resolution tail of the object-proximity collision pass (see
 *   mechanisms.md "The object-proximity collision scan"). The proximity gate ahead of it decides
 *   THAT a hit happened; this routine decides WHAT the hit means — capture the struck target, or
 *   fall through to the enemy-record finder for the ordinary resolution.
 *
 *   ROM: 0x60bc (0x60bc-0x6117).
 *   Grounding: [seen]
 *
 * INPUTS
 *   hl   — the record pointer the gate left advanced to the collision tag (record base + 0x14).
 *   key  — the collision tag to hunt for in the enemy pool (the tag the landed shot carries).
 *   ireg — the interrupt vector register; its zero/nonzero parity picks the collision slot.
 *
 * LIVE-OUT
 *   A boolean the caller reads as continue/abort:
 *     - false when the frame must be unwound — the engage path (target captured + cue queued),
 *       and a main path whose finder matched a record, both stop the caller;
 *     - true on the finder's normal continuation (no enemy record matched the key).
 *   Memory effects: the engage path sets the target pair's +0x01/+0x07 bytes and appends a sound
 *   command; the main path sets the parity hit flag and seeds the fresh actor record. No register
 *   value is meant to be read back.
 */
// Enemy actor records are 0x18 bytes apart; this collision pass considers the first six of them.
const SCAN_STRIDE = 0x18;
const SCAN_COUNT = 0x06;
// Per-record fields the scan reads: +0x14 is the record's collision tag (its identity for hit
// matching), +0x16 its state byte, whose bit1 marks the enemy as currently grabbable.
const TAG_FIELD = 0x14;
const STATE_FIELD = 0x16;
const STATE_BIT1 = 0x02;
// ACTIVE_OBJECT_TYPE value that means the machine is already engaged; the engage branch is taken
// only when the type is NOT this (an already-engaged machine falls through to the main path).
const OBJECT_TYPE_ENGAGED = 0x03;
const RECORD_BACKUP = u16(-0x14); // undo the caller's +0x14 advance, back to the record base
const RECORD_INIT_VALUE = (0x04 << 8) | 0x04; // little-endian datum stamped at rec+0x16/+0x17
const SCAN_BACKUP = u16(-3); // from the seeded pointer (rec+0x17) down to the tag at rec+0x14

export function resolveShotHitEngageOrSeedRecord(m, hl = m.regs.hl, key = m.regs.a, ireg = m.regs.i) {
  const { mem8 } = m;

  // Hunt the enemy actor pool for the record whose collision tag equals the key. `rec` is the
  // address of the record currently under inspection, starting at the pool base and advancing one
  // 0x18-byte stride per iteration; the loop gives up after SCAN_COUNT records.
  let rec = ENEMY_ACTOR_TABLE;
  for (let n = 0; n < SCAN_COUNT; n++, rec = u16(rec + SCAN_STRIDE)) {
    if (key !== mem8[u16(rec + TAG_FIELD)]) continue; // no match at this record
    // Matched an enemy. Engage only when it is grabbable (state byte +0x16 bit1 set); a matched
    // but non-grabbable enemy takes the main path via the break below.
    const bit1Set = (mem8[u16(rec + STATE_FIELD)] & STATE_BIT1) !== 0;
    if (bit1Set && mem8[ACTIVE_OBJECT_TYPE] !== OBJECT_TYPE_ENGAGED) {
      // ENGAGE: capture the struck target. The interrupt-register parity selects which of the two
      // target records (0x8c90 for I==0, 0x8ca8 for I!=0) this pass owns.
      const target = ireg !== 0 ? ENEMY_TARGET_REC1 : ENEMY_TARGET_REC0;
      // Flag the target pair active: +0x01 arms the record and +0x07 marks the catch in progress.
      mem8[u16(target + 0x01)] = 0x01;
      mem8[u16(target + 0x07)] = 0x01;
      queueSoundCommand09(m); // enqueue the fixed sound command (the capture cue)
      return false; // engage path: abort the caller's frame
    }
    break; // matched but not engaged -> main path
  }

  // MAIN path (no match, non-grabbable match, or already-engaged machine).
  // Mark this parity's one-shot collision hit flag (0x8d1c for I!=0, else 0x8d1b) so the object
  // teardown pass will act on the struck slot next frame.
  mem8[ireg !== 0 ? OBJ_HIT_FLAG_I1 : OBJ_HIT_FLAG_I0] = 0x01;
  // Bring a fresh enemy record to life: back HL up 0x14 to the record base (undoing the gate's
  // advance to the tag) and stamp the opening state with datum 0x0404. `advanced` is the pointer
  // the constructor leaves at record base + 0x17.
  const advanced = initActorRecord(m, u16(hl + RECORD_BACKUP), RECORD_INIT_VALUE);
  // Hand off to the enemy-record finder to complete resolution: it re-reads the key from the
  // seeded record's tag (advanced - 3 lands on +0x14) and forwards its continue/abort boolean.
  return dispatchHitToEnemyRecordElseQueueSound(m, advanced, SCAN_BACKUP);
}
