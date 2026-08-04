// SPDX-License-Identifier: GPL-3.0-only
/**
 * draw1UpLabel — stamp the three video-RAM cells of player 1's "1UP" score marker.
 *
 * The game shows a per-player score marker at the top of the screen: three tiles down one
 * video-RAM column — the player-number digit, then 'U', then 'P', reading "1UP" or "2UP". This
 * is the one-shot static draw of player 1's, run while the top-of-screen furniture is built. It
 * force-writes the three cells unconditionally, whatever they held before, and a separate
 * per-frame routine blinks the same three cells afterwards.
 *
 * The cells step one tilemap row apart, and the column is climbed upward from the digit. Every
 * value is an immediate: input-independent, straight-line, no branch. A LEAF — calls nothing.
 *
 * GLYPH DECODE: the digit tile is verified, because the routine that maintains this marker
 * writes the player number plus one into this same cell. The 'U' and 'P' tile codes are the
 * conventional font reading and are inferred, not proven here — but the routine's role does not
 * depend on the letters.
 *
 * Reads: nothing. Writes: the three video-RAM cells of the marker.
 *
 * LIVE-OUT: memory-only.
 */

// Player 1's marker column base in video RAM, and the step from one marker cell to the next
// (one tilemap row). Player 2's marker sits in a different column, chosen elsewhere.
const P1_MARKER_BASE = 0x7740;
const TILEMAP_ROW = 0x20;

// Tile codes of the marker: the player-number digit, then the two letters.
const TILE_DIGIT_1 = 0x01;
const TILE_U = 0x25;
const TILE_P = 0x20;

export function draw1UpLabel(m) {
  const { mem } = m;
  mem.write8(P1_MARKER_BASE, TILE_DIGIT_1); //                  the digit '1'
  mem.write8(P1_MARKER_BASE - TILEMAP_ROW, TILE_U); //          one row up: 'U'
  mem.write8(P1_MARKER_BASE - 2 * TILEMAP_ROW, TILE_P); //      two rows up: 'P'
}
