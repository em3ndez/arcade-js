// SPDX-License-Identifier: GPL-3.0-only
/**
 * pinMarioClimbPose — force the CODE byte of Mario's hardware sprite record to a fixed climb pose
 * (3, mirror flag clear), then return a pointer to the record's Y field. The attribute byte in
 * between is stepped over, never written.
 *
 * LIVE-OUT: memory (the record's code byte) plus the returned pointer.
 */

import { MARIO_SPRITE_RECORD, SPRITE_CODE, SPRITE_Y } from "./names.js";

const POSE_CODE = 3;

export function pinMarioClimbPose(m) {
  const { mem8 } = m;

  mem8[MARIO_SPRITE_RECORD + SPRITE_CODE] = POSE_CODE;

  return MARIO_SPRITE_RECORD + SPRITE_Y;
}
