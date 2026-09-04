// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { seatBlitPosition } from "./seatBlitPosition.js";

/**
 * clearSpriteColumn — erase a two-byte-wide sprite footprint by zeroing its screen bytes over B rows.
 *
 * WHAT IT IS
 *   The wipe counterpart to the shifted-sprite blitters. A hardware-shifted sprite occupies two
 *   adjacent screen bytes per row (the two overlapping halves the bit-shifter produces); this routine
 *   seats the same blit position and then simply stores zero into both of those bytes down B rows,
 *   clearing the exact footprint a shifted sprite would have covered.
 *
 * ROLE IN THE MACHINE
 *   Shares its setup with the shifted blitters (see mechanisms.md "Sprite drawing"): seatBlitPosition
 *   sends the coordinate's low three bits to output port 0x02 as the bit-shifter alignment and folds
 *   the coordinate into a video-RAM byte address. Where blitShiftedSprite/orBlitShiftedSprite write
 *   shifted graphics into that address and the next, this writes zero into both — a blind clear rather
 *   than an AND-out erase. Its caller is tickAlienExplosionDespawn (0x1538): when a player shot's
 *   alien-explosion sprite times out, it reloads the explosion's stored screen position and calls this
 *   to wipe the two-wide sprite before retiring the shot. Walking video RAM one row at a time means
 *   adding 0x20 to the destination each pass.
 *
 * ROM 0x1424-0x1438.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: HL = the destination one stride past the last cleared row (the column end).
 *   `b` (row count) and `hl` (coordinate word) default from the registers; a caller may pass `hl`
 *   explicitly since both the shift offset and the folded address derive from it (every existing
 *   caller omits it and lets it default from the register).
 */
export function clearSpriteColumn(m, b = m.regs.b, hl = m.regs.hl) {
  // Seat the blit: latch the shift offset from the coordinate's low byte and fold the coordinate into a
  // video-RAM byte address (the top-left of the footprint to clear).
  let dst = seatBlitPosition(m, hl & 0xff, hl);
  const rows = b || 256; // a count of 0 wraps to a full 256-row pass
  // For each row, zero the two adjacent screen bytes (the shifted sprite's two halves), then drop one
  // full screen row (+0x20) so the cleared bytes stack into a vertical strip.
  for (let i = 0; i < rows; i++) {
    m.mem8[dst] = 0;
    m.mem8[u16(dst + 1)] = 0;
    dst = u16(dst + 0x20);
  }
  // Hand back the destination sitting one stride below the cleared column.
  return (m.regs.hl = dst);
}
