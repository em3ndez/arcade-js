// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_5f83 } from "./loc_5f83.js";
import { SPRITE_ACTOR_RECORD_SLOTS } from "./names.js";
/**
 * sweepBothActorRecordSlotsForHit — walk the two actor-record slots through the per-slot
 * enemy-record overlap handler, once per pass, and stop at the first hit.
 *
 * WHAT IT IS
 *   The two actor boxes at the base of the stride-4 actor-record slots (SPRITE_ACTOR_RECORD_SLOTS,
 *   0x8848) are two coordinate records — the first box at +0, the second one stride (four bytes)
 *   further on at 0x884c — each carrying a screen X (+0) and Y (+2). Once per pass this driver
 *   hands a box to the per-slot handler and asks whether any of the six enemy actor records has
 *   overlapped it closely enough to count as a contact. It does none of the overlap arithmetic
 *   itself: it hands each box, paired with an interrupt-parity selector, to the per-slot handler
 *   and lets that handler run the six-record overlap scan against the box. The instant a pass
 *   claims a hit the sweep aborts, leaving the remaining pass unrun, so at most one contact
 *   resolves per pass.
 *
 * ROLE IN THE MACHINE
 *   One of the per-record passes fired in fixed order by the master per-frame actor updater
 *   runActorUpdatePipeline (see mechanisms.md "The object-proximity collision scan"). For a given
 *   box the per-slot handler first selects one of two presence blocks by interrupt parity — a zero
 *   selector picks ENEMY_TARGET_REC0 (0x8c90), a non-zero selector its partner ENEMY_TARGET_REC1
 *   (0x8ca8, one 0x18-byte record on). That block's lead byte is both its liveness flag and the
 *   object kind: zero means nothing is armed in the slot (the pass completes and the sweep moves
 *   on), any non-zero value is latched into the machine-wide active hit type ACTIVE_OBJECT_TYPE
 *   (0x8d44) — the tighter-vs-wider threshold selector the overlap test reads back — and then
 *   drives a scan of the six enemy actor records at ENEMY_ACTOR_TABLE (0x8ae0) against the box
 *   using the coordinate boxes at ENEMY_SCAN_BOX_TABLE (0x8850). A full overlap either retargets
 *   or retires the struck record (type 3) or flags the two struck cells and enqueues the hit
 *   sound; either way it unwinds the frame, and that unwind is the abort this driver propagates.
 *
 *   This is the ungated actor-sweep driver: it walks both slots with no round or play-idle gate in
 *   front of the sweep, where the round-parity-gated sweepActorRecordSlotsBothParitiesOnOddRound
 *   (0x5e78) runs the same two-slot shape only on an odd round. It is the enemy-record-overlap
 *   sibling of the projectile-proximity driver resolveProjectileCollisionsBothActorSlots (0x6368),
 *   which runs the identical two-box shape against the projectile-proximity scan instead.
 *
 * ROM 0x5f6a (0x5f6a-0x5f82).
 * Grounding: [seen].
 *
 * LIVE-OUT: none — the per-frame updater that calls this reads no register back. Every effect
 * (the latched hit type, the struck record's rewritten state, the raised hit flag, the queued
 * hit sound) is left in memory by the per-slot handler's scan; this driver returns nothing.
 */

// Two passes: one per actor box.
const PASS_COUNT = 0x02;
// The actor-record slots are stride-4, so the second box sits exactly one stride (four bytes)
// past the first.
const SLOT_STRIDE = 0x04;

export function sweepBothActorRecordSlotsForHit(m) {
  // Aim the first pass at the actor box at the base of the stride-4 actor-record slots (0x8848).
  // This box's screen X (+0) and Y (+2) is the target the six enemy records are measured against.
  let cursor = SPRITE_ACTOR_RECORD_SLOTS;
  // The whole object-collision pipeline splits on interrupt parity. The first slot carries parity
  // 0, which makes the per-slot handler pick the first presence block, ENEMY_TARGET_REC0 (0x8c90).
  let selector = 0x00; // interrupt-parity selector: 0 for the first slot
  for (let pass = PASS_COUNT; pass > 0; pass--) {
    // Run the per-slot enemy-record overlap scan for this box: it returns true when the slot was
    // inert or its six-record scan found no overlap, false when an overlap connected. On a claimed
    // hit the scan has already unwound the frame past this loop, so return at once and leave the
    // remaining box unscanned — only one contact resolves per sweep.
    if (!loc_5f83(m, selector, cursor)) return; // a hit was claimed — skip the remaining pass
    // No contact on the first box: advance the cursor one stride (four bytes) to the second
    // actor-record slot at 0x884c.
    cursor = u16(cursor + SLOT_STRIDE);
    // The second slot needs a non-zero interrupt-parity selector so the per-slot handler picks the
    // partner presence block, ENEMY_TARGET_REC1 (0x8ca8), instead of the first. The pass counter
    // (still 2 at this point) supplies that non-zero value.
    selector = pass; // the second slot selects on the remaining count (=2, non-zero)
  }
}
