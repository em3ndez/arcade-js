// SPDX-License-Identifier: GPL-3.0-only
import { coordToScreenAddr } from "./coordToScreenAddr.js";

/**
 * seatBlitPosition — seat a pixel-accurate blit: latch the shift offset, then resolve the screen address.
 *
 * WHAT IT IS
 *   The setup step every hardware-shifted sprite draw begins with. A sprite's horizontal position is a
 *   pixel coordinate, not a byte address; this routine captures the sub-byte part of that coordinate and
 *   hands it to the board's bit shifter, then converts the coordinate into a video-RAM byte address. Between
 *   them, the shift offset chooses which of the eight pixels within a byte the sprite starts on and the byte
 *   address chooses the column.
 *
 * ROLE IN THE MACHINE
 *   The low three bits of L are the sub-byte pixel offset (the bits coordToScreenAddr is about to discard).
 *   Writing them to output port 0x02 sets the MB14241 shift register's alignment amount (see mechanisms.md,
 *   "Sprite drawing"). coordToScreenAddr (ROM 0x1a47) then shifts the coordinate right by three — dividing
 *   by eight, eight pixels per byte — and forces the high byte into the 0x2000-0x3fff video window so the
 *   result always lands inside the framebuffer. All four shifted blitters (blitShiftedSprite,
 *   orBlitShiftedSprite, eraseShiftedSprite, drawSpriteWithCollision) and clearSpriteColumn position
 *   themselves through this. The `hl` parameter is the same coordinate word coordToScreenAddr reads;
 *   threading it lets a caller pass the coordinate explicitly instead of seating it in the register first
 *   (every existing caller omits it and lets it default from the register).
 *
 * ROM 0x1474-0x147b.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: HL = the seated screen address (from coordToScreenAddr); output port 0x02 holds the shift offset.
 */
export function seatBlitPosition(m, l = m.regs.l, hl = m.regs.hl) {
  // Send L's low 3 bits to port 0x02 as the shifter alignment (the sub-byte pixel offset of the sprite).
  m.io.portOut(0x02, l & 0x07);

  // Fold the coordinate into a video-RAM byte address (>>3 for the byte, high byte forced into 0x20-0x3f).
  return coordToScreenAddr(m, hl);
}
