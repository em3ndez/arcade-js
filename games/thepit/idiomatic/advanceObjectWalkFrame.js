// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceObjectWalkFrame — step a moving object's walk animation, then build its record.
 *
 * The shared tail the tile-under-object classifier lands on when the object is on open
 * ground (a settled object goes to the plain record builder instead). It re-expresses the
 * column as an offset from a moving reference point, reads an 8-step walk phase off that
 * offset, sets a motion marker the action dispatcher reads, alternates the sprite between
 * two codes, then hands the phase forward and builds the object's deferral record directly.
 */

import { PLAYER_Y, PLAYER_FACING, OBJECT_MOTION_MODE, PLAYER_STEP_Y } from "./names.js";
import { stageObjectSpriteRecord } from "./stageObjectSpriteRecord.js";

const REFERENCE = PLAYER_STEP_Y;

export function advanceObjectWalkFrame(m) {
  const { regs, mem8 } = m;

  // Re-express the column as an offset from the reference point (wraps in a byte).
  const offset = (mem8[PLAYER_Y] - mem8[REFERENCE]) & 0xff;
  mem8[PLAYER_Y] = offset;

  // An 8-step walk phase off the offset, biased by 3 so the frame flips; phase 0 is rest.
  const phase = (offset + 3) % 8;

  // At rest on phase 0; otherwise mark "in motion" with the high bit set.
  mem8[OBJECT_MOTION_MODE] = phase === 0 ? 0 : 0xff;

  // Two-frame walk: odd sprite code when phase bit 1 is set, even otherwise.
  mem8[PLAYER_FACING] = phase & 2 ? 0xb3 : 0xb2;

  // Hand the phase forward in E (caller reads it), then build and return the deferral record.
  return (regs.e = phase, stageObjectSpriteRecord(m));
}
