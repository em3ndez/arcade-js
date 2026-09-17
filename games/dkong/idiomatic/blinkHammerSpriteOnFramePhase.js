// SPDX-License-Identifier: GPL-3.0-only
/**
 * blinkHammerSpriteOnFramePhase — on the blink half of the frame counter's 16-frame cycle,
 * force the sprite record's attribute to 1; otherwise pass the caller's attribute through.
 * Then commit the record — the hammer sprite changes colour every 8 frames.
 *
 * LIVE-OUT: memory-only — the committed sprite record, whose attribute byte is selected here.
 */

import { FRAME } from "./names.js";
import { commitSpriteRecordAtMarioOffset } from "./commitSpriteRecordAtMarioOffset.js";

const BLINK_PHASE_BIT = 0x08;
const BLINK_ATTR = 1;

export function blinkHammerSpriteOnFramePhase(m) {
  const { regs, mem8 } = m;

  if ((mem8[FRAME] & BLINK_PHASE_BIT) !== 0) {
    regs.c = BLINK_ATTR;
  }

  commitSpriteRecordAtMarioOffset(m);
}
