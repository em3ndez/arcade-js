// SPDX-License-Identifier: GPL-3.0-only
/**
 * stamp50mBoardTiles — during board setup, stamp a fixed two-tile motif into two video-RAM cell
 * pairs, but only on the 50m conveyor board (board 2); off it the board gate closes and nothing is
 * written.
 *
 * LIVE-OUT: memory-only — the four video-RAM bytes on the open arm, nothing on the closed arm.
 */
import { boardBitGate } from "./boardBitGate.js";
import { M50_TILE_MOTIF_LEFT_VRAM, loc_748c, loc_748e, loc_776e } from "./names.js";

export function stamp50mBoardTiles(m) {
  const { mem8 } = m;

  if (!boardBitGate(m, 0x02)) return;

  mem8[M50_TILE_MOTIF_LEFT_VRAM] = 0x10;
  mem8[loc_776e] = 0xc0;
  mem8[loc_748c] = 0x10;
  mem8[loc_748e] = 0xc0;
}
