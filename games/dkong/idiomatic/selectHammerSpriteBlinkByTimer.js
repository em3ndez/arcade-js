// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectHammerSpriteBlinkByTimer — split the object-sprite build on the hammer duration counter's
 * high byte: still zero commits the record directly (no blink); non-zero routes through the blink
 * arm, which flashes the sprite's colour attribute before committing the same record.
 *
 * LIVE-OUT: memory-only.
 */

import { HAMMER_TIMER_HI } from "./names.js";
import { commitSpriteRecordAtMarioOffset } from "./commitSpriteRecordAtMarioOffset.js";
import { blinkHammerSpriteOnFramePhase } from "./blinkHammerSpriteOnFramePhase.js";

export function selectHammerSpriteBlinkByTimer(m, de = m.regs.de, ix = m.regs.ix, b = m.regs.b) {
  const { mem8 } = m;

  if (mem8[HAMMER_TIMER_HI] === 0) {
    commitSpriteRecordAtMarioOffset(m, de, ix, b);
  } else {
    blinkHammerSpriteOnFramePhase(m, undefined, de, ix, b);
  }
}
