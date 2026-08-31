// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { retireResetOrEngageObjectRecord } from "./retireResetOrEngageObjectRecord.js";
import { queueSoundCommand05 } from "./queueSoundCommand05.js";
import { ENEMY_ACTOR_TABLE, ACTIVE_OBJECT_TYPE } from "./names.js";
/**
 * dispatchHitToEnemyRecordElseQueueSound — collision resolver that matches a landed
 * projectile against the enemy actor pool and routes the outcome.
 *
 * WHAT IT IS
 *   When a shot lands, the game needs to decide *which* enemy (if any) it struck. Every
 *   enemy occupies a fixed-size record in the enemy actor pool, and each record carries a
 *   one-byte collision tag at +0x14 that identifies it. This routine takes the tag the
 *   projectile is carrying, looks for the enemy record whose tag matches, and dispatches
 *   accordingly:
 *     - a matching record is handed to the matched-record handler, which retires / resets /
 *       engages that enemy and always unwinds the caller so no further per-frame work runs;
 *     - a clean miss means the shot hit nothing catchable, so a fixed sound effect is
 *       queued (the "shot went nowhere" cue) — except while the active object type is 3,
 *       a mode in which that cue is suppressed and control simply continues.
 *
 *   ROLE IN THE MACHINE: the final adjudication step of the projectile-collision pipeline
 *   (see mechanisms.md "Collision"). Upstream passes compute overlaps and stamp the hit tag;
 *   this routine turns that tag into a concrete "which enemy, do what" decision.
 *
 *   ROM: 0x611f (0x611f-0x613c).
 *   Grounding: [seen]
 *
 * INPUTS
 *   hl, de — a base pointer and an offset; the collision key is the byte living at hl+de.
 *
 * LIVE-OUT
 *   Returns a boolean the caller uses as continue/abort:
 *     - false when a record matched — the matched-record handler has torn down / re-armed
 *       that enemy and unwound the frame, so the caller must stop;
 *     - true on the no-match normal return (sound queued, or suppressed for object type 3),
 *       telling the caller to continue.
 *   No memory beyond the sound-command ring is written here; the callers read no register back.
 */
const TAG_FIELD = 0x14;       // per-record collision-tag byte: record's identity for hit matching
const SCAN_STRIDE = 0x18;     // enemy actor records are 0x18 bytes apart in the pool
const SCAN_COUNT = 0x06;      // this collision pass considers the first six enemy records
const OBJECT_TYPE_QUIET = 0x03; // ACTIVE_OBJECT_TYPE value under which the miss cue is suppressed

export function dispatchHitToEnemyRecordElseQueueSound(m, hl = m.regs.hl, de = m.regs.de) {
  const { mem8 } = m;
  // Fetch the collision key. HL is a base pointer and DE an offset into it; the byte at
  // hl+de is the tag the landed projectile carries and the value we hunt for in the pool.
  const key = mem8[u16(hl + de)];
  // Walk the enemy actor pool from its base (0x8ae0). `rec` is the address of the record
  // currently under inspection; it advances by SCAN_STRIDE each iteration.
  let rec = ENEMY_ACTOR_TABLE;
  for (let n = 0; n < SCAN_COUNT; n++) {
    // Compare the key against this record's collision tag at +0x14. The first record whose
    // tag equals the key is the enemy the shot resolves to: hand it to the matched-record
    // handler (retire / reset / engage), which unwinds the caller frame and reports false.
    if (key === mem8[u16(rec + TAG_FIELD)]) return retireResetOrEngageObjectRecord(m, rec); // match: handler aborts the frame
    // No match here — step to the next record, one 0x18-byte stride further into the pool.
    rec = u16(rec + SCAN_STRIDE);
  }
  // Fell through all six records: the shot matched no enemy. While the active object type
  // (0x8d44) is already 3, the miss cue is intentionally silent — continue without a sound.
  if (mem8[ACTIVE_OBJECT_TYPE] === OBJECT_TYPE_QUIET) return true; // no match, type already 3: continue
  // Clean miss in any other mode: enqueue the fixed sound command (0x05) into the sound ring
  // as the "shot hit nothing" audio cue.
  queueSoundCommand05(m); // no match: enqueue the fixed sound command
  // Normal continuation: nothing was struck, so the caller proceeds with its frame.
  return true; // normal continuation
}
