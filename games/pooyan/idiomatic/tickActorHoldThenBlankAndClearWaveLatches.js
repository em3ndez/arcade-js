// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { LANE_SPAWN_COUNTDOWN, LAUNCH_ARM_LATCH, loc_8d76 } from "./names.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { blankActorSpriteBand } from "./blankActorSpriteBand.js";
/**
 * tickActorHoldThenBlankAndClearWaveLatches — actor frame-hold tick.
 *
 * Advances the actor record's animation, then counts its frame-hold field down; while it is
 * still holding (nonzero after the decrement) the tick returns and the current frame stays.
 * Once the hold lapses, and only when the record's high-nibble flag byte is set, a shared
 * tally is bumped; on the third such bump it clears the lane-spawn countdown and the launch
 * arm latch. Every non-holding exit blanks the actor's sprite band on the way out.
 *
 * LIVE-OUT: none consumed by the caller — the dispatch caller parks and restores its own
 * loop registers around this tick and reads none of ours. Memory carries every effect.
 */

const HOLD_FIELD = 0x11; // frame-hold countdown field in the record
const FLAG_FIELD = 0x07; // record flag byte; its high nibble gates the tally bump
const HIGH_NIBBLE = 0xf0;
const TALLY_RESET_AT = 0x03; // tally value at which the lane/launch latches clear

export function tickActorHoldThenBlankAndClearWaveLatches(m, rec = m.regs.ix) {
  const { mem8 } = m;

  advanceObjectAnimationFrame(m, rec); // advance the record's animation
  mem8[rec + HOLD_FIELD] = u8(mem8[rec + HOLD_FIELD] - 1);
  if (mem8[rec + HOLD_FIELD] !== 0) return; // still holding this frame

  if ((mem8[rec + FLAG_FIELD] & HIGH_NIBBLE) !== 0) {
    mem8[loc_8d76] = u8(mem8[loc_8d76] + 1);
    if (mem8[loc_8d76] >= TALLY_RESET_AT) {
      mem8[LANE_SPAWN_COUNTDOWN] = 0x00;
      mem8[LAUNCH_ARM_LATCH] = 0x00;
    }
  }
  return blankActorSpriteBand(m, rec); // blank the actor's sprite band
}
