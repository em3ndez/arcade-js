// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectHammerSpriteBlinkByTimer — pick which object-sprite build path lays down this
 * frame's record, based on how far the hammer's duration counter has run.
 *
 * One of the build arms feeding the shared object-sprite record write, reached from
 * the hammer updater on the branch where the counter's low byte advanced without
 * wrapping. It reads the counter's high byte and splits:
 *
 *   - high byte zero (the counter is still in its first 256 counts): commit the record
 *     directly, with the caller's attribute unchanged — no blink.
 *   - high byte non-zero (past 256, i.e. the counter's later stretch as it heads for
 *     its ~512-count expiry): route through the blink arm, which flashes the sprite's
 *     colour attribute on the frame counter's blink phase before committing the same
 *     record. This is the half of the hammer's life where it flashes [guess — the
 *     "warning of the coming expiry" purpose belongs to the blink arm and is carried
 *     from the caller chain; the mechanism here is just the high-byte split].
 *
 * Either path lays down the same 4-byte sprite record; this arm only selects whether
 * the attribute blinks. The record's inputs — destination address, object base, tile
 * code and attribute — pass straight through untouched to whichever tail runs; this
 * arm sets none of them. They arrive through the register file because the record
 * write is reached by tail-jump rather than by a call with arguments.
 *
 * The blink threshold reading rests on the named hammer timer: its high byte sets at
 * the halfway point of the hammer's ~512-frame life.
 *
 * LIVE-OUT: memory-only. This arm tail-calls the chosen record write and its own
 * caller discards the result.
 */

import { HAMMER_TIMER_HI } from "./names.js";
import { commitSpriteRecordAtMarioOffset } from "./commitSpriteRecordAtMarioOffset.js"; // the shared object-sprite record write
import { blinkHammerSpriteOnFramePhase } from "./blinkHammerSpriteOnFramePhase.js"; // the blink-phase build arm

export function selectHammerSpriteBlinkByTimer(m) {
  const { mem } = m;

  // High byte of the hammer duration counter still zero -> write the record directly.
  // Once it sets (the counter's later stretch), route through the blink arm instead.
  if (mem.read8(HAMMER_TIMER_HI) === 0) {
    commitSpriteRecordAtMarioOffset(m);
  } else {
    blinkHammerSpriteOnFramePhase(m);
  }
}
