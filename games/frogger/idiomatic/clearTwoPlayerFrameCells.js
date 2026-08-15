// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearTwoPlayerFrameCells — zero five cells, but only when the play-mode cell holds 2.
 * LIVE-OUT: memory-only.
 */
import { PLAY_FLAG, SPRITE_FRAME_BUSY_LATCH1, TWOPLAYER_FRAME_CELL_814E, TWOPLAYER_FRAME_CELL_8145, TWOPLAYER_FRAME_CELL_8146, TWOPLAYER_FRAME_CELL_8147 } from "./names.js";

const TWO_PLAYER = 2;

export function clearTwoPlayerFrameCells(m) {
  const { mem8 } = m;
  if (mem8[PLAY_FLAG] !== TWO_PLAYER) return;
  mem8[SPRITE_FRAME_BUSY_LATCH1] = 0;
  mem8[TWOPLAYER_FRAME_CELL_814E] = 0;
  mem8[TWOPLAYER_FRAME_CELL_8145] = 0;
  mem8[TWOPLAYER_FRAME_CELL_8146] = 0;
  mem8[TWOPLAYER_FRAME_CELL_8147] = 0;
}
