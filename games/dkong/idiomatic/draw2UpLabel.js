import {
  P2_INDICATOR_COLUMN_BASE,
} from "./names.js";
// SPDX-License-Identifier: GPL-3.0-only
/**
 * draw2UpLabel — stamp the three fixed video-RAM cells of player 2's "2UP" score marker, drawn
 * only when a second player exists. A leaf; the cells step one tilemap row apart, ascending.
 *
 * LIVE-OUT: memory-only.
 */

const TILEMAP_ROW = 0x20;

const TILE_DIGIT_2 = 0x02;
const TILE_U = 0x25;
const TILE_P = 0x20;

export function draw2UpLabel(m) {
  const { mem8 } = m;
  mem8[P2_INDICATOR_COLUMN_BASE] = TILE_DIGIT_2;
  mem8[P2_INDICATOR_COLUMN_BASE - TILEMAP_ROW] = TILE_U;
  mem8[P2_INDICATOR_COLUMN_BASE - 2 * TILEMAP_ROW] = TILE_P;
}
