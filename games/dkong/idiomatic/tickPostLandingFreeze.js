// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickPostLandingFreeze — count Mario's post-landing freeze down and unfreeze him when it
 * expires.
 *
 * The movement machine hands control here on any frame Mario's MARIO_FREEZE_TIMER is
 * non-zero. Landing from a jump loads that timer with four, so Mario is unresponsive for
 * four frames after he comes down. On each of those frames this routine does one thing:
 * step the timer down and, while it is still non-zero, return immediately — the mover
 * does nothing else and Mario stays put.
 *
 * On the frame the timer reaches ZERO the freeze expires and the one-shot unfreeze runs:
 *
 *   - MARIO_HAMMER_ACTIVE takes MARIO_HAMMER_PENDING: a hammer touched only during the
 *     airborne frames is committed now that Mario is settled.
 *   - MARIO_SPRITE_CODE keeps just its top bit, the facing/flip bit; the tile and
 *     animation bits are stripped, so Mario resumes from a clean standing pose.
 *   - MARIO_WALK_ANIM is cleared, restarting the walk cycle from the beginning.
 *   - Mario's hardware sprite record is refreshed from that cleaned state, so this
 *     frame's blit shows the standing pose.
 *
 * The countdown wraps at eight bits, so a timer that somehow entered at zero would go to
 * 255 and hold the freeze for another 255 frames rather than expiring at once. In play it
 * is always loaded with four.
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
  const { mem } = m;

  // Step the freeze down (8-bit wrap).
  const remaining = (mem.read8(MARIO_FREEZE_TIMER) - 1) & 0xff;
  mem.write8(MARIO_FREEZE_TIMER, remaining);
  if (remaining !== 0) return; // still frozen — the mover does nothing more this frame

  // Freeze expired this frame — unfreeze.
  mem.write8(MARIO_HAMMER_ACTIVE, mem.read8(MARIO_HAMMER_PENDING)); // commit the hammer
  mem.write8(MARIO_SPRITE_CODE, mem.read8(MARIO_SPRITE_CODE) & 0x80); // keep facing bit only
  mem.write8(MARIO_WALK_ANIM, 0);

  // Refresh Mario's hardware sprite record from the cleaned state.
  writeMarioSpriteRecord(m);
}
