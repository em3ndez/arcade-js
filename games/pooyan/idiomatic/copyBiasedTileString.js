// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
/**
 * copyBiasedTileString — copy a character string from ROM into a tile buffer, adding a fixed
 * bias to every byte, until a terminator byte ends the run.
 *
 * ROM 0x1b80 — [seen]. A small string-blit primitive that reindexes source character codes
 * into the tile codes the display hardware actually renders. The source is a run of raw
 * character bytes ending in a 0xa0 sentinel; each real byte is raised by 0x08 (the offset
 * between the character alphabet and the corresponding tile glyphs in the tile ROM) and stored
 * into the destination buffer. The 0xa0 sentinel is consumed as the end mark and is never
 * copied — it is the routine's only exit.
 *
 * The primary caller (rebuildFieldAndLatchPlayStateWithTamperCheck) falls straight into this loop with the source pointing at the
 * ROM message string BIASED_TILE_STRING_1FF2 (0x1ff2) and the destination pointing into the
 * on-screen tile buffer, so a boot/attract banner lands on screen already biased into tile
 * codes.
 *
 * PURE LEAF: reads through the source pointer and writes through the destination pointer;
 * calls nothing.
 *
 * LIVE-OUT: memory only — the biased bytes written into the destination buffer. The routine
 * also leaves the 0xa0 terminator behind and the source/destination pointers advanced past the
 * end of the run, but no caller reads them back.
 */

// End-of-string sentinel: a source byte equal to this ends the copy and is not stored. 0xa0 is
// the blank/space tile in this game's tile ROM, so it never appears inside a real string and
// makes an unambiguous terminator.
const END_MARKER = 0xa0;

// Added to every copied byte. The source string is encoded in a character alphabet that sits
// 0x08 below the matching glyphs in the tile ROM; adding 0x08 reindexes each character code into
// the tile code the display hardware draws.
const TILE_BIAS = 0x08;

export function copyBiasedTileString(m, src = m.regs.de, dst = m.regs.hl) {
  const { mem8 } = m;

  for (;;) {
    // Peek the next source byte. Reaching the 0xa0 sentinel ends the string; it is the sole
    // exit and is deliberately left unwritten so the destination keeps whatever was already
    // there past the copied text.
    const b = mem8[src];
    if (b === END_MARKER) return;

    // Bias the character into its tile code and stamp it into the destination buffer. The store
    // is 8-bit, so a byte that would overflow past 0xff wraps — matching the Z80's 8-bit add.
    mem8[dst] = b + TILE_BIAS; // store truncates to 8 bits

    // Advance both pointers one byte, wrapping at the 16-bit address boundary, and copy the next
    // character.
    src = u16(src + 1);
    dst = u16(dst + 1);
  }
}
