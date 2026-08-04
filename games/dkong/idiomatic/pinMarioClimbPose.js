// SPDX-License-Identifier: GPL-3.0-only
/**
 * pinMarioClimbPose — pin a fixed climb pose into Mario's hardware sprite record and hand back a
 * pointer to that record's Y field.
 *
 * A tiny leaf that reads nothing — no memory, no register — and does exactly two things:
 *
 *   - Force the CODE byte of Mario's hardware sprite record to a fixed value of 3. His sprite
 *     code packs a horizontal-mirror flag in the top bit and an animation code in the low bits; a
 *     bare 3 is one of the climb-frame codes with the mirror flag cleared, so this pins one
 *     specific climb pose whatever the byte held before.
 *   - Step past the record's attribute byte to its Y field and return that address, so whoever
 *     called can move the sprite's Y without recomputing the pointer. That pointer is a genuine
 *     product of the routine, consumed on the very next step.
 *
 * The attribute byte in between is deliberately stepped over, never written.
 *
 * WHAT THIS NAME DOES NOT CLAIM: a direction. Nothing here moves Mario. The pose code is forced
 * and a pointer is returned; whether the climb is up or down is decided before the call.
 *
 * LIVE-OUT: memory (the record's code byte) plus the returned pointer.
 */

import { MARIO_SPRITE_RECORD, SPRITE_CODE, SPRITE_Y } from "./names.js";

// The pose stamped into the record's code byte: one of Mario's climb-frame codes
// (3,4,5), here pinned to 3 with the mirror flag clear.
const POSE_CODE = 3;

/**
 * @param {object} m  the machine (writes one work-RAM byte).
 * @returns {number} address of Mario's sprite-record Y field — the caller's next target.
 */
export function pinMarioClimbPose(m) {
  const { mem } = m;

  // Pin the record's code byte to the fixed pose.
  mem.write8(MARIO_SPRITE_RECORD + SPRITE_CODE, POSE_CODE);

  // Hand back a pointer to the record's Y field, stepping over the attribute byte
  // (which is left untouched).
  return MARIO_SPRITE_RECORD + SPRITE_Y;
}
