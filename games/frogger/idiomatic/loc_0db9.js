// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0db9 — queue the credit / 1UP header tiles.
 *
 * With exactly one credit, blit the "1UP" strips (a 4-tile column then an 11-tile column from a
 * second source). Otherwise mark the header state, blit a 4-tile then a 13-tile column, and cap the
 * advanced cursor with the cap tile. Both columns advance the shared destination/source pointers.
 * LIVE-OUT: memory-only.
 */
import { CREDIT_BCD, loc_8023, loc_2f88, loc_2f93, loc_aaf1, loc_ab11 } from "./names.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";

const ONE_CREDIT = 1;
const HEADER_STATE = 3;
const CURSOR_CAP_TILE = 35;

export function loc_0db9(m) {
  const { regs, mem8 } = m;
  regs.de = loc_2f88;
  if (mem8[CREDIT_BCD] === ONE_CREDIT) return blitOneUp(m);

  mem8[loc_8023] = HEADER_STATE;
  regs.hl = loc_ab11;
  regs.b = 4;
  copyRunUpTileColumn(m);
  regs.b = 13;
  copyRunUpTileColumn(m);
  mem8[regs.hl] = CURSOR_CAP_TILE;
}

// The one-credit variant: two columns, the second from a second tile source; no cursor cap.
function blitOneUp(m) {
  const { regs } = m;
  regs.hl = loc_aaf1;
  regs.b = 4;
  copyRunUpTileColumn(m);
  regs.de = loc_2f93;
  regs.b = 11;
  copyRunUpTileColumn(m);
}
