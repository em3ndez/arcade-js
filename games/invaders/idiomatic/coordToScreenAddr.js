// SPDX-License-Identifier: GPL-3.0-only

/**
 * coordToScreenAddr — turn a packed pixel coordinate into a video-RAM byte address.
 *
 * WHAT IT IS
 *   The framebuffer packs eight pixels per byte, so a pixel position must be divided by eight to reach
 *   the byte that holds it, and the result must be forced to land inside the video window. This routine
 *   does exactly that: HL (a packed coordinate) >> 3, with the high byte clamped into the 0x2000-0x3fff
 *   video page.
 *
 * ROLE IN THE MACHINE
 *   Every positioned graphic reaches the screen through this mapping. The three discarded low bits are
 *   the sub-byte pixel offset; they are not lost here — seatBlitPosition (0x1474) captures them first
 *   (writing them to the MB14241 shifter's port 2) and then calls this to fold HL into the column
 *   address. Callers include seatBlitPosition and resolveSpriteScreenAddr (0x0742). The video window is
 *   0x2400-0x3fff, but masking the high byte to 0x3f and OR-ing 0x20 forces any result into 0x2000-0x3fff
 *   so an out-of-range coordinate still lands in the work-RAM/video page rather than wild memory.
 *
 * ROM 0x1a47-0x1a5b.  Grounding: [seen].  (On the 8080 the shift runs through carry and H is clamped via
 *   `ani 0x3f` / `ori 0x20`; BC is saved and restored across the body.)
 *
 * LIVE-OUT: HL = the screen address (also the JS return value).
 */
export function coordToScreenAddr(m, hl = m.regs.hl) {
  // Divide the packed coordinate by eight (>> 3): eight pixels per byte, so this maps a pixel position to
  // its containing byte. The three dropped low bits are the intra-byte pixel offset (seated separately).
  const shifted = hl >> 3;

  // Force the high byte into the 0x20-0x3f range: mask to 0x3f then set bit 0x20, so the address always
  // lands inside the 0x2000-0x3fff video/work-RAM page regardless of the input's magnitude.
  const high = ((shifted >> 8) & 0x3f) | 0x20;

  // Reassemble the clamped high byte with the low byte of the shifted coordinate to form the final
  // screen address.
  return (m.regs.hl = (high << 8) | (shifted & 0xff));
}
