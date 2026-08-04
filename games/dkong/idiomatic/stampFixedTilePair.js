// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampFixedTilePair — paint a fixed two-tile decoration into the tilemap.
 *
 * A constant, input-free repaint: it writes tile code 0x9F to one video-RAM cell and
 * tile code 0x9E to the cell 0x20 lower in address, unconditionally. The two cells sit
 * 0x20 apart, and the lower-address one is one screen-cell BELOW the other, so the
 * pair is a two-tall glyph stamped at a fixed screen spot.
 *
 * NO INPUTS. It reads no register and no memory; its behaviour is fixed by its own
 * code. A LEAF: calls nothing.
 *
 * LIVE-OUT: memory-only — exactly those two tilemap cells.
 */
export function stampFixedTilePair(m) {
  const { mem } = m;
  // Upper cell, then the cell 0x20 below it on screen.
  mem.write8(0x74af, 0x9f);
  mem.write8(0x748f, 0x9e);
}
