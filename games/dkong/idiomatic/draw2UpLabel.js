// SPDX-License-Identifier: GPL-3.0-only
/**
 * draw2UpLabel — stamp the three fixed video-RAM cells of player 2's "2UP" score marker.
 *
 * Donkey Kong shows a per-player score marker at the top of the screen: three tiles down one
 * video-RAM column — the player-number digit, then 'U', then 'P'. This routine is the STATIC
 * one-shot draw of player 2's marker, force-writing that column unconditionally. The same
 * three cells are afterwards maintained and blinked every sixteenth frame by the marker
 * refresh, which writes the player number plus one into the digit cell.
 *
 * It is drawn only when a second player exists: attract setup calls it behind a two-player
 * guard, and it is also the unconditional tail of the player-alternation setup.
 * Input-independent, straight-line, no branch. A LEAF — calls nothing.
 *
 * The three cells step one tilemap row apart, ascending the screen. The glyph decode: the
 * digit '2' is verified, because for player 2 the refresh writes that same value into that
 * same cell; 'U' and 'P' are the conventional Donkey Kong font and are inferred, not proven
 * here. The routine's role does not depend on the letter decode.
 *
 * LIVE-OUT: memory-only — the three video-RAM cells.
 */

// Player 2's "2UP" marker column base in video RAM. The three marker cells step one tilemap
// row apart, ascending.
const P2_MARKER_BASE = 0x74e0;
const TILEMAP_ROW = 0x20;

// Tile codes of the marker, in Donkey Kong's font: the player-number digit, then 'U', then 'P'.
const TILE_DIGIT_2 = 0x02;
const TILE_U = 0x25;
const TILE_P = 0x20;

export function draw2UpLabel(m) {
  const { mem } = m;
  mem.write8(P2_MARKER_BASE, TILE_DIGIT_2); //                  '2'
  mem.write8(P2_MARKER_BASE - TILEMAP_ROW, TILE_U); //          'U'
  mem.write8(P2_MARKER_BASE - 2 * TILEMAP_ROW, TILE_P); //      'P'
}
