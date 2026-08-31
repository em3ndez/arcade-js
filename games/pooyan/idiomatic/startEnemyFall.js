// SPDX-License-Identifier: GPL-3.0-only
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { advanceObjectStateOnFrameTimerExpiry } from "./advanceObjectStateOnFrameTimerExpiry.js";
import { FALL_ANIM_TABLE } from "./names.js";
/**
 * startEnemyFall — object state handler: begin the fall.
 *
 * Picks a plummet animation from the fall table by the record's low-two variant bits (biased down by
 * one), points the record at it, seeds the fall velocity, advances the record's state byte, then
 * falls through into the next state handler (which ticks the animation and its frame timer).
 * LIVE-OUT: none — the delegate yields nothing the caller reads.
 */
const VARIANT_MASK = 0x03;
const FALL_VELOCITY = 0x40;
const STATE_FIELD = 0x02;
const VARIANT_FIELD = 0x07;
const VELOCITY_FIELD = 0x09;

export function startEnemyFall(m, rec = m.regs.ix) {
  const { mem8 } = m;

  const variant = ((mem8[rec + VARIANT_FIELD] & VARIANT_MASK) - 1) & 0xff;
  const anim = fetchWordFromTableIndex(m, variant, FALL_ANIM_TABLE);
  setActorAnimation(m, rec, anim);
  mem8[rec + VELOCITY_FIELD] = FALL_VELOCITY;
  mem8[rec + STATE_FIELD] = mem8[rec + STATE_FIELD] + 1; // advance the state
  return advanceObjectStateOnFrameTimerExpiry(m, rec); // fall through into the next state handler
}
