// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";

/**
 * selectAlternateSpriteFrame — flip a sprite pointer to its alternate walk frame.
 *
 * WHAT IT IS
 *   Advances a graphics pointer by 0x30 bytes (DE += 0x30) to reach the second bank of a sprite's
 *   two-frame set. Sprite banks are laid out 0x30 apart, so adding 0x30 selects the alternate pose.
 *
 * ROLE IN THE MACHINE
 *   Each marching alien has a two-frame walk cycle; drawPendingAlien invokes this only when the alien's
 *   descriptor carries the alternate-frame flag (ALIEN_MARCH_FRAME_TOGGLE), so aliens flip between their two poses as
 *   they step. The same +0x30 frame stride shows up in stepAnimationFrame's scripted animation.
 *
 * ROM 0x013b-...  Grounding: [seen].
 *
 * LIVE-OUT: DE = the advanced pointer (also returned); the seam completes the ret.
 */
export function selectAlternateSpriteFrame(m, de = m.regs.de) {
  // Bump the pointer one sprite bank forward (0x30 bytes) to the alternate frame, wrapped to 16 bits.
  return (m.regs.de = u16(de + 0x30));
}
