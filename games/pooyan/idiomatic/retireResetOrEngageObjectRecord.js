// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { clearActiveObjectTypeAndAbortHandler } from "./clearActiveObjectTypeAndAbortHandler.js";
import { resetActorRecordQueueSoundAndAbortFrame } from "./resetActorRecordQueueSoundAndAbortFrame.js";
import { scanRecordsForTagEngageElseReset } from "./scanRecordsForTagEngageElseReset.js";
import { ROUND_COUNTER, ACTIVE_OBJECT_TYPE, SPRITE_OBJECT_TABLE } from "./names.js";
/**
 * retireResetOrEngageObjectRecord — the matched-record handler of the projectile-hit path:
 * decide how to dispose of the enemy record a hit just landed on.
 *
 * ROM 0x613d-0x615c. Grounding: [seen].
 *
 * WHAT IT IS
 * ----------
 * When a projectile lands, the hit resolver dispatchHitToEnemyRecordElseQueueSound (0x611f)
 * scans the six enemy records at ENEMY_ACTOR_TABLE (0x8ae0) — stride 0x18 — for the one whose
 * collision key (+0x14) equals the hit, and hands that matched record, addressed by IY, to
 * this routine. The machine keeps its on-screen creatures/objects as banks of fixed-stride
 * records in work RAM: the leading +0x00 byte carries per-record state (bit0 = "this slot is
 * live/armed"), and +0x14 holds the collision key a hit is matched against. This routine is
 * the branch that decides what a struck record's fate is now that it has been named.
 *
 * ROLE IN THE MACHINE — a three-way fork, all arms aborting
 * ---------------------------------------------------------
 * The struck record is disposed of down exactly one of three continuations, and every one of
 * them abandons the caller's whole hit-processing pass for this frame (no further per-record
 * work runs once a hit has been resolved):
 *   1. RETIRE — if the record's +0x00 flag bit0 is clear the slot is not live/armed, so there
 *      is nothing to recycle or engage: fall straight into the give-up tail (clearActiveObjectTypeAndAbortHandler), which
 *      clears the active-object selector and bails.
 *   2. RESET — otherwise, on an odd round (ROUND_COUNTER 0x8907 bit0 set) OR when the active
 *      object type (ACTIVE_OBJECT_TYPE 0x8d44) is not 3, the struck actor record is recycled
 *      to its idle opening layout and a sound is queued.
 *   3. ENGAGE-ELSE-RESET — only when the round is even AND the active object type is 3 does the
 *      hit propagate: the struck record's own +0x14 key becomes the search key, and the six
 *      sprite-object records (SPRITE_OBJECT_TABLE 0x8b70, stride 0x18) are scanned for the
 *      first one carrying that same tag. A match is switched on (engaged); no match falls back
 *      to the same reset as arm 2.
 *
 * LIVE-OUT: none of its own. It forwards to one of the three continuations and returns that
 *   continuation's boolean, which is always false because every arm ends in a frame abort. The
 *   reset/engage tails rewrite record memory and queue a sound; the give-up tail clears
 *   ACTIVE_OBJECT_TYPE — but those effects belong to the tails, not to this routine.
 */
// The collision-key field, at +0x14 in every actor and sprite-object record. Here it is read
// off the struck actor record to become the search key for the sprite-object scan; the scan in
// turn compares it against the same +0x14 field of each candidate.
const TAG_FIELD = 0x14;
// Record stride of the sprite-object bank (SPRITE_OBJECT_TABLE): 0x18 bytes per slot.
const SCAN_STRIDE = 0x18;
// The sprite-object bank holds six slots — the trip count for the tag scan.
const SCAN_COUNT = 0x06;

export function retireResetOrEngageObjectRecord(m, iy = m.regs.iy) {
  const { mem8 } = m;
  // ARM 1 — RETIRE. Read the struck record's +0x00 state byte and test bit0, the "live/armed"
  // flag. If it is clear the slot is not an engaged target, so there is nothing to reset or
  // propagate: hand off to the give-up tail (0x618a), which releases ACTIVE_OBJECT_TYPE and
  // unwinds the frame. The false it returns is forwarded straight out.
  if ((mem8[iy] & 0x01) === 0) return clearActiveObjectTypeAndAbortHandler(m); // flag bit0 clear -> retire the record, forward abort
  // ARM 2a — RESET on an odd round. Read ROUND_COUNTER (0x8907) and test bit0: an odd round
  // takes the plain-recycle path. The struck actor record (IY) is blanked to its idle opening
  // layout, one sound command is queued, and the frame is aborted.
  if ((mem8[ROUND_COUNTER] & 0x01) !== 0) return resetActorRecordQueueSoundAndAbortFrame(m, iy); // odd round -> reset
  // ARM 2b — RESET on the wrong object type. The engage path is reserved for object type 3, so
  // read ACTIVE_OBJECT_TYPE (0x8d44) and, if it is anything else, take the same recycle-and-bail
  // tail as arm 2a rather than propagating the hit to the sprite-object bank.
  if (mem8[ACTIVE_OBJECT_TYPE] !== 0x03) return resetActorRecordQueueSoundAndAbortFrame(m, iy); // wrong type -> reset
  // ARM 3 — ENGAGE-ELSE-RESET (even round AND type 3). The hit propagates: take the struck
  // record's own collision key from +0x14 as the search key that names which sprite object the
  // hit should switch on.
  const a = mem8[u16(iy + TAG_FIELD)];
  // Scan the six sprite-object records (SPRITE_OBJECT_TABLE 0x8b70, stride 0x18) for the first
  // whose +0x14 tag equals that key. A match is engaged — its object switched on — and the hunt
  // stops; a full miss recycles the actor record instead. Both outcomes abort the frame. IY is
  // threaded through unchanged so the scan's reset tail knows which actor record to recycle.
  return scanRecordsForTagEngageElseReset(m, a, SPRITE_OBJECT_TABLE, SCAN_STRIDE, SCAN_COUNT, iy); // iy = actor record, threaded to the scan's reset
}
