// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickPostLandingFreeze — count Mario's post-landing freeze down and unfreeze him when it
 * expires (commit the hammer, reset to a clean standing pose, refresh the sprite record).
 *
 * LIVE-OUT: memory-only — the freeze timer, and on expiry the hammer, sprite-code and
 * walk-cycle cells plus the four sprite-record bytes the refresh writes.
 */

import {
  MARIO_FREEZE_TIMER,
  MARIO_HAMMER_PENDING,
  MARIO_HAMMER_ACTIVE,
  MARIO_SPRITE_CODE,
  MARIO_WALK_ANIM,
} from "./names.js";
import { writeMarioSpriteRecord } from "./writeMarioSpriteRecord.js";

export function tickPostLandingFreeze(m) {
  const { mem8 } = m;

  const remaining = (mem8[MARIO_FREEZE_TIMER] - 1) & 0xff;
  mem8[MARIO_FREEZE_TIMER] = remaining;
  if (remaining !== 0) return;

  mem8[MARIO_HAMMER_ACTIVE] = mem8[MARIO_HAMMER_PENDING];
  mem8[MARIO_SPRITE_CODE] = mem8[MARIO_SPRITE_CODE] & 0x80; // keep facing bit only
  mem8[MARIO_WALK_ANIM] = 0;

  writeMarioSpriteRecord(m);
}
