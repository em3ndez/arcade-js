// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { seatBlitPosition } from "./seatBlitPosition.js";

/**
 * eraseShiftedSprite — remove a pixel-positioned sprite from the screen.
 *
 * WHAT IT IS
 *   The erase member of the hardware-shifted blitter family. It clears exactly the bits a shifted
 *   sprite would have set: for each of B rows it pushes the source byte through the board's bit shifter,
 *   complements the shifted result, and ANDs it into the two adjacent screen bytes the shifted sprite
 *   occupies, leaving everything else untouched.
 *
 * ROLE IN THE MACHINE
 *   A sprite's horizontal position is a pixel coordinate, not a byte address, so it can straddle two
 *   screen bytes; the board's MB14241 bit shifter aligns it (mechanisms.md, the shifted-blitter family).
 *   seatBlitPosition first writes the low three bits of the coordinate to port 0x02 (the shift amount)
 *   and folds HL into a screen address. Then, per row: writing a source byte to port 0x04 and reading
 *   port 0x03 yields the shifted first half; writing 0 to port 0x04 and reading port 0x03 yields the
 *   second half; each half is complemented (^0xff) and ANDed into the screen (dst and dst+1) to clear
 *   the sprite's bits. Stepping dst by +0x20 moves down one framebuffer row. eraseAlienShot and the shot
 *   steppers use this to wipe a shot before redrawing it; it is the inverse of blitShiftedSprite.
 *
 * ROM 0x1452.  Grounding: [seen].
 *
 * LIVE-OUT: HL = final dst, DE = advanced src, A = last combined byte (returned as the register triple).
 */
export function eraseShiftedSprite(m, de = m.regs.de, b = m.regs.b) {
  const rows = b || 256; // a count of 0 wraps to a full 256-row pass
  // Seat the shift alignment (port 0x02 = low 3 coordinate bits) and resolve the first row's screen
  // byte; src walks the sprite's source bytes, one per row.
  let dst = seatBlitPosition(m); // screen address for the first row
  let src = de;
  let a = 0;
  for (let r = 0; r < rows; r++) {
    // Remember this row's left byte; the two halves land at rowStart and rowStart+1, and the next row
    // is rowStart+0x20 down the framebuffer.
    const rowStart = dst;
    // First half: feed the source byte to the shifter (port 0x04), read the shifted result (port 0x03),
    // complement it, and AND it into the left screen byte -- clearing exactly the bits the sprite set.
    m.io.portOut(0x04, m.mem8[src]);
    a = (m.io.portIn(0x03) ^ 0xff) & m.mem8[dst];
    m.mem8[dst] = a;
    dst = u16(dst + 1);
    src = u16(src + 1);
    // Second half: feed 0 to the shifter to get the carried-over bits of the same source byte, then
    // complement-AND them into the right screen byte.
    m.io.portOut(0x04, 0);
    a = (m.io.portIn(0x03) ^ 0xff) & m.mem8[dst];
    m.mem8[dst] = a;
    // Drop to the same left column one framebuffer row down.
    dst = u16(rowStart + 0x20);
  }
  // Hand back the walked pointers and last byte as the Z80 register triple (HL/DE/A).
  return [m.regs.hl = dst, m.regs.de = src, m.regs.a = a];
}
