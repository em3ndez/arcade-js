// SPDX-License-Identifier: GPL-3.0-only
import { PLAYFIELD_VRAM_BASE } from "./names.js";

/**
 * clearPlayfield -- blank the playable area of the framebuffer while preserving the score/status bands.
 *
 * WHAT IT IS
 *   The framebuffer at 0x2400..0x3fff is drawn as a grid of 32-byte columns (the display is rotated 90
 *   degrees, so each "column" is a vertical screen strip and consecutive addresses step down it). Not all
 *   of it is play area: the four highest bytes of every column form the top score band and the two lowest
 *   bytes form the bottom status strip. This routine erases only the play area between those two margins,
 *   walking every column but stepping over the reserved bytes so the score header and status line survive.
 *
 * ROLE IN THE MACHINE
 *   Distinct from clearScreen (0x1a5c), which blanks the ENTIRE window including the margins. clearPlayfield
 *   starts at PLAYFIELD_VRAM_BASE (0x2402 -- VIDEO_RAM_BASE displaced by the two-byte bottom margin) and is
 *   called at round start (startRoundFlow) to wipe the field without disturbing the persistent panels. The
 *   ground line at column offset 0x02 is the FIRST play-area byte this routine erases (drawBottomLine
 *   redraws it after each wipe), not a preserved byte. Writes video RAM only.
 *
 * ROM 0x09d6.  Grounding: [seen].
 *
 * LIVE-OUT: none for callers (memory-only; the local pointer is discarded).
 */
export function clearPlayfield(m) {
  // Start at the first play-area byte (offset 0x02 of the first column -- past the two-byte bottom margin).
  let p = PLAYFIELD_VRAM_BASE;
  for (;;) {
    // Blank this byte, then advance one step down the current 32-byte column.
    m.mem8[p] = 0;
    p += 1;
    // The low five bits of the address are the within-column offset (0..31). Reaching 0x1c means we have
    // just finished the play area of this column (offsets 0x02..0x1b written); jump forward six bytes to
    // skip the four highest bytes of this column (top score band) and the two lowest of the next (bottom
    // status strip), landing on offset 0x02 of the following column.
    if ((p & 0x1f) >= 0x1c) p += 6;
    // Stop once the pointer's high byte reaches 0x40 -- i.e. past the end of video RAM (0x3fff), meaning
    // every column has been swept.
    if ((p >> 8) >= 0x40) break;
  }
}
