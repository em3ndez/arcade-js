// SPDX-License-Identifier: GPL-3.0-only
/**
 * setUp75mBoard — the 75m (elevators) board-setup arm: stamp the fixed decorative tiles, select
 * the 75m background tune, then point at the 75m layout and run the shared draw/setup tail.
 *
 * LIVE-OUT: memory-only.
 */

import { stamp75mBoardTiles } from "./stamp75mBoardTiles.js";
import { loc_0cc6 } from "./loc_0cc6.js";
import { SND_BGM, BOARD_LAYOUT_TABLE_75M } from "./names.js";

export function setUp75mBoard(m) {
  const { mem8 } = m;

  stamp75mBoardTiles(m);
  mem8[SND_BGM] = 0x0a;
  // de reaches the shared board-layout tail in a register; assign it first in the return tuple (left-to-right).
  return [(m.regs.de = BOARD_LAYOUT_TABLE_75M), loc_0cc6(m)];
}
