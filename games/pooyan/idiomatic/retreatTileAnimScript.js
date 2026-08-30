// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { TILE_ANIM_PARITY, TILE_ANIM_CURSOR } from "./names.js";
/**
 * retreatTileAnimScript — the even-frame half of a two-part on-screen tile animation, walking
 * a strip of tilemap cells backward one step per beat.
 *
 * ROM 0x23ec-0x2404. Grounding: [seen].
 *
 * A short strip of tiles in video RAM is animated by cycling the tile codes stored in it.
 * TILE_ANIM_CURSOR (0x88be) is a 16-bit pointer into that strip: its high byte is 0x84 (the
 * tilemap page) and its low byte oscillates through the strip, so the pointer dereferences a
 * live video-RAM cell whose tile code this routine rewrites. Two routines share the cursor —
 * an "advance" half that runs on odd frames and this "retreat" half on even frames — and
 * TILE_ANIM_PARITY (0x8f37) is the per-frame counter that alternates them: whichever half is
 * called, it bumps the counter, and this half then runs only when the low bit is clear.
 *
 * On an even frame it edits the tile code the cursor points at:
 *   - 0x34 is the rewind marker at the far end of the walk: it is reset to the base tile code
 *     0x10 and the pointer is stepped back one cell, so the next beat resumes retreating from
 *     the cell before it (0x34 is one of the sentinel codes, alongside 0x37, that bound the
 *     strip and gate the step direction).
 *   - any other code is simply decremented in place, cycling that cell one tile lower.
 * The updated cursor is written back for the next frame.
 *
 * LIVE-OUT: memory only — the parity counter (0x8f37), the tile byte at the cursor (video RAM),
 * and the cursor word (0x88be). No register or flag survives for the caller. Calls nothing.
 */
export function retreatTileAnimScript(m) {
  const { mem8, mem16 } = m;

  // Bump the shared per-frame parity counter (0x8f37), then run only on even frames. On an odd
  // frame the sibling "advance" half owns this beat, so bail out and leave the strip to it.
  mem8[TILE_ANIM_PARITY] = mem8[TILE_ANIM_PARITY] + 1;
  if (mem8[TILE_ANIM_PARITY] & 0x01) return; // odd frame -> the advance half runs, not this one

  // Follow the cursor to the live video-RAM cell it points at.
  let ptr = mem16[TILE_ANIM_CURSOR];
  if (mem8[ptr] === 0x34) {
    // Hit the rewind marker: reload the base tile code and back the pointer up one cell, so the
    // retreat resumes from the previous cell on the next even frame.
    mem8[ptr] = 0x10;   // rewind marker -> reload the base tile code
    ptr = u16(ptr - 1); // back the pointer up one cell (past the high byte)
  } else {
    // Ordinary cell: cycle its tile code one step lower, animating the strip backward.
    mem8[ptr] = mem8[ptr] - 1; // step the tile code back one
  }

  // Store the (possibly stepped-back) cursor for the next frame's beat.
  mem16[TILE_ANIM_CURSOR] = ptr;
}
