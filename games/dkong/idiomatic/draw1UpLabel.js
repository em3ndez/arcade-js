// SPDX-License-Identifier: GPL-3.0-only
/**
 * draw1UpLabel — stamp the three video-RAM cells of player 1's "1UP" score marker, run once while
 * the top-of-screen furniture is built. A leaf; the cells step one tilemap row apart, ascending.
 *
 * LIVE-OUT: memory-only.
 */

const P1_MARKER_BASE = 0x7740;
const TILEMAP_ROW = 0x20;

const TILE_DIGIT_1 = 0x01;
const TILE_U = 0x25;
const TILE_P = 0x20;

export function draw1UpLabel(m) {
  const { mem8 } = m;
  mem8[P1_MARKER_BASE] = TILE_DIGIT_1;
  mem8[P1_MARKER_BASE - TILEMAP_ROW] = TILE_U;
  mem8[P1_MARKER_BASE - 2 * TILEMAP_ROW] = TILE_P;
}
