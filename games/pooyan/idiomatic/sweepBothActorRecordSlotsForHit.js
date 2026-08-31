// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_5f83 } from "./loc_5f83.js";
import { SPRITE_ACTOR_RECORD_SLOTS } from "./names.js";
/**
 * sweepBothActorRecordSlotsForHit — walk the two actor-record slots through the per-slot handler, once per pass.
 *
 * The first slot sits at the actor-record base with a zero selector; the second is one stride on
 * with a non-zero selector. Each pass hands its slot cursor and selector to the per-slot handler,
 * and the instant a pass claims a hit the sweep aborts, leaving the remaining pass unrun. This is
 * the ungated companion to the projectile-proximity driver.
 *
 * LIVE-OUT: none — the per-frame updater that calls this reads no register back.
 */

const PASS_COUNT = 0x02;
const SLOT_STRIDE = 0x04;

export function sweepBothActorRecordSlotsForHit(m) {
  let cursor = SPRITE_ACTOR_RECORD_SLOTS;
  let selector = 0x00; // interrupt-parity selector: 0 for the first slot
  for (let pass = PASS_COUNT; pass > 0; pass--) {
    if (!loc_5f83(m, selector, cursor)) return; // a hit was claimed — skip the remaining pass
    cursor = u16(cursor + SLOT_STRIDE);
    selector = pass; // the second slot selects on the remaining count (=2, non-zero)
  }
}
