// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { seedAndRunTargetProximityScan } from "./seedAndRunTargetProximityScan.js";
import { SPRITE_ACTOR_RECORD_SLOTS } from "./names.js";
/**
 * resolveProjectileCollisionsBothActorSlots — run the projectile-proximity scan against BOTH
 * actor boxes, once per pass, and stop at the first contact.
 *
 * WHAT IT IS
 *   Two actor boxes live back-to-back at the base of the stride-4 actor-record slots
 *   (SPRITE_ACTOR_RECORD_SLOTS, 0x8848): the first box at +0, the second one stride (four bytes)
 *   further on at 0x884c. Each box carries a screen X (+0) and Y (+2). Once a frame this driver
 *   asks, box by box, whether any live projectile/object coordinate has drifted close enough to
 *   that box to count as a contact. It does none of the distance-testing itself — it hands each
 *   box, paired with an interrupt-parity selector, to the per-box proximity scan and lets that
 *   scan walk the candidate target coordinates against the box. The instant a pass reports a
 *   claim, the driver returns and leaves the remaining box unscanned, so at most one contact
 *   resolves per frame.
 *
 * ROLE IN THE MACHINE
 *   One pass of the per-frame object-collision pipeline. For a given box, the proximity scan
 *   measures the on-screen distance from the box to each of three candidate target coordinates;
 *   the first candidate inside the proximity window is claimed — its record is stamped with
 *   fresh state bytes, its animation set, one of the paired hit flags raised, and a spawn tile
 *   plus display command queued — and the sweep aborts on that hit. This routine is what runs
 *   that scan twice, once per actor box, and chooses which paired hit flag each pass raises by
 *   way of the interrupt-parity selector: 0 for the first box raises OBJ_HIT_FLAG_I0 (0x8d1b),
 *   4 for the second raises OBJ_HIT_FLAG_I1 (0x8d1c). A contact in either pass aborts the driver
 *   and the other box goes unscanned.
 *
 * ROM 0x6368 (0x6368-0x6380).
 * Grounding: [seen].
 *
 * LIVE-OUT: none — the per-frame updater that calls this reads no register back. Every effect
 * (the claimed record's state bytes, its animation, the raised hit flag, the queued spawn) is
 * left in memory by the scan; this driver returns nothing of its own.
 */

// Two passes: one per actor box.
const PASS_COUNT = 0x02;
// The actor-record slots are stride-4, so the second box sits exactly one stride (four bytes)
// past the first; the same value doubles as the second pass's interrupt-parity selector.
const BOX_STRIDE = 0x04;

export function resolveProjectileCollisionsBothActorSlots(m) {
  // Aim the first pass at the actor box at the base of the stride-4 actor-record slots (0x8848).
  // This box's screen X (+0) and Y (+2) is the source position every candidate coordinate is
  // measured against.
  let box = SPRITE_ACTOR_RECORD_SLOTS;
  // The first box carries interrupt-parity 0, so a claim in this pass raises the I=0 side of the
  // paired hit flags, OBJ_HIT_FLAG_I0 (0x8d1b).
  let selector = 0x00; // interrupt-parity selector: 0 for the first box
  for (let pass = PASS_COUNT; pass > 0; pass--) {
    // Run the proximity scan for this box: it returns true when all three target slots were
    // clear of the box, false when it claimed one (a contact connected). On a claim, return at
    // once — the remaining box is left unscanned so only one contact resolves this frame.
    if (!seedAndRunTargetProximityScan(m, box, selector)) return; // a hit was claimed — skip the remaining pass
    // No contact on the first box: advance the cursor one stride (four bytes) to the second
    // actor-record slot at 0x884c.
    box = u16(box + BOX_STRIDE);
    // The second box's interrupt-parity selector is the stride value (4), so a claim here raises
    // the I!=0 side of the pair, OBJ_HIT_FLAG_I1 (0x8d1c), instead of the first box's flag.
    selector = BOX_STRIDE; // the second box selects on the stride value (=4)
  }
}
