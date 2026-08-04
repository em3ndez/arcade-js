// SPDX-License-Identifier: GPL-3.0-only
/**
 * blinkHammerSpriteOnFramePhase — make the hammer sprite flash by overriding its colour on half
 * of the frame counter's cycle, then commit the sprite record.
 *
 * One of the arms that feed the shared object-sprite record write. It reads the frame counter,
 * and on the half of the counter's 16-frame cycle where bit 3 is set it forces the record's
 * attribute byte to 1; on the other half the caller's own attribute passes through untouched.
 * Either way it then lays the finished record down. The net effect on screen is the hammer
 * sprite changing colour every 8 frames — a flash at just under four times a second.
 *
 * NOT CLAIMED: why it flashes. This arm is only reached once the hammer's timer has run most of
 * its course, which reads as an about-to-expire warning, but nothing here establishes that; what
 * is established is the flash and that it is the hammer's sprite being flashed.
 *
 * The record's other inputs — where to write it, which object it belongs to, and the tile code —
 * are handed in and passed straight on; this arm chooses the attribute and nothing else.
 *
 * LIVE-OUT: memory-only — the committed sprite record, whose attribute byte is the one selected
 * here. Nothing reads a result back from this arm.
 */

import { FRAME } from "./names.js";
import { commitSpriteRecordAtMarioOffset } from "./commitSpriteRecordAtMarioOffset.js";

// Bit 3 splits the frame counter's 16-frame cycle into two 8-frame halves; the blink
// shows on the half where it is set.
const BLINK_PHASE_BIT = 0x08;
// Attribute forced onto the sprite record during the blink half.
const BLINK_ATTR = 1;

export function blinkHammerSpriteOnFramePhase(m) {
  const { regs, mem } = m;

  // On the blink half of the frame cycle, override the attribute that will be stored;
  // on the other half let the caller's attribute pass straight through.
  if ((mem.read8(FRAME) & BLINK_PHASE_BIT) !== 0) {
    regs.c = BLINK_ATTR;
  }

  // Commit the finished sprite record (destination, object base, and tile code arrive in
  // registers from the caller; the attribute is the byte selected just above).
  commitSpriteRecordAtMarioOffset(m);
}
