// SPDX-License-Identifier: GPL-3.0-only
import { keepClimberFlipBitByDepth } from "./keepClimberFlipBitByDepth.js";
import { stepClimberSegmentAndHeading } from "./stepClimberSegmentAndHeading.js";

/**
 * stepClimberSegmentGuarded — the guarded front door to the per-slot climber segment step. ROM 0x9e5c.
 *
 * Role in the machine: a climber (one of Tempest's enemies that walks along the rim of the tube toward
 * the player) advances one segment of its zig-zag path per call. There are two entries into the segment
 * step: this full entry, which runs an extra depth-gated guard first, and the mid entry
 * (stepClimberSegmentAndHeading) which skips it. Callers that must re-apply the flip guard use this door.
 *
 * Behavior: run keepClimberFlipBitByDepth for slot x (the gated bit6 "keeper" — it decides, from the
 * slot's current depth, whether the direction-flip bit6 stays set), then fall straight into the shared
 * segment-step body. The tail's return value is passed through unchanged.
 *
 * Live-out: whatever the shared body leaves — the slot's forced-live flag (ENEMY_SLOT_FLAGS,x bit7),
 * its stepped depth, and the stored heading byte; A carries the returned direction. Grounding: [seen].
 */
export function stepClimberSegmentGuarded(m, x = m.regs.x) {
  keepClimberFlipBitByDepth(m, x);        // gated per-slot bit6-keeper guard (head work)
  return stepClimberSegmentAndHeading(m, x); // shared tail
}
