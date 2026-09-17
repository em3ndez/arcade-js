// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampFixedTilePair — paint a fixed two-tile glyph into the tilemap, unconditionally.
 *
 * LIVE-OUT: memory-only — exactly those two tilemap cells.
 */
export function stampFixedTilePair(m) {
  const { mem8 } = m;
  mem8[0x74af] = 0x9f;
  mem8[0x748f] = 0x9e;
}
