// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
/**
 * copyBiasedTileString — copy a byte string from a source pointer into a destination
 * buffer, adding a fixed tile bias to every byte, until a terminator byte ends the run.
 *
 * PURE LEAF: reads through the source pointer and writes through the destination pointer;
 * calls nothing. The 0xa0 byte is the terminator (not copied) and the only exit.
 *
 * LIVE-OUT: memory only — the biased bytes written into the destination buffer. The routine
 * leaves the terminator in A and the advanced pointers in DE/HL, but no caller reads them.
 */

// End-of-string sentinel: a source byte equal to this ends the copy and is not stored.
const END_MARKER = 0xa0;

// Added to every copied byte — reindexes the source character codes into display-tile codes.
const TILE_BIAS = 0x08;

export function copyBiasedTileString(m, src = m.regs.de, dst = m.regs.hl) {
  const { mem8 } = m;

  for (;;) {
    const b = mem8[src];
    if (b === END_MARKER) return;
    mem8[dst] = b + TILE_BIAS; // store truncates to 8 bits
    src = u16(src + 1);
    dst = u16(dst + 1);
  }
}
