// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b91 — commit Mario's adjusted X to both his game position and his sprite record.
 *
 * The accept arm of a tile probe. The adjusted X arrives in the accumulator and is stored into
 * MARIO_X and into the X field of Mario's sprite record, so the on-screen sprite tracks the new
 * position on the same frame — this write pair is why those two bytes hold the same value in play.
 *
 * THE RETURN IS A PROTOCOL, not a value. `false` means the accept happened and control must NOT
 * resume where it was called from: the caller unwinds two levels rather than one. The accumulator
 * is left holding 1, the accept signal read back up that chain.
 *
 * LIVE-OUT: memory (MARIO_X and the sprite record's X field), the accumulator, and the protocol
 * return.
 */
import { MARIO_X, MARIO_SPRITE_RECORD, SPRITE_X } from "./names.js";

/**
 * @param {object} m  the machine; the adjusted X arrives in the accumulator.
 * @returns {boolean} false — the caller-skip signal (unwind two levels).
 */
export function loc_2b91(m) {
  const { regs, mem } = m;
  const x = regs.a; // the adjusted X the probe computed
  mem.write8(MARIO_X, x);
  mem.write8((MARIO_SPRITE_RECORD + SPRITE_X) & 0xffff, x);
  regs.a = 0x01; // the accept signal
  return false; // caller-skip: unwind two levels
}
