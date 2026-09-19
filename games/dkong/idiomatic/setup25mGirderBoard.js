// SPDX-License-Identifier: GPL-3.0-only
/**
 * setup25mGirderBoard — the 25m (girder) board-setup arm: select the 25m layout, queue its
 * background tune, then run the shared board-setup tail.
 *
 * LIVE-OUT: memory-only.
 */

import { loc_0cc6 } from "./loc_0cc6.js";
import {
  BOARD_LAYOUT_TABLE_25M,
  SND_BGM,
} from "./names.js";


export function setup25mGirderBoard(m) {
  const { regs, mem8 } = m;

  regs.de = BOARD_LAYOUT_TABLE_25M;
  mem8[SND_BGM] = 8;
  loc_0cc6(m);
}
