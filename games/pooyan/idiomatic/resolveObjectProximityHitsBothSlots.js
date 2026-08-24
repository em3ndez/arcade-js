// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_6048 } from "./loc_6048.js";
import { SPRITE_ACTOR_RECORD_SLOTS } from "./names.js";
/**
 * resolveObjectProximityHitsBothSlots — run the per-slot proximity scan once for each of the two target slots.
 *
 * Walks the two target-slot bases in turn, tagging each pass with its slot selector, then runs
 * the scan for that slot. A hit inside a pass aborts the whole routine, leaving the remaining
 * slot untouched; with no hit both slots are scanned and the routine returns normally.
 *
 * LIVE-OUT: memory only — no caller reads back a register. The slot selector and target base are
 * handed to the scan through the interpreter registers it reads.
 */
const SLOT_COUNT = 2;
const SLOT_STRIDE = 4;
const SLOT1_SELECTOR = 2;

export function resolveObjectProximityHitsBothSlots(m) {
  let target = SPRITE_ACTOR_RECORD_SLOTS;
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    m.regs.iy = target;
    m.regs.i = slot === 0 ? 0 : SLOT1_SELECTOR;
    if (!loc_6048(m)) return; // a hit skip-returns past the remaining slot
    target = u16(target + SLOT_STRIDE);
  }
}
