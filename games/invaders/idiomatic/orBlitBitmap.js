// SPDX-License-Identifier: GPL-3.0-only

/**
 * orBlitBitmap — OR-merge a two-dimensional bitmap onto the screen without erasing the background.
 *
 * WHAT IT IS
 *   A rectangular OR-blit: for each of B rows it OR-combines C source bytes into C consecutive destination
 *   bytes, then steps the destination down one screen row (by 0x20) while the source pointer runs straight
 *   through the stream. Because it ORs rather than overwrites, whatever is already on screen underneath is
 *   preserved.
 *
 * ROLE IN THE MACHINE
 *   This is how the bunker shields are painted back onto the screen. drawOrSaveShields (0x021e) drives it
 *   on its restore path, stamping each stored 0x16-column-by-two-byte shield block back over the play
 *   field so partially-eaten bunkers reappear exactly as they were saved, on top of the background. The
 *   framebuffer is walked one display row at a time by adding 0x20 to the pointer, so the inner loop lays
 *   C bytes across a row and the outer loop drops to the next row; the source is a contiguous bitmap
 *   stream that is consumed continuously across all rows.
 *
 * ROM 0x1a69-0x1a7e.  Grounding: [seen].  (A row/column count of 0 wraps to a full 256 via the & 0xff
 *   decrement-then-test, matching the 8080 `dcr`/`jnz` loops.)
 *
 * LIVE-OUT: HL = destination pointer past the last row's start (rowStart + 0x20), DE = source pointer
 * advanced past the whole consumed bitmap. Returned as [HL, DE].
 */
export function orBlitBitmap(m, hl = m.regs.hl, de = m.regs.de, b = m.regs.b, c = m.regs.c) {
  // dst walks the screen, src walks the source bitmap (straight through), rows counts the B rows.
  let dst = hl, src = de, rows = b;
  do {
    // Remember where this row began so the next row can be reached as rowStart + 0x20.
    const rowStart = dst;
    let n = c;
    // Inner loop: OR each of C source bytes into the matching destination byte, advancing both. OR-ing
    // preserves any bits already set on screen (the background under the shield).
    do {
      m.mem8[dst] = m.mem8[src] | m.mem8[dst];
      src = src + 1;
      dst = dst + 1;
      n = (n - 1) & 0xff;
    } while (n !== 0);
    // Drop to the next screen row: back to this row's start, then + 0x20 (one row down in the framebuffer).
    dst = rowStart + 0x20;
    rows = (rows - 1) & 0xff;
  } while (rows !== 0);
  // Hand back the advanced destination and source pointers.
  return [(m.regs.hl = dst), (m.regs.de = src)];
}
