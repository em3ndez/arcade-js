// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { seatBlitPosition } from "./seatBlitPosition.js";

/**
 * orBlitShiftedSprite — OR a pixel-shifted sprite column onto the screen, preserving the background.
 *
 * WHAT IT IS
 *   Draws a B-row sprite column at an arbitrary pixel X by pushing each source byte through the
 *   board's hardware bit shifter and OR-merging the two overlapping halves it produces into the two
 *   adjacent screen bytes, then stepping down one screen row per source byte.
 *
 * ROLE IN THE MACHINE
 *   A sprite's horizontal position is a pixel coordinate, not a byte address, so a sprite that does
 *   not sit on an eight-pixel boundary spans two adjacent bytes (see mechanisms.md "Sprite drawing").
 *   seatBlitPosition first sends the coordinate's low three bits to port 0x02 (the MB14241 shifter's
 *   alignment offset) and folds HL into a screen address. Then per row: write the source byte to port
 *   0x04 and read the low half back from port 0x03, OR it into the screen byte; write 0x00 to port
 *   0x04 and read the high half, OR it into the next byte (HL+1); advance one row (0x20). Using OR
 *   (rather than a plain store) leaves whatever was already on screen intact underneath — this is the
 *   shifted OR-merge blitter the shot-drawing paths use to lay a sprite over the background at an
 *   arbitrary pixel X. (Byte-aligned graphics like the shields are OR-stamped by a different, non-shifted
 *   routine, orBlitBitmap.) It is one of four shifted blitters that differ only in how they combine the
 *   shifted halves with the screen.
 *
 * ROM 0x1400.  Grounding: [seen].
 *
 * LIVE-OUT: HL = the column end (destination one stride past the last row) and DE = the source end;
 * both returned as a two-element array. DE/B default from the registers when the caller omits them.
 */
export function orBlitShiftedSprite(m, de = m.regs.de, b = m.regs.b) {
  // Seat the shift offset (port 2) and resolve the screen destination for the current coordinate.
  let dst = seatBlitPosition(m);
  let src = de;
  const rows = b || 256; // a count of 0 wraps to a full 256-row pass
  for (let i = 0; i < rows; i++) {
    // Low half: feed the source byte to the shifter (port 4), read the aligned low half (port 3),
    // and OR it into the current screen byte so it merges over the existing pixels.
    m.io.portOut(0x04, m.mem8[src]);
    m.mem8[dst] = m.io.portIn(0x03) | m.mem8[dst];
    src = u16(src + 1);
    // High half: the same byte shifted spills into the next screen byte (HL+1). Clock the shifter
    // with a zero input (port 4 = 0) to obtain that overflow half, and OR it into HL+1.
    const hi = u16(dst + 1);
    m.io.portOut(0x04, 0x00);
    m.mem8[hi] = m.io.portIn(0x03) | m.mem8[hi];
    // Drop to the next screen row.
    dst = u16(dst + 0x20);
  }
  // Hand back the advanced column and source pointers (HL, DE) for the caller / next chained blit.
  return [(m.regs.hl = dst), (m.regs.de = src)];
}
