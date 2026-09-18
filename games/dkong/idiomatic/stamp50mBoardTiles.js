// SPDX-License-Identifier: GPL-3.0-only
/**
 * stamp50mBoardTiles — during board setup, stamp a fixed two-tile motif into two video-RAM cell
 * pairs, but only on the 50m conveyor board (board 2); off it the board gate closes and nothing is
 * written.
 *
 * LIVE-OUT: memory-only — the four video-RAM bytes on the open arm, nothing on the closed arm.
 */
import { boardBitGate } from "./boardBitGate.js";

export function stamp50mBoardTiles(m) {
  const { mem8 } = m;

  if (!boardBitGate(m, 0x02)) return;

  mem8[0x776c] = 0x10;
  mem8[0x776e] = 0xc0;
  mem8[0x748c] = 0x10;
  mem8[0x748e] = 0xc0;
}
