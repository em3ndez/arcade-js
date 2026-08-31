// SPDX-License-Identifier: GPL-3.0-only
import { classifyAndRouteObjectRecordByRound } from "./classifyAndRouteObjectRecordByRound.js";
import {
  ENEMY_TARGET_REC0,
  ENEMY_TARGET_REC1,
  ACTIVE_OBJECT_TYPE,
  SPRITE_OBJECT_TABLE,
  SPRITE_SCAN_ACTOR_SLOTS,
} from "./names.js";
/**
 * latchObjectTypeAndEnterProximityScan — arm and enter the object-record proximity scan for one target slot.
 *
 * WHAT IT IS
 *   The per-slot arming stage of Pooyan's object-proximity collision scan. Each frame the
 *   master actor updater fires this scan twice, once per target box; resolveObjectProximityHitsBothSlots
 *   (ROM 0x602f) calls in here once for the I=0 box and once for the I!=0 box. This routine
 *   handles exactly ONE box: it decides whether there is anything live in that box worth
 *   testing, records what kind of object it is, and then hands off to the record walk.
 *
 * ROLE IN THE MACHINE
 *   Collision in Pooyan is a bank of proximity sweeps that read and rewrite the actor/target
 *   coordinate records; nothing is returned up the pipeline except a "keep going / abort this
 *   frame's remaining boxes" boolean. This is the front door of one such sweep. The two boxes
 *   it selects between are the 2-entry, I-parity enemy/target record pair: ENEMY_TARGET_REC0
 *   (0x8c90) for the I=0 slot and ENEMY_TARGET_REC1 (0x8ca8, = 0x8c90 + 0x18) for the other.
 *   Each record's lead byte carries the slot's presence/state in its low bits (it cycles 0..3):
 *   0 means the box is empty and 3 means the object there is already engaged/hit-in-progress —
 *   both are inert this pass. Any other value is a live object: its kind is latched as the
 *   active object type and the record walk begins.
 *
 *   ROM 0x6048-0x6068.
 *   Grounding: [seen].
 *
 * LIVE-OUT
 *   ACTIVE_OBJECT_TYPE (0x8d44): written with the live record's kind byte on the live path only;
 *   left untouched on the two inert returns. Downstream consumers read this type byte (type 3
 *   selects the main hit path).
 *   Return value: the boolean forwarded up from the record walk — true = normal completion,
 *   false = a hit was caught and the caller must unwind its frame (skip the remaining box). The
 *   two inert kinds (empty / engaged) return true.
 */
// Presence/state values in a target record's lead byte that make the box inert this pass:
// INERT_EMPTY = no object in this box; INERT_ENGAGED = object already engaged / hit-in-progress.
const INERT_EMPTY = 0x00;
const INERT_ENGAGED = 0x03;
// The record walk sweeps five actor-coordinate slots (B=5) against the object table.
const SCAN_COUNT = 0x05;

export function latchObjectTypeAndEnterProximityScan(m, slot = m.regs.i, target = m.regs.iy) {
  const { mem8 } = m;
  // Select this box's presence record by the slot's I-parity: the I=0 slot points at
  // ENEMY_TARGET_REC0 (0x8c90); any nonzero I selects ENEMY_TARGET_REC1 (0x8ca8). Read that
  // record's lead byte, whose low bits are the box's presence/state.
  const kind = mem8[slot === 0 ? ENEMY_TARGET_REC0 : ENEMY_TARGET_REC1];
  // Gate on presence: an empty box (0) or an already-engaged one (3) has nothing new to test,
  // so complete this pass normally (true) without touching the active-type latch or scanning.
  if (kind === INERT_EMPTY || kind === INERT_ENGAGED) return true;
  // Live object: publish its kind to ACTIVE_OBJECT_TYPE (0x8d44) so the collision path knows
  // which object type it is scanning (the value that later steers type-3 into the main hit path).
  mem8[ACTIVE_OBJECT_TYPE] = kind;
  // Arm the record walk over the object pool and enter it: HL = SPRITE_OBJECT_TABLE (0x8b70, the
  // 5-slot object/sprite record pool being hit-tested), IX = SPRITE_SCAN_ACTOR_SLOTS (0x8868, the
  // moving actor coordinate slots swept against it), B = SCAN_COUNT (5 records), forwarding the
  // proximity target (IY) and the slot selector (I). Its true/false result is this routine's.
  return classifyAndRouteObjectRecordByRound(m, SPRITE_OBJECT_TABLE, SPRITE_SCAN_ACTOR_SLOTS, SCAN_COUNT, target, slot);
}
