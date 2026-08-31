// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { latchObjectTypeAndEnterProximityScan } from "./latchObjectTypeAndEnterProximityScan.js";
import { SPRITE_ACTOR_RECORD_SLOTS } from "./names.js";
/**
 * resolveObjectProximityHitsBothSlots — run the single-slot object-proximity
 * scan once for each of the two hunter-target boxes, aborting on the first hit.
 *
 * WHAT IT IS
 *   ROM 0x602f. One of the eleven per-frame collision passes the master actor
 *   updater fires in a fixed order every frame. Its whole job is to drive the
 *   single-slot proximity scan (latchObjectTypeAndEnterProximityScan, ROM 0x6048) across the two target
 *   boxes that sit back-to-back at SPRITE_ACTOR_RECORD_SLOTS (0x8848), four
 *   bytes apart, so an object that has come within reach of either box is
 *   caught and resolved.
 *
 * ROLE IN THE MACHINE
 *   Each pass hands latchObjectTypeAndEnterProximityScan two things: a slot selector and the base address
 *   of that box. The selector does double duty — inside latchObjectTypeAndEnterProximityScan it picks the
 *   slot's presence record (record 0 at ENEMY_TARGET_REC0 0x8c90 for slot 0,
 *   record 1 at ENEMY_TARGET_REC1 0x8ca8 otherwise), and it also rides
 *   downstream as the parity/hit-flag tag the scan forwards. latchObjectTypeAndEnterProximityScan reports
 *   back true = the scan finished clean, false = an object hit landed and the
 *   frame must unwind. On a hit this routine returns at once, so the remaining
 *   box is left unscanned and at most one hit is resolved per frame.
 *
 * GROUNDING
 *   Grounding: [seen].
 *
 * LIVE-OUT
 *   Memory only — no caller reads back a register. Everything a hit changes,
 *   latchObjectTypeAndEnterProximityScan and its scan write into the target and object records; this
 *   routine only sequences the two passes and short-circuits the frame on the
 *   first hit.
 */
const SLOT_COUNT = 2; // two target boxes to sweep this frame
const SLOT_STRIDE = 4; // the two boxes lie four bytes apart (0x8848 then 0x884c)
const SLOT1_SELECTOR = 2; // selector for the second box: any nonzero routes latchObjectTypeAndEnterProximityScan to presence record 1, and this exact value is the parity tag the scan forwards

export function resolveObjectProximityHitsBothSlots(m) {
  // Aim the cursor at the base of the first target box, SPRITE_ACTOR_RECORD_SLOTS
  // (0x8848). `target` is the coordinate box each pass scans against; it steps one
  // box forward after each clean pass.
  let target = SPRITE_ACTOR_RECORD_SLOTS;

  // Sweep the two boxes in turn. Slot 0 is tagged with selector 0 (which selects
  // presence record 0 at 0x8c90); slot 1 is tagged with SLOT1_SELECTOR (presence
  // record 1 at 0x8ca8), the same nonzero value the machine also carries as the
  // pass's parity tag.
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    // Run the single-slot proximity scan for this box, forwarding the slot
    // selector and the box base. latchObjectTypeAndEnterProximityScan returns false when an object hit lands,
    // and a hit must unwind the frame — so bail immediately, leaving the remaining
    // box unscanned and resolving only one hit per frame.
    if (!latchObjectTypeAndEnterProximityScan(m, slot === 0 ? 0 : SLOT1_SELECTOR, target)) return; // a hit skip-returns past the remaining slot

    // No hit: advance the cursor by one box (0x8848 -> 0x884c), held to 16 bits
    // like the address register the machine walks it in, and scan the next slot.
    target = u16(target + SLOT_STRIDE);
  }
}
