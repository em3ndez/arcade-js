// SPDX-License-Identifier: GPL-3.0-only
import { VIDEO_RAM_BASE, VIDEO_RAM_END } from "./names.js";

/**
 * clearScreen — blank the entire video framebuffer.
 *
 * WHAT IT IS
 *   Walks the whole framebuffer span and stores zero at every byte, blanking the complete display in a
 *   single pass — heads-up margins included, not just the playfield. The framebuffer occupies the fixed
 *   window from VIDEO_RAM_BASE (0x2400) up to, but not including, VIDEO_RAM_END (0x4000), so this clears
 *   0x2400-0x3fff (0x1c00 bytes). Each byte packs eight pixels, so zeroing the byte turns eight pixels off.
 *
 * ROLE IN THE MACHINE
 *   The full-screen erase, distinct from clearPlayfield (which preserves the top score band and bottom
 *   status strip). The ROM walks a pointer up from the base and stops once the pointer's high byte
 *   reaches 0x40 (== VIDEO_RAM_END >> 8) — this loop expresses the same span with an explicit end bound.
 *   Used on the score-panel redraw path (redrawScorePanel blanks video RAM before repainting the fixed
 *   furniture) and other whole-screen resets. Touches only video RAM.
 *
 * ROM 0x1a5c.  Grounding: [seen] (VIDEO_RAM_BASE and VIDEO_RAM_END are both [seen]).
 *
 * LIVE-OUT: memory only (video RAM 0x2400-0x3fff zeroed).
 */
export function clearScreen(m) {
  // Store 0 into every byte from the base up to (but not including) the end of the video window.
  for (let a = VIDEO_RAM_BASE; a < VIDEO_RAM_END; a++) m.mem8[a] = 0x00;
}
