// SPDX-License-Identifier: GPL-3.0-only
import { fillScreenRow } from "./fillScreenRow.js";

/**
 * clearScreenStrip — blank a run of framebuffer cells to black.
 *
 * WHAT IT IS
 *   The zero-fill wrapper over fillScreenRow: it fills `rows` framebuffer bytes with 0, starting at
 *   `addr` and stepping +0x20 per byte (one framebuffer stride), which blanks a strip of the display.
 *
 * ROLE IN THE MACHINE
 *   The screen is stored rotated, so consecutive framebuffer bytes stacked +0x20 apart form one strip
 *   across the display (mechanisms.md, the column-blitter family). clearScreenStrip is how callers wipe
 *   such a strip: the round-start splash blanks a 0x20-wide score strip with it to flash the score,
 *   blankScreenStrip and clearScreenRegion build wider clears on top of it, and B/HL default from the
 *   Z80 registers when a caller does not pass them.
 *
 * ROM 0x14cb.  Grounding: [seen].
 *
 * LIVE-OUT: HL is left one stride (0x20) past the last cleared cell (fillScreenRow's live-out).
 */
export function clearScreenStrip(m, rows = m.regs.b, addr = m.regs.hl) {
  // Delegate to the generic band-fill with a fill value of 0 (black): zero `rows` cells from `addr`,
  // each 0x20 further along the framebuffer, then hand back the advanced pointer.
  return fillScreenRow(m, 0, rows, addr);
}
