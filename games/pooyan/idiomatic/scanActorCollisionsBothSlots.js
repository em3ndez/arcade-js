// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_6435 } from "./loc_6435.js";
import { PLAY_MODE_LATCH, ROUND_COUNTER, SPRITE_ACTOR_RECORD_SLOTS } from "./names.js";

const PASSES = 2; // the actor record is scanned twice
const ACTOR_STRIDE = 0x04;
const PASS2_SELECTOR = 0x04;

/**
 * scanActorCollisionsBothSlots — two-pass actor collision driver.
 *
 * Does nothing when PLAY_MODE_LATCH is clear and ROUND_COUNTER bit 0 is set; otherwise
 * scans the actor record twice, stepping the record pointer one stride per pass and
 * handing the first pass selector 0 and the second the pass-2 selector. Each pass reports
 * whether it collided; a collision aborts the whole driver, matching the terminator skip
 * inside the scan that unwinds this frame.
 *
 * LIVE-OUT: none — the caller resumes on its own state; only the scan's memory effects
 * remain.
 */
export function scanActorCollisionsBothSlots(m) {
  const { mem8 } = m;
  if (mem8[PLAY_MODE_LATCH] === 0 && (mem8[ROUND_COUNTER] & 0x01) !== 0) return;

  let actor = SPRITE_ACTOR_RECORD_SLOTS;
  let selector = 0x00;
  for (let pass = 0; pass < PASSES; pass++) {
    if (!loc_6435(m, actor, selector)) return; // collision -> abort the driver
    actor = u16(actor + ACTOR_STRIDE);
    selector = PASS2_SELECTOR;
  }
}
