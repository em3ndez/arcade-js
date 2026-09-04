// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";

/**
 * captureScreenRect -- gather a rectangle of the framebuffer into a contiguous byte stream.
 *
 * WHAT IT IS
 *   The rectangular block mover. Video RAM is laid out as 32-byte columns: consecutive addresses run down
 *   a column, and adding 0x20 crosses into the next column. This routine walks B columns of the screen,
 *   copying C consecutive bytes down each, and lays the whole B-by-C rectangle out end-to-end into a linear
 *   destination buffer. It is the "save" direction of the shield backup.
 *
 * ROLE IN THE MACHINE
 *   Inputs (from registers by default): HL = the top-left source address, DE = the destination stream base,
 *   B = the number of columns (outer passes), C = the bytes per column (inner copy). The outer loop
 *   re-bases the source 0x20 further along each pass (one screen-column step) while the destination runs
 *   straight forward, so the rectangle is flattened into contiguous bytes. drawOrSaveShields drives it in
 *   save mode to capture the four bunker shields (each a 0x16-column by 0x02-byte block, DRAW_BLOCK_STRIDE
 *   0x02e0 apart) into a player's shield buffer; the counterpart orBlitBitmap paints them back.
 *
 * ROM 0x147c-0x1490.  Grounding: [seen].
 *
 * LIVE-OUT: DE = one past the last byte written (the stream end), HL = the source base advanced 0x20*B
 * (one past the last column read) -- so successive rectangles chain without re-seating the pointers.
 */
export function captureScreenRect(m, hl = m.regs.hl, de = m.regs.de, b = m.regs.b, c = m.regs.c) {
  // An 8080 loop count of 0 means a full 256 passes (the register wraps), so map 0 -> 256 for both counts.
  const rows = b || 256; // a count of 0 wraps to a full 256-pass loop
  const cols = c || 256;
  let dst = de;
  // Outer pass: each iteration re-bases the source 0x20 further on (the next screen column of the rectangle).
  for (let r = 0; r < rows; r++) {
    let src = u16(hl + 0x20 * r);
    // Inner copy: C consecutive bytes down this column, appended to the running destination stream.
    for (let k = 0; k < cols; k++) {
      m.mem8[dst] = m.mem8[src];
      dst = u16(dst + 1);
      src = u16(src + 1);
    }
  }
  // Publish the live-outs: DE at the stream end, HL at the source base one column-stride past the rectangle.
  return [m.regs.de = dst, m.regs.hl = u16(hl + 0x20 * rows)];
}
